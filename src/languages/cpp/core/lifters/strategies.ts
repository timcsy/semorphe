import type { LiftStrategyRegistry } from '../../../../core/registry/lift-strategy-registry'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import type { SemanticNode } from '../../../../core/types'
import { createNode } from '../../../../core/semantic-tree'
import { allStdModules } from '../../std'
import { conceptForContainerTemplate } from '../../../../core/component/container-templates'
// ⚠️ 元件膠囊也要算進來——第五處「從 allStdModules 推導」的地方。
// 少算的話 `vector<int> v = f()` 的初始值會被判成「沒宣告 source」而丟掉。
import { componentConcepts } from '../../../../core/component/registry'
import { plainTypeConcept } from '../../../../core/component/container-templates'
import { tryDeclaratorBranches } from '../../../../core/component/lift-branches'
// ⚠️ 共用檔呼叫膠囊匯出的**建構子**——身分字串只留在膠囊裡一處。
import { 建陣列宣告 } from '../../../../components/cpp/array_declare/lift'
import { 建前置宣告 } from '../../../../components/cpp/forward_decl/lift'
import { 建自動宣告 } from '../../../../components/cpp/var_declare_auto/lift'
import { 建靜態變數 } from '../../../../components/cpp/var_declare_static/lift'
import { qualifierConcept } from '../../../../core/component/qualifier-concepts'
import { 建字串流宣告 } from '../../../../components/cpp/istringstream_declare/lift'
import { 建樣板函式 } from '../../../../components/cpp/template_function/lift'

/**
 * 哪些容器宣告概念**有宣告 `source` 子節點**（初始值是一整個運算式）。
 *
 * ⚠️ **從 JSON 讀，不寫死。** 第一版對所有容器都掛 `source`，於是
 * `cpp_pair_declare`（`children` 是空的）收到一個**未宣告的子節點**，
 * 它的產生器不認得，來回轉換就掉了那一段——`roundtrip-cpp-utility` 立刻變紅。
 *
 * 那條紅是**既有缺陷被我的改動照出來**：`pair<int,string> p = make_pair(…)`
 * 的初始值本來就掉了，只是掉得**對稱**（辨識掉、產生也掉），所以來回轉換
 * 比對一直是綠的。記在缺陷帳，不在這裡順手擴大範圍。
 */
const 有宣告初始值來源 = new Set(
  [...allStdModules.flatMap((m) => m.concepts), ...(componentConcepts() as never[])]
    .filter((c) => (c as { children?: Record<string, unknown> }).children?.source !== undefined)
    .map((c) => (c as { conceptId: string }).conceptId),
)

/**
 * 把陣列宣告的初始值列表掛上 `values` 子槽。
 *
 * 三態（見 specs/050-repay-top-blockers/data-model.md 契約 1）：
 *   int a[3];          → 不設 values 欄位
 *   int a[3] = {};     → values: []
 *   int a[3] = {1,2};  → values: [節點, 節點]
 *
 * **做不到的時候要出聲。** 若有元素無法辨識，降低整個節點的 confidence 並記
 * 錄原因——絕不回傳一個標著 high 卻少了值的結構。那是 P6 誠實降級明文禁止的
 * 「看起來合理」的結構，也是既有教訓「靜默降級是 bug 的藏身之處」的形狀。
 */
function attachInitializer(
  node: SemanticNode,
  valueNode: AstNode | null | undefined,
  ctx: LiftContext,
): SemanticNode {
  // 沒有初始值——三態的第一態，不設欄位
  if (!valueNode) return node

  // 非初始值列表的初始化寫法（如 int a[] = "abc"）：整個當單一初始值處理
  if (valueNode.type !== 'initializer_list') {
    const single = ctx.lift(valueNode)
    if (single) {
      node.children.values = [single]
      return node
    }
    return degrade(node, `初始化寫法 ${valueNode.type} 無法辨識`)
  }

  const elements = valueNode.namedChildren
  const lifted: SemanticNode[] = []
  let lost = 0

  for (const el of elements) {
    // 巢狀列表（多維）：遞迴，層次不壓平
    if (el.type === 'initializer_list') {
      const inner = createNode('cpp_initializer_list', {})
      const withValues = attachInitializer(inner, el, ctx)
      lifted.push(withValues)
      continue
    }
    const one = ctx.lift(el)
    if (one) lifted.push(one)
    else lost++
  }

  node.children.values = lifted

  // 有元素掉了 → 必須出聲
  if (lost > 0) {
    return degrade(node, `初始值列表有 ${lost} 個元素無法辨識`)
  }
  return node
}

/** 降信心並記錄原因——「可見降級」的唯一入口 */
function degrade(node: SemanticNode, reason: string): SemanticNode {
  node.metadata = {
    ...node.metadata,
    confidence: 'inferred',
    degradationCause: 'unsupported',
    rawCode: node.metadata?.rawCode ?? reason,
  }
  return node
}

function liftSingleDeclarator(decl: AstNode, type: string, ctx: LiftContext): SemanticNode {
  // **膠囊自己的判別先問**——「宣告子長成這樣時是我」是元件的知識。
  const 認領 = tryDeclaratorBranches(decl, type, ctx)
  if (認領) return 認領

  // Array declarator: int arr[10]
  if (decl.type === 'array_declarator') return 建陣列宣告(type, decl, ctx)

  // Plain identifier: int x
  if (decl.type === 'identifier') {
    return createNode('cpp:var_declare', { name: decl.text, type })
  }

  // Bare pointer declarator without init: int* ptr;
  if (decl.type === 'pointer_declarator') {
    // ⚠️ `int* a[3]` 的 pointer_declarator 裡包的是 **array_declarator**，
    // 不是 identifier。只找 identifier 的話名字取不到，落到預設 `'ptr'`
    // ——**名字與大小都掉了**，而產出的 `int* ptr;` 看起來像一段合法程式。
    const inner = decl.namedChildren.find(c => c.type === 'array_declarator')
    if (inner) {
      // 指標陣列：元素型別帶星號，其餘與一般陣列相同
      return 建陣列宣告(`${type}*`, inner, ctx)
    }
    const ptrIdent = decl.namedChildren.find(c => c.type === 'identifier')
    const name = ptrIdent?.text ?? 'ptr'
    return createNode('cpp:pointer_declare', { name, type })
  }

  // Bare reference declarator without init: int& ref; (rare, usually has init)
  if (decl.type === 'reference_declarator') {
    const refIdent = decl.namedChildren.find(c => c.type === 'identifier')
    const name = refIdent?.text ?? 'ref'
    return createNode('cpp:var_declare_ref', { name, type })
  }

  // init_declarator: name = value
  const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
  let name = nameNode?.text ?? 'x'

  // Reference declarator: int& ref = x
  if (nameNode?.type === 'reference_declarator') {
    const refIdent = nameNode.namedChildren.find(c => c.type === 'identifier')
    name = refIdent?.text ?? 'ref'
    const valueNode = decl.childForFieldName('value')
    if (valueNode) {
      const value = ctx.lift(valueNode)
      return createNode('cpp:var_declare_ref', { name, type }, {
        initializer: value ? [value] : [],
      })
    }
    return createNode('cpp:var_declare_ref', { name, type })
  }

  // Pointer declarator: int* ptr = &x
  if (nameNode?.type === 'pointer_declarator') {
    // ⚠️ `int* a[3]` 的 pointer_declarator 裡包的是 **array_declarator**，
    // 不是 identifier。只找 identifier 的話名字取不到，落到預設 `'ptr'`
    // ——**名字與大小都掉了**，而產出的 `int* ptr;` 看起來像一段合法程式。
    const inner = nameNode.namedChildren.find(c => c.type === 'array_declarator')
    if (inner) {
      // 指標陣列：元素型別帶星號，其餘與一般陣列相同
      return attachInitializer(建陣列宣告(`${type}*`, inner, ctx), decl.childForFieldName('value'), ctx)
    }
    const ptrIdent = nameNode.namedChildren.find(c => c.type === 'identifier')
    name = ptrIdent?.text ?? 'ptr'
    const valueNode = decl.childForFieldName('value')
    if (valueNode) {
      const value = ctx.lift(valueNode)
      return createNode('cpp:pointer_declare', { name, type }, {
        initializer: value ? [value] : [],
      })
    }
    return createNode('cpp:pointer_declare', { name, type })
  }

  // Array init_declarator: int arr[10] = {...}
  if (nameNode?.type === 'array_declarator') {
    return attachInitializer(建陣列宣告(type, nameNode, ctx), decl.childForFieldName('value'), ctx)
  }

  const valueNode = decl.childForFieldName('value')
  if (valueNode) {
    // Constructor-style initialization: Type name(args) — value is argument_list
    if (valueNode.type === 'argument_list') {
      const args = valueNode.namedChildren
        .map(a => ctx.lift(a))
        .filter((n): n is NonNullable<typeof n> => n !== null)

      // `istringstream in("10 20 30")` —— 專屬概念，不落到通用的 var_declare。
      // 落到通用的話它就只是一個「型別叫 istringstream 的變數」，
      // 而 `in >> a` 沒有東西可讀。
      if (type === 'istringstream' || type === 'std::istringstream') {
        return 建字串流宣告(name, args.length > 0 ? args[0] : null)
      }
      return createNode('cpp:var_declare', { name, type, init_style: 'constructor' }, {
        initializer: args,
      })
    }
    const value = ctx.lift(valueNode)
    return createNode('cpp:var_declare', { name, type }, {
      initializer: value ? [value] : [],
    })
  }

  return createNode('cpp:var_declare', { name, type })
}

/** Lift a class member (function_definition, field_declaration) into a semantic node */
export function liftClassMember(node: AstNode, className: string, ctx: LiftContext): SemanticNode | null {
  if (node.type === 'function_definition') {
    const declNode = node.childForFieldName('declarator')
    const typeNode = node.childForFieldName('type')
    const bodyNode = node.childForFieldName('body')
    const nameNode = declNode?.childForFieldName('declarator')
    const isVirtual = node.children.some(c => !c.isNamed && c.text === 'virtual')

    // Constructor: function_definition where declarator name matches class name
    if (nameNode?.type === 'identifier' && nameNode.text === className) {
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const initListNode = node.namedChildren.find(c => c.type === 'field_initializer_list')
      const initList = initListNode ? initListNode.text.replace(/^:\s*/, '') : ''
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:constructor', { class_name: className, init_list: initList }, { params, body })
    }

    // Destructor: function_definition where declarator is destructor_name
    if (nameNode?.type === 'destructor_name') {
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:destructor', { class_name: className }, { body })
    }

    // Operator overload: function_definition where declarator is operator_name
    if (nameNode?.type === 'operator_name') {
      const op = nameNode.text.replace(/^operator/, '').trim()
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters')
      let paramType = ''
      let paramName = ''
      if (paramList) {
        const firstParam = paramList.namedChildren.find(c => c.type === 'parameter_declaration')
        if (firstParam) {
          const parsed = parseParamDeclaration(firstParam)
          paramType = parsed.type
          paramName = parsed.name
        }
      }
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:operator_overload', { return_type: returnType, operator: op, param_type: paramType, param_name: paramName }, { body })
    }

    // Check for override keyword (via virtual_specifier node in declarator)
    const hasOverride = declNode?.namedChildren.some(c => c.type === 'virtual_specifier' && c.text === 'override') ?? false

    // Override method (with or without virtual keyword)
    if (hasOverride) {
      const methodName = nameNode?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:method_override', { return_type: returnType, name: methodName }, { params, body })
    }

    // Virtual method with body
    if (isVirtual) {
      const methodName = nameNode?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp:method_virtual', { return_type: returnType, name: methodName }, { params, body })
    }

    // Regular member function → lift as func_def
    return ctx.lift(node)
  }

  if (node.type === 'field_declaration') {
    // Pure virtual: virtual void method() = 0;
    const isVirtual = node.children.some(c => !c.isNamed && c.text === 'virtual')
    const defaultVal = node.childForFieldName('default_value')
    if (isVirtual && defaultVal?.text === '0') {
      const typeNode = node.childForFieldName('type')
      const declNode = node.childForFieldName('declarator')
      const methodName = declNode?.childForFieldName('declarator')?.text ?? declNode?.namedChildren[0]?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      return createNode('cpp:method_virtual_pure', { return_type: returnType, name: methodName }, { params })
    }

    // Static member: static int count;
    const isStatic = node.namedChildren.some(c => c.type === 'storage_class_specifier' && c.text === 'static')
    if (isStatic) {
      const typeNode = node.childForFieldName('type')
      const type = typeNode?.text ?? 'int'
      const declNode = node.childForFieldName('declarator')
      const name = declNode?.text ?? 'member'
      return createNode('cpp:member_static', { type, name })
    }

    // Regular field declaration: type name; or type x, y;
    const typeNode = node.childForFieldName('type')
    const type = typeNode?.text ?? 'int'
    // Check for multi-variable declarations (e.g., double x, y;)
    const declarators = node.namedChildren.filter(c =>
      c.type === 'identifier' || c.type === 'field_identifier' ||
      c.type === 'pointer_declarator' || c.type === 'reference_declarator'
    ).filter(c => c !== typeNode) // exclude the type node itself
    if (declarators.length > 1) {
      // Multi-variable: create individual var_declare nodes wrapped in a container
      const nodes = declarators.map(d => createNode('cpp:var_declare', { type, name: d.text }))
      // Return first and add rest — use a wrapper approach
      // Actually, we need to return multiple nodes. Use the fact that struct/class member lifting
      // collects all children. Return a compound node that generateBody will flatten.
      return createNode('_multi_field', {}, { fields: nodes })
    }
    const declNode = node.childForFieldName('declarator')
    const name = declNode?.text ?? 'x'
    return createNode('cpp:var_declare', { type, name })
  }

  // Fallback: try generic lift
  return ctx.lift(node)
}


/** Extract parameters from a parameter_list node */
export function liftParamList(paramList: AstNode | null, _ctx: LiftContext): SemanticNode[] {
  if (!paramList) return []
  const params: SemanticNode[] = []
  for (const p of paramList.namedChildren) {
    if (p.type === 'parameter_declaration') {
      const { type, name } = parseParamDeclaration(p)
      params.push(createNode('param_decl', { type, name }))
    }
  }
  return params
}

export function registerCppLiftStrategies(registry: LiftStrategyRegistry): void {








  // doc comment: /** ... */ → doc_comment with structured properties
  registry.register('cpp:liftDocComment', (node) => {
    const props = parseDocComment(node.text)
    return createNode('cpp:doc_comment', props)
  })

  // preproc_include: system vs local include distinction
  registry.register('cpp:liftPreprocInclude', (node) => {
    const pathNode = node.namedChildren.find(c => c.type === 'system_lib_string' || c.type === 'string_literal')
    if (!pathNode) {
      const raw = createNode('raw_code', {})
      raw.metadata = { rawCode: node.text }
      return raw
    }
    const rawPath = pathNode.text
    if (rawPath.startsWith('<') && rawPath.endsWith('>')) {
      const header = rawPath.slice(1, -1)
      return createNode('cpp:include', { header, local: false })
    }
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      const header = rawPath.slice(1, -1)
      return createNode('cpp:include_local', { header })
    }
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: node.text }
    return raw
  })

  // function_definition: deep nested declarator extraction
  registry.register('cpp:liftFunctionDef', (node, ctx) => {
    const typeNode = node.childForFieldName('type')
    const declaratorNode = node.childForFieldName('declarator')
    const bodyNode = node.childForFieldName('body')

    let returnType = typeNode?.text ?? 'void'
    let name = 'f'
    const paramChildren: SemanticNode[] = []

    // ⚠️ `int* f(…)` 的 declarator 是 **pointer_declarator**，函式宣告子包在
    // 它裡面。不下鑽的話，`declarator` 欄位取到的是整個 `f(int* p)` 字串，
    // 於是產出 `int f(int* p)()`——**星號跑錯位置，還多出一對括號**。
    //
    // 每下鑽一層就把一顆星號還給回傳型別，這樣 `int**` 也對。
    let fnDecl = declaratorNode
    while (fnDecl?.type === 'pointer_declarator') {
      returnType += '*'
      fnDecl = fnDecl.childForFieldName('declarator')
    }

    if (fnDecl) {
      const nameNode = fnDecl.childForFieldName('declarator')
      name = nameNode?.text ?? fnDecl.namedChildren[0]?.text ?? 'f'

      const paramList = fnDecl.childForFieldName('parameters')
      if (paramList) {
        for (const param of paramList.namedChildren) {
          if (param.type === 'parameter_declaration') {
            const { type: pType, name: pName } = parseParamDeclaration(param)
            paramChildren.push(createNode('param_decl', { type: pType, name: pName }))
          }
        }
      }
    }

    const body = extractBody(bodyNode, ctx)
    return createNode('cpp:func_def', { name, return_type: returnType }, { params: paramChildren, body })
  })











  // declaration: multi-variable + array declarations
  registry.register('cpp:liftDeclaration', (node, ctx) => {
    // Detect type qualifiers: const, constexpr
    const qualifierNode = node.namedChildren.find(c => c.type === 'type_qualifier')
    const qualifier = qualifierNode?.text

    // Detect auto (placeholder_type_specifier)
    const autoNode = node.namedChildren.find(c => c.type === 'placeholder_type_specifier')

    // Detect template_type (vector<int>, map<string,int>, etc.)
    // Also check inside qualified_identifier (e.g., std::vector<int>)
    let templateTypeNode = node.namedChildren.find(c => c.type === 'template_type')
    if (!templateTypeNode) {
      const qualifiedNode = node.namedChildren.find(c => c.type === 'qualified_identifier')
      if (qualifiedNode) {
        templateTypeNode = qualifiedNode.namedChildren.find(c => c.type === 'template_type') ?? undefined
      }
    }
    if (templateTypeNode) {
      const templateName = templateTypeNode.namedChildren.find(c => c.type === 'type_identifier')?.text ?? ''
      const templateArgs = templateTypeNode.namedChildren.find(c => c.type === 'template_argument_list')
      const innerType = templateArgs ? templateArgs.text.slice(1, -1).trim() : 'int' // strip < >

      // 容器宣告概念——**從登錄表讀，不寫死**（見 core/component/container-templates.ts）。
      // 已元件化的由膠囊登錄；還沒的由 `pending-containers.ts` 的過渡表提供。
      const conceptId = conceptForContainerTemplate(templateName)
      if (conceptId) {
        const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
        const name = decl?.type === 'identifier'
          ? decl.text
          : (decl?.childForFieldName('declarator') ?? decl?.namedChildren[0])?.text ?? 'x'

        // map needs key_type and value_type as separate properties
        if (templateName === 'map') {
          const args = templateArgs?.namedChildren.filter(c => c.type === 'type_descriptor' || c.type === 'type_identifier') ?? []
          const keyType = args[0]?.text ?? 'int'
          const valueType = args[1]?.text ?? 'int'
          return createNode(conceptId, { key_type: keyType, value_type: valueType, name })
        }

        // `vector<int> v = {3,1,4}` —— 初始化列表。
        //
        // ⚠️ **原本整段被丟掉**：辨識出來的是一個沒有初始值的宣告，
        // 而**產出的程式碼也少了那一段**，所以來回轉換看起來「成功」了。
        // 只有跑起來（`v[1]` 索引越界）才會發現。
        const values: SemanticNode[] = []
        // `vector<int> v = f()` —— 初始值是**一整個運算式**，不是元素列表。
        //
        // ⚠️ 這一筆原本也被丟掉，症狀與上面的初始化列表完全相同（變數宣告成
        // 空的、產回去的程式碼少一段、來回轉換看起來「成功」）。而它的停用
        // 標記寫的是「初始化列表尚無對應概念」——**方向指錯了**：列表早就
        // 支援了，掉的是函式呼叫。照標記走會去改一段已經正確的程式碼。
        let source: SemanticNode | null = null
        if (decl && decl.type === 'init_declarator') {
          const v = decl.childForFieldName('value')
          // `{3,1,4}` 是 initializer_list；`vector<int> v(5)` 是 argument_list（不是列表初始化）
          if (v && v.type === 'initializer_list') {
            for (const item of v.namedChildren) {
              const lifted = ctx.lift(item)
              if (lifted) values.push(lifted)
            }
          } else if (v && v.type !== 'argument_list') {
            source = ctx.lift(v)
          }
        }
        if (values.length > 0) {
          return createNode(conceptId, { type: innerType, name }, { values })
        }
        if (source && 有宣告初始值來源.has(conceptId)) {
          return createNode(conceptId, { type: innerType, name }, { source: [source] })
        }
        return createNode(conceptId, { type: innerType, name })
      }

      // Unknown template type — fall through to var_declare with full template text
    }

    // Detect non-template container/stream types (string, ifstream, ofstream, stringstream)
    // These are type_identifier, possibly inside qualified_identifier (std::string, std::ifstream, etc.)
    // ⚠️ **這張表已經空了**——五顆元件各自登錄自己的型別名
    // （`core/component/container-templates.ts` 的 `registerPlainTypeConcept`）。
    // 留著空表是為了讓「查不到」與「忘了查」分得出來。
    const streamConcepts: Record<string, string> = {}
    const typeIdentNode = node.namedChildren.find(c => c.type === 'type_identifier')
    const qualifiedIdNode = node.namedChildren.find(c => c.type === 'qualified_identifier')
    // Get the final type name (e.g., "string" from "std::string" or plain "string")
    let simpleTypeName: string | null = null
    if (typeIdentNode && (streamConcepts[typeIdentNode.text] ?? plainTypeConcept(typeIdentNode.text))) {
      simpleTypeName = typeIdentNode.text
    } else if (qualifiedIdNode) {
      // Look for type_identifier inside qualified_identifier (e.g., std::string → "string")
      const innerTypeIdent = qualifiedIdNode.namedChildren.find(c => c.type === 'type_identifier')
      if (innerTypeIdent && (streamConcepts[innerTypeIdent.text] ?? plainTypeConcept(innerTypeIdent.text))) {
        simpleTypeName = innerTypeIdent.text
      }
    }
    if (simpleTypeName && (streamConcepts[simpleTypeName] ?? plainTypeConcept(simpleTypeName))) {
      const conceptId = streamConcepts[simpleTypeName] ?? plainTypeConcept(simpleTypeName)
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      const name = decl?.type === 'identifier'
        ? decl.text
        : (decl?.childForFieldName('declarator') ?? decl?.namedChildren[0])?.text ?? 'x'
      // For stream types with constructor args (e.g., ifstream fin("input.txt"))
      if (decl?.type === 'init_declarator') {
        const valueNode = decl.childForFieldName('value')
        if (valueNode?.type === 'argument_list') {
          const args = valueNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          return createNode(conceptId, { name }, { initializer: args })
        }
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return createNode(conceptId, { name }, { initializer: value ? [value] : [] })
        }
      }
      return createNode(conceptId, { name })
    }

    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
      c.type === 'template_type'
    )
    const type = typeNode?.text ?? 'int'

    // auto declaration: auto x = expr;
    if (autoNode) {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator')
      if (decl) {
        const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
        const name = nameNode?.text ?? 'x'
        const valueNode = decl.childForFieldName('value')
        const value = valueNode ? ctx.lift(valueNode) : null
        return 建自動宣告(name, value)
      }
      return 建自動宣告('x', null)
    }

    // const/constexpr declaration
    if (qualifier === 'const' || qualifier === 'constexpr') {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'pointer_declarator')
      if (decl) {
        const lifted = liftSingleDeclarator(decl, type, ctx)
        const conceptId = qualifierConcept(qualifier)
        if (!conceptId) return degrade(createNode('raw_code', {}), `修飾詞 ${qualifier} 沒有對應的元件`)
        // Use type from lifted node; append * for pointer concepts
        let liftedType = (lifted.properties.type as string) ?? type
        if (lifted.conceptId === 'cpp:pointer_declare') liftedType += '*'
        return createNode(conceptId, {
          type: liftedType,
          name: lifted.properties.name as string ?? 'x',
        }, {
          initializer: lifted.children.initializer ?? [],
        })
      }
      const conceptId = qualifierConcept(qualifier)
      if (!conceptId) return degrade(createNode('raw_code', {}), `修飾詞 ${qualifier} 沒有對應的元件`)
      return createNode(conceptId, { type, name: 'x' })
    }

    // Static declarations: static int count = 0;
    const storageSpec = node.namedChildren.find(c => c.type === 'storage_class_specifier')
    if (storageSpec?.text === 'static') {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      if (decl) {
        if (decl.type === 'identifier') {
          return 建靜態變數(type, decl.text, null)
        }
        const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
        const name = nameNode?.text ?? 'x'
        const valueNode = decl.childForFieldName('value')
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return 建靜態變數(type, name, value)
        }
        return 建靜態變數(type, name, null)
      }
      return createNode('cpp:member_static', { name: 'x', type })
    }

    // Forward function declarations: void listp(int *, int); → structured forward_decl
    const funcDeclarator = node.namedChildren.find(c => c.type === 'function_declarator')
    if (funcDeclarator) {
      const nameNode = funcDeclarator.namedChildren.find(c => c.type === 'identifier')
      const paramList = funcDeclarator.childForFieldName('parameters')
        ?? funcDeclarator.namedChildren.find(c => c.type === 'parameter_list')
      const paramChildren: SemanticNode[] = []
      if (paramList) {
        for (const p of paramList.namedChildren) {
          if (p.type === 'parameter_declaration') {
            const { type: pType, name: pName } = parseParamDeclaration(p)
            paramChildren.push(createNode('param_decl', { type: pType, name: pName }))
          }
        }
      }
      return 建前置宣告(type, nameNode?.text ?? 'f', paramChildren)
    }

    const declarators = node.namedChildren.filter(c =>
      c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'array_declarator' ||
      c.type === 'pointer_declarator' || c.type === 'reference_declarator'
    )

    if (declarators.length === 0) {
      return createNode('cpp:var_declare', { name: 'x', type })
    }

    const liftedNodes = declarators.map(decl => liftSingleDeclarator(decl, type, ctx))

    if (liftedNodes.length === 1) return liftedNodes[0]

    return createNode('cpp:var_declare', { type }, { declarators: liftedNodes })
  })



  // template_declaration: template <typename T> T func(T a) { ... }
  registry.register('cpp:liftTemplateFunction', (node, ctx) => {
    const templateParams = node.namedChildren.find(c => c.type === 'template_parameter_list')
    const typeParam = templateParams?.namedChildren.find(c =>
      c.type === 'type_parameter_declaration'
    )
    const t = typeParam?.namedChildren.find(c => c.type === 'type_identifier')?.text ?? 'T'

    const funcDef = node.namedChildren.find(c => c.type === 'function_definition')
    if (!funcDef) return null

    const returnTypeNode = funcDef.childForFieldName('type')
    const returnType = returnTypeNode?.text ?? 'T'

    const declarator = funcDef.childForFieldName('declarator')
    const funcName = declarator?.childForFieldName('declarator')?.text
      ?? declarator?.namedChildren.find(c => c.type === 'identifier')?.text
      ?? 'myFunc'

    const paramList = declarator?.namedChildren.find(c => c.type === 'parameter_list')
    const params: SemanticNode[] = []
    if (paramList) {
      for (const p of paramList.namedChildren) {
        if (p.type === 'parameter_declaration') {
          const { type, name } = parseParamDeclaration(p)
          params.push(createNode('cpp:var_declare', { type, name }))
        }
      }
    }

    const bodyNode = funcDef.childForFieldName('body')
    const body = extractBody(bodyNode ?? null, ctx)

    return 建樣板函式(t, returnType, funcName, params, body)
  })

  // cast_expression: (Type*)malloc(size) → cpp_malloc; fallback → cpp_cast
  registry.register('cpp:liftCastExpression', (node, ctx) => {
    const typeNode = node.childForFieldName('type')
    const valueNode = node.childForFieldName('value')
    const targetType = typeNode?.text ?? 'int'

    // Check for (Type*)malloc(...) pattern → cpp_malloc
    if (valueNode?.type === 'call_expression') {
      const funcNode = valueNode.childForFieldName('function')
      if (funcNode?.text === 'malloc') {
        const argsNode = valueNode.childForFieldName('arguments')
        const argChildren = argsNode?.namedChildren ?? []
        const size = argChildren[0] ? ctx.lift(argChildren[0]) : null
        return createNode('cpp:malloc', { type: targetType }, { size: size ? [size] : [] })
      }
    }

    // Default: regular cast
    const value = valueNode ? ctx.lift(valueNode) : null
    return createNode('cpp:cast', { target_type: targetType }, {
      value: value ? [value] : [],
    })
  })



  // count_loop: add inclusive property based on operator (< vs <=)
  registry.register('cpp:liftCountFor', (node, ctx) => {
    const initNode = node.childForFieldName('initializer')
    const condNode = node.childForFieldName('condition')
    const updateNode = node.childForFieldName('update')
    const bodyNode = node.childForFieldName('body')

    if (!initNode || initNode.type !== 'declaration') return null
    if (!condNode || condNode.type !== 'binary_expression') return null
    if (!updateNode) return null

    // Only match ascending count loops: condition must be < or <=
    const condOp = condNode.children.find(c => !c.isNamed)?.text
    if (condOp !== '<' && condOp !== '<=') return null

    // Accept i++, ++i, or i += 1
    if (updateNode.type !== 'update_expression' && !isCountingUpdate(updateNode)) return null

    const decl = initNode.namedChildren.find(c => c.type === 'init_declarator')
    const varName = decl
      ? (decl.childForFieldName('declarator') ?? decl.namedChildren[0])?.text ?? 'i'
      : extractDeclVarName(initNode)

    // Verify condition and update use the same variable
    const condLeft = condNode.childForFieldName('left')?.text
    const updateVar = updateNode.type === 'update_expression'
      ? updateNode.namedChildren[0]?.text
      : updateNode.childForFieldName('left')?.text
    if (condLeft !== varName || updateVar !== varName) return null

    const fromNode = decl
      ? (decl.childForFieldName('value') ?? decl.namedChildren[1])
      : null
    const toNode = condNode.childForFieldName('right')
    const op = condNode.children.find(c => !c.isNamed)?.text
    const inclusive = op === '<=' ? 'TRUE' : 'FALSE'

    const from = fromNode ? ctx.lift(fromNode) : null
    const to = toNode ? ctx.lift(toNode) : null
    const body = extractBody(bodyNode, ctx)

    return createNode('cpp:loop_count', { var_name: varName, inclusive }, {
      from: from ? [from] : [],
      to: to ? [to] : [],
      body,
    })
  })
}

/** Known compound type prefixes for text-based fallback parsing */
const COMPOUND_TYPE_PREFIXES = [
  'unsigned long long', 'long long', 'unsigned long', 'unsigned int',
  'unsigned short', 'unsigned char', 'long double', 'signed char',
]

/** Parse a parameter_declaration AST node into { type, name } */
export function parseParamDeclaration(param: AstNode): { type: string; name: string } {
  const qualifierNode = param.namedChildren.find(c => c.type === 'type_qualifier')
  const typeNode = param.namedChildren.find(c =>
    c.type === 'primitive_type' || c.type === 'type_identifier' ||
    c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
    c.type === 'template_type'
  )
  const declNode = param.namedChildren.find(c =>
    c.type === 'identifier' || c.type === 'pointer_declarator' ||
    c.type === 'reference_declarator' || c.type === 'array_declarator'
  )

  // If we have structured children, use them
  if (typeNode || declNode) {
    const qualifier = qualifierNode?.text ? qualifierNode.text + ' ' : ''
    let type = qualifier + (typeNode?.text ?? 'int')
    let name = ''

    if (declNode) {
      if (declNode.type === 'pointer_declarator') {
        type += '*'
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? ''
      } else if (declNode.type === 'reference_declarator') {
        type += '&'
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? ''
      } else if (declNode.type === 'array_declarator') {
        // int arr[] → type stays, name is the identifier inside
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? declNode.namedChildren[0]?.text ?? ''
        type += '[]'
      } else {
        name = declNode.text
      }
    }

    return { type, name }
  }

  // Fallback: parse from text (handles mock nodes and edge cases)
  return parseParamText(param.text.trim())
}

/** Parse a parameter text like "long long x" or "int *" into { type, name } */
function parseParamText(text: string): { type: string; name: string } {
  // Try compound type prefixes first
  for (const ct of COMPOUND_TYPE_PREFIXES) {
    if (text.startsWith(ct + ' ')) {
      const rest = text.slice(ct.length).trim()
      if (rest.startsWith('*') || rest.startsWith('&')) {
        return { type: ct + rest[0], name: rest.slice(1).trim() }
      }
      return { type: ct, name: rest }
    }
    if (text === ct) return { type: ct, name: '' }
  }
  // Simple: first token is type, rest is name
  const parts = text.split(/\s+/)
  if (parts.length === 1) return { type: parts[0], name: '' }
  return { type: parts[0], name: parts.slice(1).join(' ') }
}

/** Check if node is i += 1 (assignment_expression/augmented_assignment_expression with += and right == '1') */
function isCountingUpdate(node: AstNode): boolean {
  // tree-sitter C++ uses assignment_expression for compound assignments like +=
  if (node.type !== 'assignment_expression' && node.type !== 'augmented_assignment_expression') return false
  const op = node.children.find(c => !c.isNamed)?.text
  const right = node.childForFieldName('right')
  return op === '+=' && right?.text === '1'
}

/** Extract variable name from a declaration without init_declarator (e.g., `int i`) */
function extractDeclVarName(init: AstNode): string {
  const ident = init.namedChildren.find(c => c.type === 'identifier')
  return ident?.text ?? 'i'
}

export function extractBody(node: AstNode | null, ctx: LiftContext): SemanticNode[] {
  if (!node) return []
  const lifted = ctx.lift(node)
  if (!lifted) return []
  if (lifted.conceptId === '_compound') {
    return lifted.children.body ?? []
  }
  return [lifted]
}

/** Parse a doc comment into structured properties */
function parseDocComment(text: string): Record<string, string> {
  // Strip /** and */
  let body = text
  if (body.startsWith('/**')) body = body.slice(3)
  if (body.endsWith('*/')) body = body.slice(0, -2)
  // Clean up lines: remove leading whitespace and *
  const lines = body.split('\n').map(l => l.replace(/^\s*\*?\s?/, '').trim()).filter(l => l.length > 0)

  const props: Record<string, string> = {}
  const briefLines: string[] = []
  let paramIdx = 0

  for (const line of lines) {
    if (line.startsWith('@brief ')) {
      briefLines.push(line.slice(7).trim())
    } else if (line.startsWith('@param ')) {
      const rest = line.slice(7).trim()
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx > 0) {
        props[`param_${paramIdx}_name`] = rest.slice(0, spaceIdx)
        props[`param_${paramIdx}_desc`] = rest.slice(spaceIdx + 1).trim()
      } else {
        props[`param_${paramIdx}_name`] = rest
        props[`param_${paramIdx}_desc`] = ''
      }
      paramIdx++
    } else if (line.startsWith('@return ') || line.startsWith('@returns ')) {
      const tag = line.startsWith('@returns ') ? '@returns ' : '@return '
      props.return_desc = line.slice(tag.length).trim()
    } else if (!line.startsWith('@')) {
      briefLines.push(line)
    }
  }

  props.brief = briefLines.join('\n')
  return props
}
