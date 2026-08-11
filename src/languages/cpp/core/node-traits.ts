/**
 * **節點性狀** —— 一顆元件對「共用演算法」宣告的兩件事
 *
 * ## 為什麼需要它
 *
 * 兩個共用檔各有一張以身分為鍵的表，而它們**都不是實作散落**：
 *
 * ```ts
 * // generators/expressions.ts —— 加不加括號，要知道優先級
 * const PRECEDENCE_MAP = new Map([['cpp:cast', 14], ['cpp:array_at', 16], …])
 *
 * // lifters/statements.ts —— for(...) 的三個位置放得下什麼
 * const FOR_LOOP_CONCEPTS = new Set(['cpp:cast', 'cpp:comma_expr', …])
 * ```
 *
 * 括號怎麼加是**排版演算法**，for 迴圈的文法是 **C++ 語法的知識**——
 * 兩者都該留在共用檔。而「我的優先級是 14」「我放得進 for 的第一格」
 * 是**那一顆元件的性質**。
 *
 * > **共用的是演算法，不是那張表。**
 *
 * 這與 [`memberRoleOf`](../../../core/component/registry.ts) 同一個處置：
 * **消費者問性狀，不問身分。**
 *
 * ## ⚠️ 沒有登錄呼叫
 *
 * 膠囊的宣告走 `import.meta.glob` 的 eager 讀取，過渡表是**靜態 import 的 JSON**。
 * 兩者都在模組載入時就位。
 *
 * > **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
 * > （2026-08-10 記下，2026-08-11 又犯了一次——所以這裡不再犯第三次。）
 *
 * ## 過渡表只減不增
 *
 * `pending-node-traits.json` 裡的每一筆都是**還沒膠囊化**的元件。
 * 一顆搬進膠囊時，它的性狀跟著搬進 `component.json`，這裡刪掉一列。
 */
import { registeredComponents } from '../../../core/component/registry'
import 過渡 from '../pending-node-traits.json'

export interface NodeTraits {
  /** 運算子優先級（越大越緊）。沒有＝不需要括號（字面值、變數參照…）。 */
  precedence?: number
  /** 放得進 `for(…;…;…)` 的三個位置嗎。 */
  forLoopPart?: boolean
  /**
   * 在 `switch` 裡是**兜底的那一支**嗎（`default:`）。
   *
   * ⚠️ `cpp:switch` 的執行器原本寫 `caseNode.conceptId === 'cpp:default'`
   * ——**那是真的耦合**（switch 要知道哪一支不比對值），而它擋住 `default`
   * 搬進膠囊。與 `memberRoleOf` 同一個處置：**消費者問性狀，不問身分。**
   */
  defaultCase?: boolean
  /**
   * 這顆元件的宣告要在型別後面接什麼（`int` → `int*`）。
   *
   * ⚠️ `strategies.ts` 原本寫 `if (lifted.conceptId === 'cpp:pointer_declare')
   * liftedType += '*'`——**消費者依身分分派**，而它擋住那顆搬進膠囊。
   */
  typeSuffix?: string
  /**
   * 這顆節點**就是一個具名變數的參照**（`properties.name` 是那個變數名）。
   *
   * ⚠️ `cpp:var_declare_ref` 的執行器要知道「初值是不是一個變數」才決定
   * 做別名還是一般宣告，而它原本寫 `目標.conceptId === 'cpp:var_ref'`
   * ——**一顆膠囊裡提到另一顆的身分**，就近性護欄的反向檢查會指名。
   */
  variableRef?: boolean
  /**
   * 這顆是**鷹架**——L0 的積木視圖裡不該出現它。
   *
   * ⚠️ `cpp-scaffold-filter.ts` 原本逐條寫身分：
   * `node.conceptId === 'cpp:include' || … === 'cpp:include_local'` …
   * **一條 if 一顆元件**，而它擋住那幾顆搬進膠囊。
   *
   * ⚠️ 這不含 `func_def(main)` 與它的 `return`：那兩個不是「這顆是鷹架」，
   * 是「**這顆在 main 裡的時候**是鷹架」——條件在上下文，不在元件。
   * 硬塞成同一個旗標會讓 `return` 在任何地方都消失。
   */
  scaffold?: boolean
  /**
   * 這顆是 `#include` 指示詞（`properties.header` 是標頭名）。
   *
   * ⚠️ 與 `scaffold` **不是同一件事**：`using_namespace` 也是鷹架，
   * 但它**沒有標頭可以去重**。`cpp:program` 的產生器有三處要「這是不是 include」，
   * 而它們原本都寫 `n.conceptId === 'cpp:include' || n.conceptId === 'cpp:include_local'`。
   */
  includeDirective?: boolean
  /**
   * 在 `main` 裡出現時屬於鷹架（L0 的積木視圖不顯示）。
   *
   * ⚠️ 與 `scaffold` **不是同一件事**：`#include` 在哪裡都是鷹架，
   * 而 `return` 只有**在 main 裡**才是——條件在上下文，不在元件。
   * 共用一個旗標的話，`return` 在任何函式裡都會消失。
   *
   * 這條說的是「**我是那個會被 main 的鷹架吃掉的東西**」，
   * 而「在不在 main 裡」仍然由 `cpp-scaffold-filter` 判斷。
   *
   * > **可以宣告的是「我是什麼」，不是「我在哪裡時算什麼」——
   * > 所以這條性狀只講一半，另一半留在消費者手上。**
   */
  scaffoldInMain?: boolean
  /**
   * 這顆產生的是**前綴符號**，而那個符號與同類的相接會變成另一個運算子。
   *
   * ```
   * -(-x)  不能寫成 --x   （前置遞減）
   * &(&x)  不能寫成 &&x   （邏輯與）
   * *(*p)  不能寫成 **p
   * ```
   *
   * ⚠️ `cpp:negate` 的產生器原本寫
   * `childNode.conceptId === 'cpp:negate' || … 'cpp:pointer_deref' || … 'cpp:address_of'`
   * ——**一顆膠囊裡列另外兩顆的身分**，就近性護欄的反向檢查會指名。
   *
   * `!` 與 `~` **不在此列**：`!!x`、`~~x` 都是合法且意思正確的。
   */
  prefixOperator?: boolean
  /**
   * 放進 `cout << …` 鏈裡時需要括號（我的優先級低於 `<<`）。
   *
   * ⚠️ `iostream/generators.ts` 原本有一份 `COUT_NEEDS_PARENS` 身分集合。
   *
   * ⚠️ **它其實可以從 `precedence` 導出**（`<<` 是 10，三顆分別是 1／2／3），
   * 而現在不導：那會把 `cpp:var_assign`（2）也納進來，
   * 而它**不在原本的集合裡**——`cout << (x = 5)` 該不該加括號是一個
   * 行為決定，不是搬家該順手做的。**搬移不重寫。**
   */
  parenInCout?: boolean
  /**
   * 這是一個**二元運算子節點**——`properties.operator` 是那個符號。
   *
   * ⚠️ `iostream/generators.ts` 原本寫
   * `v.conceptId === 'cpp:arithmetic' || … 'cpp:compare' || … 'cpp:logic'`
   * 再去比對一份低優先權運算子清單。**清單留著**（那是 `<<` 的排版知識），
   * 換掉的只有身分那一半。
   */
  binaryOperator?: boolean
  /**
   * 優先級**隨運算子而變**時的宣告。
   *
   * ```json
   * { "default": 5, "rules": [{ "ops": ["||"], "p": 4 }] }
   * ```
   *
   * ⚠️ 與 `precedence` 互斥：一顆元件的優先級要嘛是常數，要嘛看運算子。
   * 原本是 `generators/expressions.ts` 裡的三個函式（`OPERATOR_PRECEDENCE`），
   * 而**函式寫不進 JSON**——所以改成規則表。
   */
  precedenceByOperator?: { default: number; rules: { ops: string[]; p: number }[] }
  /**
   * 這顆是**字串字面值**（`properties.value` 是那串文字）。
   *
   * ⚠️ 兩個消費者要認得它，而它們做的是同一件事：把字串**內嵌進格式字串**
   * （`cout << "x"` → `printf("x")`）。那不是任何一顆的實作，是風格轉換的知識。
   */
  stringLiteral?: boolean
  /**
   * 這顆是**換行標記**（`endl`／`'\n'`）。
   *
   * ⚠️ 三個消費者要認得它，而它們做的是同一件事：把 `cout << … << endl`
   * 轉成 `printf("…\n")`——**換行從一個節點變成格式字串裡的兩個字元**。
   * 那不是這顆元件的實作，是風格轉換的知識。
   */
  lineBreak?: boolean
  /**
   * 這顆是**具名呼叫**（`properties.name` 是被呼叫的名字）。
   *
   * ⚠️ `interpreter/executors/variables.ts` 要分辨 `A a(5)` 是建構還是求值，
   * 判斷條件是「初值是不是一個名字等於型別的呼叫」。它原本寫死
   * `arg0.conceptId === 'cpp:func_call'`——**核心層的執行器認得一顆 C++ 元件**。
   */
  namedCall?: boolean
  /**
   * 這顆在 I/O 上扮演什麼角色，以及它屬於哪一種風格。
   *
   * ```
   * cpp:print            { ioRole: 'print', ioStyle: 'iostream' }
   * cpp:print_formatted  { ioRole: 'print', ioStyle: 'cstdio'   }
   * ```
   *
   * ⚠️ `style-exceptions.ts` 是**風格轉換的規則集**，而規則天生要講出兩端
   * （「cout 風格的印 → printf 風格的印」）。原本兩端都寫死身分。
   * 拆成 `ioRole ＋ ioStyle` 之後，規則講的是
   * 「**角色相同、風格不是使用者偏好的那顆**」——兩端都由元件自己宣告。
   *
   * > **一條規則要講出兩端時，該被抽掉的不是「兩端」，是「端點的名字」。**
   */
  ioRole?: 'print' | 'input'
  ioStyle?: 'iostream' | 'cstdio'
  /**
   * 這顆是**帶索引的存取**（`properties.obj` 是容器名、`children.index` 是索引）。
   *
   * ⚠️ 兩個 I/O 執行器要認得它：`scanf("%d", &arr[i])` 與 `cin >> arr[i]`
   * 讀進來的值要寫回**陣列的某一格**，而不是一個變數。
   */
  indexedAccess?: boolean
  /**
   * 這顆是**串流輸入**（`cin >> a >> b` 那種，可以串接）。
   *
   * ⚠️ `expressions.ts` 在還原 `cin >> a >> b` 的鏈時要認出「已經是輸入的那顆」，
   * 原本寫死 `cur.conceptId === 'cpp:input'`。
   */
  streamInput?: boolean
  /** 是最單純的變數宣告嗎（`int x;`）——動態積木蒐集變數名時要分辨它。 */
  plainDeclaration?: boolean
}

const 過渡表 = 過渡.traits as Record<string, NodeTraits>

/** 有性狀宣告的全部身分——膠囊的加上過渡表的。 */
function 全部身分(): string[] {
  const 膠囊 = registeredComponents().map((c) => c.conceptId)
  return [...new Set([...膠囊, ...Object.keys(過渡表)])]
}

function 性狀(conceptId: string): NodeTraits | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  const 宣告 = (c?.manifest as { traits?: NodeTraits } | undefined)?.traits
  return 宣告 ?? 過渡表[conceptId]
}

/**
 * 這顆元件的固定優先級。
 *
 * ⚠️ 回 `undefined` 的意思是「**不需要括號**」，不是「不知道」——
 * 呼叫端把它當 100（比誰都緊）。運算子相依的優先級（`cpp:logic` 看 `||` 還是 `&&`）
 * 不在這裡：那是**同一顆元件的不同實例有不同答案**，不是一個宣告得出來的常數。
 */
export function precedenceOf(conceptId: string): number | undefined {
  return 性狀(conceptId)?.precedence
}

/** 這顆元件放得進 for 迴圈的三個位置嗎。沒宣告＝不行（保守）。 */
export function canBeForLoopPart(conceptId: string): boolean {
  return 性狀(conceptId)?.forLoopPart === true
}

/** 這顆元件是 `switch` 裡兜底的那一支嗎。沒宣告＝不是（保守）。 */
export function isDefaultCase(conceptId: string): boolean {
  return 性狀(conceptId)?.defaultCase === true
}

/** 這顆元件的宣告在型別後面接什麼。沒宣告＝什麼都不接。 */
export function typeSuffixOf(conceptId: string): string {
  return 性狀(conceptId)?.typeSuffix ?? ''
}

/** 這顆節點就是一個具名變數的參照嗎。沒宣告＝不是（保守）。 */
export function isVariableRef(conceptId: string): boolean {
  return 性狀(conceptId)?.variableRef === true
}

/** 這顆是鷹架嗎（L0 的積木視圖不顯示）。沒宣告＝不是（保守）。 */
export function isScaffold(conceptId: string): boolean {
  return 性狀(conceptId)?.scaffold === true
}

/** 這顆是 `#include` 指示詞嗎。沒宣告＝不是（保守）。 */
export function isIncludeDirective(conceptId: string): boolean {
  return 性狀(conceptId)?.includeDirective === true
}

/** 這顆產生的前綴符號會與同類相接成另一個運算子嗎。沒宣告＝不會。 */
export function isPrefixOperator(conceptId: string): boolean {
  return 性狀(conceptId)?.prefixOperator === true
}

/** 放進 `cout << …` 時需要括號嗎。沒宣告＝不用。 */
export function needsParenInCout(conceptId: string): boolean {
  return 性狀(conceptId)?.parenInCout === true
}

/** 這顆在 `main` 裡時算鷹架嗎。沒宣告＝不算（保守）。 */
export function isScaffoldInMain(conceptId: string): boolean {
  return 性狀(conceptId)?.scaffoldInMain === true
}

/** 這是二元運算子節點嗎（`properties.operator` 是符號）。沒宣告＝不是。 */
export function isBinaryOperator(conceptId: string): boolean {
  return 性狀(conceptId)?.binaryOperator === true
}

/** 這是字串字面值嗎（`properties.value` 是那串文字）。沒宣告＝不是。 */
export function isStringLiteral(conceptId: string): boolean {
  return 性狀(conceptId)?.stringLiteral === true
}

/**
 * 這個節點的優先級——固定的或隨運算子而變的。
 *
 * 回 `undefined` 的意思是「**不需要括號**」，不是「不知道」。
 */
export function precedenceOfNode(node: { conceptId: string; properties?: Record<string, unknown> }): number | undefined {
  const t = 性狀(node.conceptId)
  if (t?.precedence !== undefined) return t.precedence
  const 依運算子 = t?.precedenceByOperator
  if (!依運算子) return undefined
  const op = String(node.properties?.operator ?? '')
  for (const r of 依運算子.rules) if (r.ops.includes(op)) return r.p
  return 依運算子.default
}

/** 這顆是換行標記嗎。沒宣告＝不是。 */
export function isLineBreak(conceptId: string): boolean {
  return 性狀(conceptId)?.lineBreak === true
}

/**
 * 這顆是具名呼叫嗎。
 *
 * ⚠️ **核心層有自己的一份**（`core/component/traits.ts`）——
 * 核心不得 import 語言套件（P9），而這個模組疊了 C++ 的過渡表。
 * 兩份的差別只有過渡表：已膠囊化的元件答案相同。
 */
export { isNamedCall } from '../../../core/component/traits'

/** 這顆在 I/O 上的角色與風格。沒宣告回 `undefined`——**不猜**。 */
export function ioTraitOf(conceptId: string): { role?: string; style?: string } | undefined {
  const t = 性狀(conceptId)
  return t?.ioRole ? { role: t.ioRole, style: t.ioStyle } : undefined
}

/**
 * 找「同一個角色、指定風格」的那顆元件。
 *
 * ⚠️ 找不到回 `undefined`——**不猜**。找不到的意思是那個風格還沒有人實作，
 * 而猜一個會讓風格轉換產出一顆不存在的元件。
 */
export function ioConceptFor(role: string, style: string): string | undefined {
  for (const id of 全部身分()) {
    const t = 性狀(id)
    if (t?.ioRole === role && t?.ioStyle === style) return id
  }
  return undefined
}

/** 這顆是帶索引的存取嗎（讀進來的值要寫回某一格）。沒宣告＝不是。 */
export function isIndexedAccess(conceptId: string): boolean {
  return 性狀(conceptId)?.indexedAccess === true
}

/** 這顆是串流輸入嗎（`cin >> a >> b` 那種）。沒宣告＝不是。 */
export function isStreamInput(conceptId: string): boolean {
  return 性狀(conceptId)?.streamInput === true
}

/**
 * 這顆是**最單純的變數宣告**（`int x;`）——動態積木蒐集變數名時要分辨它。
 *
 * ⚠️ **這一條原本住在 `core/component/traits.ts`（最內層），而它是 C 家族的。**
 *
 * 判準是「**換一個語言，會不會有另一顆元件宣告它**」：
 * Python 沒有宣告（`x = 1` 是賦值），所以不會有 `py:*` 宣告 `plainDeclaration`
 * ——它只是 `cpp:var_declare` 的名字換了個寫法，是**假抽象**。
 *
 * > **依賴方向反轉了，不代表抽象被抽乾淨了。**
 * > 一個只有本語言會宣告的性狀，放在核心就是把耦合藏到更深一層——
 * > 而中立性護欄看不到它（它找身分字串，不找範疇名）。
 *
 * 唯一的消費者是 `ui/block-registrar.ts`，而 `ui` 本來就 import 語言套件
 * （25 處），所以下沉沒有代價。
 */
export function isPlainDeclaration(conceptId: string): boolean {
  return 性狀(conceptId)?.plainDeclaration === true
}
