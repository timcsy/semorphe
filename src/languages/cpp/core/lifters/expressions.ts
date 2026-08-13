import type { Lifter } from '../../../../core/lift/lifter'
import type { SemanticNode } from '../../../../core/types'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import { createNode } from '../../../../core/semantic-tree'
import type { LiftPostProcessor } from '../../../../core/lift/post-processors'
import { tryAstBranches } from '../../../../core/component/lift-branches'
import { buildStringIndex } from '../../../../components/cpp/string_at/lift'
import { buildLogicNot } from '../../../../components/cpp/logic_not/lift'
import { buildNegate } from '../../../../components/cpp/negate/lift'
import { buildBitwiseNot } from '../../../../components/cpp/bitwise_not/lift'
import { buildAddressOf } from '../../../../components/cpp/address_of/lift'
import { buildPointerDeref } from '../../../../components/cpp/pointer_deref/lift'
import { buildIncrement } from '../../../../components/cpp/increment/lift'
import { buildCommaExpr } from '../../../../components/cpp/comma_expr/lift'
import { binaryOperatorConcept } from '../../../../core/component/binary-operators'
import { isBinaryOperator } from '../node-traits'
import { buildEndl } from '../../../../components/cpp/endl/lift'
import { buildArrayAt } from '../../../../components/cpp/array_at/lift'
import { buildVarRef } from '../../../../components/cpp/var_ref/lift'
import { isVariableRef } from '../node-traits'
import { buildPrint } from '../../../../components/cpp/print/lift'
import { buildInput } from '../../../../components/cpp/input/lift'
import { isStreamInput } from '../node-traits'
import { declareAggregateList } from '../../../../core/component/aggregate-nodes'

// ⚠️ 這裡原本有三組運算子集合（ARITHMETIC／COMPARE／LOGIC）＋ 一行
// `else concept = 'cpp:arithmetic'` 的兜底。三顆元件搬進膠囊之後，
// **每一個符號由它自己的元件認領**，兜底也變成一句顯式宣告。

// ─── 字串型別推斷（供 subscript_expression lifter 使用） ──────────────────────

function isStringTypeName(text: string): boolean {
  return text === 'string' || text === 'std::string'
}

function stringVarNamesInDecl(declNode: AstNode): string[] {
  if (declNode.type !== 'declaration') return []
  const typeNode = declNode.namedChildren.find((c: AstNode) =>
    c.type === 'type_identifier' || c.type === 'qualified_identifier'
  )
  if (!typeNode || !isStringTypeName(typeNode.text)) return []
  const names: string[] = []
  for (const c of declNode.namedChildren) {
    if (c.type === 'identifier') {
      names.push(c.text)
    } else if (c.type === 'init_declarator') {
      // string s = "hello"  or  string s
      const id = c.namedChildren.find((d: AstNode) => d.type === 'identifier')
      if (id) names.push(id.text)
    }
  }
  return names
}

function stringParamNamesInFunc(funcDefNode: AstNode): string[] {
  const names: string[] = []
  // function_definition → declarator (function_declarator) → parameters
  const declNode = funcDefNode.childForFieldName('declarator')
  const paramList =
    declNode?.childForFieldName('parameters') ??
    declNode?.namedChildren.find((c: AstNode) => c.type === 'parameter_list')
  if (!paramList) return names
  for (const param of paramList.namedChildren) {
    if (param.type !== 'parameter_declaration') continue
    const typeNode = param.namedChildren.find((c: AstNode) =>
      c.type === 'type_identifier' || c.type === 'qualified_identifier'
    )
    if (!typeNode || !isStringTypeName(typeNode.text)) continue
    // name may be bare identifier, or inside reference_declarator / pointer_declarator
    let nameNode = param.namedChildren.find((c: AstNode) => c.type === 'identifier')
    if (!nameNode) {
      const refOrPtr = param.namedChildren.find((c: AstNode) =>
        c.type === 'reference_declarator' || c.type === 'pointer_declarator'
      )
      nameNode = refOrPtr?.namedChildren.find((c: AstNode) => c.type === 'identifier')
    }
    if (nameNode) names.push(nameNode.text)
  }
  return names
}

// Walk up AST scopes; globals (translation_unit) are scanned without position filter
// so they're visible regardless of declaration order, matching C++ semantics.
function isStringVar(varName: string, fromNode: AstNode): boolean {
  let current = fromNode.parent
  while (current) {
    if (current.type === 'compound_statement') {
      for (const child of current.namedChildren) {
        if (child.startIndex >= fromNode.startIndex) break
        if (stringVarNamesInDecl(child).includes(varName)) return true
      }
    } else if (current.type === 'translation_unit') {
      for (const child of current.namedChildren) {
        if (stringVarNamesInDecl(child).includes(varName)) return true
      }
    } else if (current.type === 'function_definition') {
      if (stringParamNamesInFunc(current).includes(varName)) return true
    }
    current = current.parent
  }
  return false
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * 這個節點是不是「被當成算術位移處理的 `>>`」。
 *
 * `cin >> x` 在某些脈絡下會先被辨識成二元運算，之後才被還原成輸入。
 * 判斷條件是「**它是二元運算子節點，而運算子是 `>>`**」——
 * 問性狀不問身分，那顆元件才搬得動。
 */
function isShiftLike(node: { conceptId: string; properties?: Record<string, unknown> }): boolean {
  return isBinaryOperator(node.conceptId) && node.properties?.operator === '>>'
}

export function registerExpressionLifters(lifter: Lifter): void {
  // number_literal, identifier, true/false/null/nullptr — handled by JSON patterns in lift-patterns.json
  // (cpp_number_literal, cpp_identifier, cpp_endl, cpp_eof, cpp_null_id, cpp_true, cpp_false, cpp_null, cpp_nullptr)

  lifter.register('binary_expression', (node, ctx) => {
    const leftNode = node.childForFieldName('left')
    const rightNode = node.childForFieldName('right')

    // Find operator (unnamed child between left and right)
    let op = '+'
    for (const child of node.children) {
      if (!child.isNamed && child.text !== '(' && child.text !== ')') {
        op = child.text
        break
      }
    }

    // Handle cout << x << y  and  cin >> x >> y
    if (op === '<<') {
      const coutValues = extractCoutChain(node, ctx)
      if (coutValues) {
        return buildPrint(coutValues)
      }
    }
    if (op === '>>') {
      const cin = extractCinChain(node, ctx)
      if (cin) {
        // ⚠️ **`num >> i`（位移）與 `in >> a`（串流讀取）語法完全相同。**
        //
        // 曾經試過一條「根是任意識別字」的宣告式規則——它把位移運算也認領走了。
        // P3：「新增 pattern 不得改變既有 pattern 的匹配結果——**歧義在註冊時
        // 仲裁，不在執行時碰運氣**。」那條規則就是在碰運氣，已撤。
        //
        // 分得出來的唯一依據是**根變數的型別**，而那要查辨識脈絡（076 接上的）。
        // 查不到型別就**不當串流**——保守方向，位移是遠比串流常見的寫法。
        if (cin.from === 'cin') {
          return buildInput(cin.values)
        }
        const rootType = ctx.data.getType(cin.from)
        if (rootType === 'istringstream' || rootType === 'stringstream') {
          return buildInput(cin.values, { from: String(cin.from) })
        }
        // 不是串流 → 落到下面的一般二元運算（位移）
      }
    }

    const left = leftNode ? ctx.lift(leftNode) : null
    const right = rightNode ? ctx.lift(rightNode) : null

    // **哪個符號屬於哪顆元件由膠囊登錄**（`core/component/binary-operators.ts`）。
    // 認不得的運算子走顯式登錄的兜底——那也是一顆元件的宣告，不是這裡的預設值。
    const concept = binaryOperatorConcept(op)
    if (!concept) return null

    return createNode(concept, { operator: op }, {
      left: left ? [left] : [],
      right: right ? [right] : [],
    })
  })

  lifter.register('unary_expression', (node, ctx) => {
    const op = node.children.find(c => !c.isNamed)?.text ?? ''
    const operandNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    const operand = operandNode ? ctx.lift(operandNode) : null

    if (op === '!') {
      return buildLogicNot(operand)
    }
    if (op === '-') {
      return buildNegate(operand)
    }
    if (op === '~') {
      return buildBitwiseNot(operand)
    }
    if (op === '&') {
      return buildAddressOf(operand)
    }
    if (op === '*') {
      return buildPointerDeref(operand)
    }

    // Fallback for other unary ops (++, --, etc.)
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: node.text }
    return raw
  })

  lifter.register('update_expression', (node, ctx) => {
    // i++ / ++i / i-- / --i
    const op = node.children.find(c => !c.isNamed)?.text ?? '++'
    const nameNode = node.namedChildren[0]
    // Prefix if operator comes before the operand
    const firstChild = node.children[0]
    const position = (!firstChild?.isNamed && (firstChild?.text === '++' || firstChild?.text === '--')) ? 'prefix' : 'postfix'

    // Array element increment: arr[i]++ / --arr[i]
    if (nameNode?.type === 'subscript_expression') {
      const arrayNode = nameNode.childForFieldName('argument') ?? nameNode.namedChildren[0]
      const arrName = arrayNode?.text ?? 'arr'
      const indicesNode = nameNode.namedChildren.find(c => c.type === 'subscript_argument_list')
      const indexNode = indicesNode?.namedChildren[0] ?? nameNode.childForFieldName('index') ?? nameNode.namedChildren[1]
      const index = indexNode ? ctx.lift(indexNode) : null
      return buildIncrement(arrName, op, position, index)
    }

    const name = nameNode?.text ?? 'i'
    return buildIncrement(name, op, position)
  })

  // parenthesized_expression — handled by JSON unwrap pattern (cpp_unwrap_parens)
  // pointer_expression — handled by JSON constrained patterns (cpp_address_of_ptr, cpp_pointer_deref_ptr)

  // Comma expression: i++, j-- (used in for-loop updates)
  lifter.register('comma_expression', (node, ctx) => {
    const children = node.namedChildren.map(c => ctx.lift(c)).filter(Boolean) as SemanticNode[]
    return buildCommaExpr(children)
  })

  /**
   * `{3}`／`{2,1}` 出現在**表達式位置**——聚合初始化。
   *
   * ⚠️ 陣列宣告那一路（`int a[3] = {1,2,3}`）不走這裡：它由
   * `attachInitializer` 直接從 AST 拆，比這條早。這條補的是**其他所有位置**：
   * `P a{3};`、`v.push_back({2,1})`、`vector<S> v = {{3},{1}}`。
   *
   * 少了它，那些 `{…}` 落進 `unresolved`——而 `unresolved` 在執行期是
   * `UNKNOWN_CONCEPT`，整段程式停在那裡。
   *
   * 產出的是**結構節點**（`cpp_initializer_list`，`non-components` 裡宣告過），
   * 不是元件：`{3}` 是什麼要看**誰在消費它**——目標型別是結構就是聚合初始化，
   * 否則是一串值。那個決定在 `core/runtime/aggregate.ts`，不在這裡。
   */
  // 「這個節點是一層 `{…}`」——**由套件宣告，核心不比對名字**。
  // 消費它的 `interpreter/aggregate.ts` 住在核心，而那個名字是 C++ 的知識。
  declareAggregateList('cpp_initializer_list')

  lifter.register('initializer_list', (node, ctx) => {
    const values = node.namedChildren
      .map(c => ctx.lift(c))
      .filter((n): n is SemanticNode => n !== null)
    return createNode('cpp_initializer_list', {}, { values })
  })

  // cast_expression — handled by JSON pattern (cpp_cast_expr)
  // conditional_expression — handled by JSON pattern (cpp_ternary_expr)

  lifter.register('subscript_expression', (node, ctx) => {
    // **膠囊自己的判別先問**——「外層下標裡面還是下標時是我」是元件的知識。
    const claim = tryAstBranches('subscript_expression', node, ctx)
    if (claim) return claim

    const arrayNode = node.childForFieldName('argument') ?? node.namedChildren[0]

    const name = arrayNode?.text ?? 'arr'
    // tree-sitter C++ wraps index in subscript_argument_list: arr[i] → (subscript_argument_list (identifier))
    const indicesNode = node.namedChildren.find(c => c.type === 'subscript_argument_list')
    const indexNode = indicesNode?.namedChildren[0] ?? node.childForFieldName('index') ?? node.namedChildren[1]
    const index = indexNode ? ctx.lift(indexNode) : null

    if (isStringVar(name, node)) {
      return buildStringIndex(name, index)
    }
    return buildArrayAt(name, {
      index: index ? [index] : [],
    })
  })

  // `s.member` / `p->member`——兩顆元件各自登錄分支（`registerAstBranch`）。
  // 共用檔只剩「問一遍」。
  lifter.register('field_expression', (node, ctx) =>
    tryAstBranches('field_expression', node, ctx),
  )


}

/**
 * Extract cout << x << y << endl chain.
 * Tree-sitter parses "cout << x << y" as nested binary_expression:
 *   (binary_expression left: (binary_expression left: "cout" right: "x") right: "y")
 * Returns null if the leftmost identifier is not cout.
 */
function extractCoutChain(node: AstNode, ctx: LiftContext): SemanticNode[] | null {
  const values: SemanticNode[] = []
  let current: AstNode | null = node

  // Walk left-recursively to collect all << operands
  while (current && current.type === 'binary_expression') {
    const op = current.children.find(c => !c.isNamed && c.text === '<<')
    if (!op) break

    const rightNode = current.childForFieldName('right')
    if (rightNode) {
      // Check for endl
      if (rightNode.text === 'endl') {
        values.unshift(buildEndl())
      } else {
        const lifted = ctx.lift(rightNode)
        if (lifted) values.unshift(lifted)
      }
    }
    current = current.childForFieldName('left')
  }

  // Check if the base is "cout"
  if (!current || current.text !== 'cout') return null
  return values
}

/**
 * Extract cin >> x >> y chain. Returns array of semantic nodes (var_ref or array_access) or null.
 */
function extractCinChain(node: AstNode, ctx: LiftContext): { values: SemanticNode[]; from: string } | null {
  const values: SemanticNode[] = []
  let current: AstNode | null = node

  while (current && current.type === 'binary_expression') {
    const op = current.children.find(c => !c.isNamed && c.text === '>>')
    if (!op) break
    const rightNode = current.childForFieldName('right')
    if (rightNode) {
      if (rightNode.type === 'subscript_expression') {
        // cin >> arr[i] — lift as array_access
        const lifted = ctx.lift(rightNode)
        if (lifted) values.unshift(lifted)
      } else {
        values.unshift(buildVarRef(rightNode.text))
      }
    }
    current = current.childForFieldName('left')
  }

  if (!current) return null
  // 來源不是 `cin` 就整條放棄——**於是 `in >> a` 這種從字串串流讀的寫法
  // 完全辨識不出來**。改成回報來源，由呼叫端決定怎麼記。
  return values.length > 0 ? { values, from: current.text } : null
}

/**
 * `in >> a >> b` → 從字串串流讀值，而不是位元位移。
 *
 * ⚠️ 這條判準**原本寫在核心層**（`src/core/lift/lifter.ts`）。搬過來的理由
 * 是 P9：判準裡寫著 `istringstream` / `stringstream`，那是 C++ 的型別名，
 * 拔掉 C++ 之後核心不該還認得它們。
 *
 * **中立性與語法耦合兩條護欄都看不見那筆耦合**——一個找元件身分，一個找
 * 語法符號，而型別名兩者皆非。叫的是**就近性**護欄（`input` / `var_ref` /
 * `arithmetic` 的擴散度各 +1 檔），而它量的甚至不是語言耦合。
 * 見 `knowledge/history/021`「選了哪一維會消失在數字裡」。
 *
 * 放在這個檔而不是新開一個，也是就近性：`>>` 的辨識與 `extractCinChain`
 * 都在這裡，同一個元件的實作該待在一起。
 */
/** 哪些型別的 `>>` 是「讀值」而不是「位移」 */
const READ_STREAM_TYPES = new Set(['istringstream', 'stringstream'])

export const cppStreamRead: LiftPostProcessor = (node, ctx) => {
  if (!isShiftLike(node)) return null

  // 走到最左邊的根，沿路收集右運算元。
  //
  // ⚠️ **辨識是由內往外的。** `in >> a >> b >> c` 的巢狀是
  // `((in >> a) >> b) >> c`，而內層的 `in >> a` **已經先被改判成 `input`**
  // ——所以外層看到的左子節點是一個 `input`，不是 `arithmetic`。
  //
  // 第一版沒有處理這件事，於是只收到 `a` 就停了。**症狀是「讀到第一個值
  // 就不動」**，看起來像串流本身壞掉，而其實是走訪停太早。
  const targets: SemanticNode[] = []
  let cur: SemanticNode | undefined = node
  let rootName: string | null = null

  while (cur) {
    if (isStreamInput(cur.conceptId) && cur.properties?.from !== undefined) {
      // 內層已經改判過——接續它收集到的目標
      targets.unshift(...(cur.children?.values ?? []))
      rootName = String(cur.properties.from)
      break
    }
    if (!isShiftLike(cur)) return null
    const right = (cur.children?.right ?? [])[0]
    if (!right || !isVariableRef(right.conceptId)) return null
    targets.unshift(right)
    const left: SemanticNode | undefined = (cur.children?.left ?? [])[0]
    if (!left) return null
    if (isVariableRef(left.conceptId)) {
      rootName = String(left.properties?.name ?? '')
      break
    }
    cur = left
  }

  if (rootName === null || targets.length === 0) return null

  // 判準是**根變數的型別**（辨識脈絡查得到，076 接上的）。查不到就不改判
  // ——保守方向：位移遠比串流讀取常見。
  const rootType: string | null = ctx.data.getType(rootName)
  if (rootType === null || !READ_STREAM_TYPES.has(rootType)) return null

  // 目標節點可能同時掛在原本那棵樹上——複製一份，避免兩棵樹共用物件。
  const cloned = targets.map((v) => buildVarRef(String(v.properties.name ?? '')))
  return buildInput(cloned, { from: rootName })
}