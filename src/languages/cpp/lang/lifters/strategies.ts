import type { LiftStrategyRegistry } from '../../../../core/registry/lift-strategy-registry'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import type { SemanticNode } from '../../../../core/types'
import { createNode } from '../../../../core/semantic-tree'
import { allStdModules } from '../../std'
import { componentForContainerTemplate, propsForContainerTemplate } from '../../../../core/component/container-templates'
import { aggregateListFor } from '../../../../core/component/aggregate-nodes'
// ⚠️ 元件膠囊也要算進來——第五處「從 allStdModules 推導」的地方。
// 少算的話 `vector<int> v = f()` 的初始值會被判成「沒宣告 source」而丟掉。
import { componentComponents } from '../../../../core/component/registry'
import { plainTypeComponent } from '../../../../core/component/container-templates'
import { tryDeclaratorBranches } from '../../../../core/component/lift-branches'
// ⚠️ 共用檔呼叫膠囊匯出的**建構子**——身分字串只留在膠囊裡一處。
import { buildArrayDeclare } from '../../../../components/cpp/array_declare/lift'
import { buildArrayAt } from '../../../../components/cpp/array_at/lift'
import { buildForwardDecl } from '../../../../components/cpp/forward_decl/lift'
import { buildAutoDeclare } from '../../../../components/cpp/var_declare_auto/lift'
import { buildDeclareSequence } from '../../../../components/cpp/var_declare_sequence/lift'
import { buildStaticVar } from '../../../../components/cpp/var_declare_static/lift'
import { buildRawCode } from '../../../../components/cpp/raw_code/lift'
import { qualifierComponent } from '../../../../core/component/qualifier-components'
import { buildStringStreamDecl } from '../../../../components/cpp/istringstream_declare/lift'
import { buildTemplateFunc } from '../../../../components/cpp/template_function/lift'
import { buildConstructor } from '../../../../components/cpp/constructor/lift'
import { buildDestructor } from '../../../../components/cpp/destructor/lift'
import { buildMethodVirtual } from '../../../../components/cpp/method_virtual/lift'
import { buildMethodOverride } from '../../../../components/cpp/method_override/lift'
import { buildMethodVirtualPure } from '../../../../components/cpp/method_virtual_pure/lift'
import { buildOperatorOverload } from '../../../../components/cpp/operator_overload/lift'
import { buildCast } from '../../../../components/cpp/cast/lift'
import { buildPointerDeclare } from '../../../../components/cpp/pointer_declare/lift'
import { buildVarDeclareRef } from '../../../../components/cpp/var_declare_ref/lift'
import { buildMemberStatic } from '../../../../components/cpp/member_static/lift'
import { typeSuffixOf } from '../node-traits'
import { buildIncludeLocal } from '../../../../components/cpp/include_local/lift'
import { buildDocComment } from '../../../../components/cpp/doc_comment/lift'
import { buildMalloc } from '../../../../components/cpp/malloc/lift'
import { buildLoopCount } from '../../../../components/cpp/loop_count/lift'
import { buildInclude } from '../../../../components/cpp/include/lift'
import { buildVarDeclare } from '../../../../components/cpp/var_declare/lift'
import { buildVarRef } from '../../../../components/cpp/var_ref/lift'
import { buildFuncDef } from '../../../../components/cpp/func_def/lift'
import { buildVarAssign } from '../../../../components/cpp/var_assign/lift'
import { buildInitializerList } from '../../../../components/cpp/initializer_list/lift'

/**
 * **把參數的型別文字，正規化成宣告那一側用的同一個詞彙。**
 *
 * ```
 * map<char,int>&   → map        （容器樣板，問登錄表）
 * const vector<int>& → vector
 * string&          → string      （非樣板的型別名，問另一張登錄表）
 * int              → int         （認不得就原樣回傳——誠實的粗略值）
 * ```
 *
 * ⚠️ **認不得時回傳原文，不猜**：這張表的消費者問的是「它是不是 map」，
 *    而一個回答「我不知道」的值與一個猜錯的值，後者才會讓 `a[i]` 被判成對照表。
 */
function normalizeParamType(raw: string): string {
  const bare = raw.replace(/\bconst\b/g, '').replace(/[&*\s]/g, '')
  const base = bare.includes('<') ? bare.slice(0, bare.indexOf('<')) : bare
  if (base === '') return raw
  const id = componentForContainerTemplate(base) ?? plainTypeComponent(base)
  if (!id) return raw
  // `cpp:map_declare` → `map`；與 `recordDeclaration` 從身分導出的那個詞彙一致。
  return /^[a-z]+:(\w+?)_declare$/.exec(id)?.[1] ?? raw
}

/**
 * **這個宣告的宣告子形狀，具體型別那幾支讀得懂嗎？**
 *
 * 「具體型別那幾支」＝ `string`／`stringstream`／`vector`／`map`… 那些**認領
 * 一個型別名**的分支。它們讀的是 `name` 與 `initializer` 兩樣東西。
 *
 * ## 🔴 它原本用一個 `?? 'x'` 把三種災難蓋起來
 *
 * 拿學生的競賽練習當語料量到（`tests/probes/studycpp-*`，2026-09-09）：
 *
 * ```
 * string A[100];        →  string x;          🔴 陣列、大小、名字一起蒸發
 * string* p;            →  string x;          🔴 指標與名字蒸發
 * string s, t, u;       →  string s;          🔴 第二、三個變數蒸發
 * vector<int> v[10];    →  vector<int> x;     🔴 同上
 * ```
 *
 * ⚠️ **而它們全部不出聲**：lift 殘差是 0、積木長得很正常、產出的程式碼
 * 編得過——只是**它是另一支程式**。
 *
 * > **一個 `?? '預設值'` 讓「我沒認出來」與「它本來就長這樣」
 * > 長得一模一樣**（`CLAUDE.md` 的靜默降級反模式）。
 *
 * ## 🟢 而退路早就在了
 *
 * 通用的宣告路徑**本來就處理陣列、指標與多宣告子**（`int a[10], b[20];`
 * 走的就是它）。這支判別器要做的只是讓那幾支**不要攔截它們讀不懂的**。
 *
 * ⚠️ 代價講明：`string A[100];` 之後的身分是 `cpp:array_declare type=string`，
 * 不是 `cpp:string_declare`——**少一顆專屬積木，換一支正確的程式**。
 *
 * @returns 剛好一個宣告子，而它是裸名字、初始化、或最令人困惑的解析
 */
/**
 * **樣板引數被省略時（CTAD），從填充值身上把它推回來**——只推【證得出來】的。
 *
 * ```cpp
 * vector dp(w+1, vector<int>(n+1));   →  元素型別是 vector<int>   語料 AP325/6/6_9.cpp
 * ```
 *
 * 🔴 **「證得出來」是這支的判準，不是「猜得到」**：填充值是
 * `vector<int>(n+1)` 這種**呼叫一個樣板**的形狀時，那個樣板的原文**就是**型別
 * ——不需要推論。其餘形狀（一個變數、一個運算式）回 `undefined`，
 * 讓它走原本那條路（誠實降級），而不是編一個型別出來。
 *
 * > **一個推導不出來時會猜的推導器，
 * > 與一個推導錯了的推導器在型別表上長得一樣。**
 */
function ctadElemType(fill: AstNode): string | undefined {
  if (fill.type === 'call_expression') {
    const fn = fill.childForFieldName('function')
    return fn?.type === 'template_function' ? fn.text : undefined
  }
  if (fill.type === 'number_literal') return fill.text.includes('.') ? 'double' : 'int'
  if (fill.type === 'string_literal') return 'string'
  if (fill.type === 'char_literal') return 'char'
  return undefined
}

/** 一個宣告底下，哪些子節點是「宣告子」。 */
const DECLARATOR_SHAPES = new Set([
  'init_declarator', 'identifier', 'array_declarator',
  'pointer_declarator', 'reference_declarator', 'function_declarator',
])


/**
 * **這個宣告的每一個宣告子，都是「一個變數」嗎？**
 *
 * ```
 * vector<int> a;              identifier
 * vector<int> a = {1};        init_declarator
 * vector<int> a(n);           function_declarator   ← 最令人困惑的解析
 * vector<int> a[10];          array_declarator      ← 🔴 不是（那是陣列，另一顆概念）
 * vector<int>* p;             pointer_declarator    ← 🔴 不是
 * ```
 *
 * 🔴 **回傳全部，不是第一個。** `vector<int> C(n), V(n);` 有兩個宣告子，
 * 而在此之前每一條路都只讀得到第一個——第二個安靜地蒸發。
 *
 * @returns 宣告子們（至少一個），或 `null`（有讀不懂的形狀 → 讓開）
 */
/**
 * **這個 `f(…)` 其實是一個帶建構引數的變數嗎？**
 *
 * 最令人困惑的解析（most vexing parse）：`int a(n);` 與 `int f(int);`
 * 在文法上同形，而它們是兩件完全不同的事。
 *
 * 🟢 判準是**問宣告登記處**：括號裡每一個「參數」都是一個**宣告過的名字**
 * ⟹ 那不是型別，是引數 ⟹ 這是一個變數定義。
 *
 * ```
 * int a(n);        n 宣告過      → true   （變數）
 * int f(int);      primitive_type → false  （函式）
 * void f(MyType);  MyType 沒宣告過 → false （函式）
 * int f();         沒有參數        → false  （零引數的 `int f()` 一律當函式
 *                                            ——`int a();` 在 C++ 裡本來就是函式宣告）
 * ```
 *
 * ⚠️ **拿不準的一律回 `false`**——把函式宣告誤判成變數，會讓一支程式的
 * 前置宣告整批消失；反過來只是維持今天的行為。
 */
function looksLikeCtorCall(fnDecl: AstNode, ctx: LiftContext): boolean {
  // 名字本身要是裸識別字（`int (*p)(int)` 那種不算）
  if (!fnDecl.namedChildren.some((c) => c.type === 'identifier')) return false
  const params = fnDecl.namedChildren.find((c) => c.type === 'parameter_list')
  const items = params?.namedChildren ?? []
  if (items.length === 0) return false
  return items.every((pd) => {
    const inner = pd.namedChildren[0]
    if (!inner || pd.namedChildren.length !== 1) return false
    if (inner.type !== 'type_identifier') return false
    return ctx.data.lookup(inner.text) !== null
  })
}

/**
 * 這顆概念的 `initializer` 接點裝得下**多個**嗎。
 *
 * ⚠️ **從宣告讀，不寫清單**：簡寫（`"initializer": "expression"`）是一個；
 * 物件形式（`{ allowed: […], max: n }`）才可能是多個。
 */
function acceptsManyInitializers(componentId: string): boolean {
  const all = [...allStdModules.flatMap((m) => m.components), ...(componentComponents() as never[])]
  const c = all.find((x) => (x as { componentId?: string }).componentId === componentId) as
    { slots?: Record<string, unknown>; properties?: { name?: string }[] } | undefined
  if (c === undefined) return false
  // 🔴 **宣告了 `ctorCount` 就是明說「我收 N 個」**
  //
  // ⚠️ 第一版漏了這一條，於是 `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);`
  // 整句被降級成殘差——**六個腳位的液晶是 Arduino 那一軌的主角之一**。
  // 那幾顆的 `initializer` 寫的是簡寫（一個），而**它們的真實契約在
  // `ctorCount` 那一格上**：插槽開幾個由它決定。
  //
  // > **一個接點能裝幾個，可能寫在別的地方——
  // > 只讀一處就下判斷，會把「宣告過了」讀成「沒宣告」。**
  if ((c.properties ?? []).some((pp) => pp?.name === 'ctorCount')) return true
  const slot = c.slots?.initializer
  if (slot === undefined) return false
  if (typeof slot === 'string') return false
  const max = (slot as { max?: number }).max
  return max === undefined || max > 1
}

function variableDeclarators(node: AstNode): AstNode[] | null {
  const found = node.namedChildren.filter((c) => DECLARATOR_SHAPES.has(c.type))
  if (found.length === 0) return null
  return found.every(isPlainVariableDeclarator) ? found : null
}

/**
 * 一個宣告子是「就是一個變數」嗎——⚠️ **裡面包著參考或指標的不算**。
 *
 * ```
 * a          ✅            &r = x     🔴 那是參考，另一顆概念
 * a = 1      ✅            *p = &x    🔴 那是指標
 * a(n)       ✅            a[10]      🔴 那是陣列
 * ```
 *
 * 🔴 不擋的話 `stack<int>& r = a0;` 會被這一支認領，而它讀出來的名字是
 * **`"& r"`**（星號與 `&` 跑進名字裡），初始值也掉了——產出 `stack<int> & r;`
 * 是**編不過的程式碼**（參考一定要初始化）。
 *
 * 🟢 讓開之後走通用路徑，那裡有 `buildVarDeclareRef`。
 */
function isPlainVariableDeclarator(c: AstNode): boolean {
  if (c.type === 'identifier') return true
  if (c.type === 'function_declarator') {
    /**
     * 🔴 **空的參數列沒有歧義可言**（2026-09-17）——`map<char,int> f();`
     * 在 C++ 裡**一定**是一個函式宣告，而不是一個變數。
     *
     * 「最令人困惑的解析」只在**有引數**的時候咬人（`DHT dht(DHTPIN, DHT11)`
     * 的引數看起來像參數宣告）。而 `T f()` 連一個可以被誤讀的東西都沒有
     * ——C++ 自己的規則就是「它是函式」。
     *
     * 在此之前它被認成一個叫 `f` 的容器變數，於是那一行的**前置宣告消失**，
     * 產出 `map<char, int> f;`——合法，而之後 `f()` 找不到那個函式。
     *
     * > **一個為了「有引數時的歧義」而放寬的判準，會在【沒有引數】時
     * > 把一個本來沒有歧義的東西也讀錯。**
     */
    const params = c.namedChildren.find((x) => x.type === 'parameter_list')
    if (params && params.namedChildren.length === 0) return false
    return c.namedChildren.find((x) => x.type === 'identifier') !== undefined
      && !c.namedChildren.some((x) => x.type === 'pointer_declarator' || x.type === 'reference_declarator')
  }
  if (c.type !== 'init_declarator') return false
  const inner = c.childForFieldName('declarator') ?? c.namedChildren[0]
  return inner?.type === 'identifier'
}

/** 一個宣告子拆出來的東西。空的那幾格代表「這個宣告子沒有那一樣」。 */
interface CtorSlots {
  name: string
  /** `= {1,2}` 的元素 */
  values: SemanticNode[]
  /** `(n)` 或 `(n, 0)` 的第一個引數 */
  size: SemanticNode | null
  /** `(n, 0)` 的第二個引數 */
  fill: SemanticNode | null
  /** `= f()`——初始值是一整個運算式，不是元素列表 */
  source: SemanticNode | null
}

/**
 * **讀一個宣告子**——三種形狀走同一支。
 *
 * 🔴 這一支是從容器分支裡抽出來的（2026-09-10）。抽它的理由不是整潔：
 * 那段邏輯原本只被呼叫**一次**，所以「有沒有第二個宣告子」這個問題
 * 從來沒有機會被問。
 *
 * ## ⚠️ 建構引數有兩個住處，而它們的形狀不同
 *
 * ```
 * vector<int> v(5);   init_declarator ＋ argument_list      引數就是運算式
 * vector<int> v(n);   function_declarator ＋ parameter_list 引數包在 parameter_declaration 裡，
 *                                                            而它的「型別」其實是識別字
 * ```
 */
function ctorSlots(decl: AstNode, ctx: LiftContext): CtorSlots {
  const out: CtorSlots = { name: '', values: [], size: null, fill: null, source: null }

  if (decl.type === 'identifier') {
    out.name = decl.text
    return out
  }

  if (decl.type === 'function_declarator') {
    out.name = decl.namedChildren.find((c) => c.type === 'identifier')?.text ?? ''
    const params = decl.namedChildren.find((c) => c.type === 'parameter_list')
    const args = (params?.namedChildren ?? [])
      .map((pd) => {
        const inner = pd.namedChildren[0]
        if (!inner) return null
        // 🔴 **一個「引數」自己也可能是最令人困惑的解析**
        //
        // ```cpp
        // vector<vector<int>> g(M, vector<int>(N));
        //                          ^^^^^^^^^^^^^^ ← template_type ＋
        //                                            abstract_function_declarator
        // ```
        //
        // 只取 `namedChildren[0]` 的話拿到 `vector<int>` 而 **`(N)` 安靜地掉了**
        // ——產出的 `vector<int>` 是一個裸型別，下一次讀回來就是殘差。
        //
        // ⚠️ 這一層**不再往下猜**：把原文原封帶出去（P6 誠實降級）。
        // > **看不懂的時候，帶著原文比帶著一半的理解安全。**
        if (pd.namedChildren.length > 1) return buildRawCode(pd.text)
        return inner.type === 'type_identifier' ? buildVarRef(inner.text) : ctx.lift(inner)
      })
      .filter((n): n is SemanticNode => n !== null)
    if (args.length >= 1) out.size = args[0]
    if (args.length >= 2) out.fill = args[1]
    return out
  }

  // init_declarator
  const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
  out.name = nameNode?.text ?? ''
  const v = decl.childForFieldName('value')
  if (v?.type === 'initializer_list') {
    for (const item of v.namedChildren) {
      const lifted = ctx.lift(item)
      if (lifted) out.values.push(lifted)
    }
  } else if (v?.type === 'argument_list') {
    // 單一引數是「幾個元素」（`vector<int> v(5)`）；
    // 兩個引數是「幾個、每個是什麼」（`vector<int> v(5, 7)`）。
    if (v.namedChildren.length >= 1) out.size = ctx.lift(v.namedChildren[0])
    if (v.namedChildren.length >= 2) out.fill = ctx.lift(v.namedChildren[1])
  } else if (v) {
    out.source = ctx.lift(v)
  }
  return out
}

function claimsSimpleDeclarator(node: AstNode): boolean {
  const found = node.namedChildren.filter((c) => DECLARATOR_SHAPES.has(c.type))
  if (found.length !== 1) return false
  const t = found[0].type
  /**
   * 🔴 **帶下標的宣告子要讓開**（2026-09-16，模糊測試抓到的）。
   *
   * `init_declarator` 裡面可能包著一個 `array_declarator`：
   *
   *     string w[3];                → array_declarator     🟢 讓開，array_declare 接走
   *     string w[3] = {"a","b"};    → init_declarator
   *                                    └ array_declarator  🔴 這一層以前沒看
   *
   * 只看外層的話這一支會認領它，而名字被抽成**整串 `w[3]`**
   * ——於是 `w` 根本沒有被宣告，`w[1]` 拋 `UNDECLARED_VAR: w`。
   *
   * ⚠️ 症狀不對稱，所以很難發現：**沒有初始值時是好的**
   * （那時外層就是 `array_declarator`，這道閘本來就擋得住）。
   *
   * > **一道只看最外層形狀的閘，會在「同一個形狀多包了一層」時失效
   * > ——而多包的那一層正是「它有初始值」。**
   */
  const inner = found[0].namedChildren?.find((c) => DECLARATOR_SHAPES.has(c.type))
  if (t === 'init_declarator' && inner?.type === 'array_declarator') return false
  return t === 'init_declarator' || t === 'identifier' || t === 'function_declarator'
}


/**
 * 哪些容器宣告概念**有宣告 `source` 子節點**（初始值是一整個運算式）。
 *
 * ⚠️ **從 JSON 讀，不寫死。** 第一版對所有容器都掛 `source`，於是
 * `cpp_pair_declare`（`slots` 是空的）收到一個**未宣告的子節點**，
 * 它的產生器不認得，來回轉換就掉了那一段——`roundtrip-cpp-utility` 立刻變紅。
 *
 * 那條紅是**既有缺陷被我的改動照出來**：`pair<int,string> p = make_pair(…)`
 * 的初始值本來就掉了，只是掉得**對稱**（辨識掉、產生也掉），所以來回轉換
 * 比對一直是綠的。記在缺陷帳，不在這裡順手擴大範圍。
 */
const hasInitSourceDecl = new Set(
  [...allStdModules.flatMap((m) => m.components), ...(componentComponents() as never[])]
    .filter((c) => (c as { slots?: Record<string, unknown> }).slots?.source !== undefined)
    .map((c) => (c as { componentId: string }).componentId),
)

/**
 * 哪些容器宣告概念**有宣告 `size` 子節點**（`vector<int> v(5)` 的建構子引數）。
 *
 * ⚠️ 與上面同一條理由：**從 JSON 讀，不寫死**。而它要解決的是一個
 * 「被正確地排除、然後沒有人接住」的缺陷——見下方 `argument_list` 那一段。
 */
/**
 * 哪些容器宣告概念**有宣告 `values` 子節點**（`vector<int> v = {1,2}`）。
 *
 * ⚠️ 與 `hasSizeDecl` 同一條理由：**從 JSON 讀，不寫死**。
 * 🔴 在此之前 `values` 是**無條件掛上去**的，而 `map` 靠一個提前 return 躲開
 * ——也就是說那條規則寫在控制流裡，不在宣告裡。一個沒有宣告 `values` 的
 * 第三顆容器出現時，它會安靜地收到一個產生器不認得的子節點。
 */
const hasValuesDecl = new Set(
  [...allStdModules.flatMap((m) => m.components), ...(componentComponents() as never[])]
    .filter((c) => (c as { slots?: Record<string, unknown> }).slots?.values !== undefined)
    .map((c) => (c as { componentId: string }).componentId),
)

const hasSizeDecl = new Set(
  [...allStdModules.flatMap((m) => m.components), ...(componentComponents() as never[])]
    .filter((c) => (c as { slots?: Record<string, unknown> }).slots?.size !== undefined)
    .map((c) => (c as { componentId: string }).componentId),
)

/**
 * **樣板引數是一個「大小」，不是一個型別**——`bitset<26> bs;`（2026-09-19）。
 *
 * 上面那條容器宣告的路，樣板引數是這樣讀的：
 *
 * ```ts
 * const innerType = templateArgs.text.slice(1, -1).trim()   // → "26"
 * … { type: innerType, name: nm }
 * ```
 *
 * 🔴 對 `bitset<26>` 那會把**一個大小**裝進一個叫 `type` 的字串屬性
 * ——而第七十二條護欄（字串屬性不得裝結構）追的正是這一族。
 *
 * 🟢 **判準是那顆元件自己宣告了什麼**（與下面 `twoArgKeys` 同一個做法）：
 * **有 `size` 接點、而沒有 `type` 屬性** ⟹ 它的樣板引數是一個大小。
 *
 * ⚠️ 而「大小是接點不是屬性」在這個 repo 已經是慣例：
 * 一般陣列的 `size`、二維陣列的 `rows`／`cols`（第 190 刀從屬性換過來的）。
 *
 * > **同一個問題有兩種答案的形狀時，先讓它們變成一種。**
 */
const templateArgIsSize = new Set(
  [...allStdModules.flatMap((m) => m.components), ...(componentComponents() as never[])]
    .filter(
      (c) =>
        (c as { slots?: Record<string, unknown> }).slots?.size !== undefined &&
        !((c as { properties?: { name?: string }[] }).properties ?? []).some((x) => x.name === 'type'),
    )
    .map((c) => (c as { componentId: string }).componentId),
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
      node.slots.values = [single]
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
      const inner = buildInitializerList([])
      const withValues = attachInitializer(inner, el, ctx)
      lifted.push(withValues)
      continue
    }
    const one = ctx.lift(el)
    if (one) lifted.push(one)
    else lost++
  }

  node.slots.values = lifted

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

/**
 * 剝開**巢狀**的指標宣告子，數出有幾顆星。
 *
 * 🔴 `int** p` 的 AST 是巢狀的，不是「一個帶兩顆星的節點」：
 *
 * ```
 * pointer_declarator
 *   pointer_declarator
 *     identifier "p"
 * ```
 *
 * 在此之前三處都寫 `namedChildren.find(c => c.type === 'identifier')`
 * ——**對單層成立，對多層找不到**，於是名字退回 `'ptr'`／`''`、星數少算。
 *
 * > **`?? 'ptr'` 讓「沒找到」與「本來就沒有」長得一模一樣**
 * > （`CLAUDE.md` 的靜默降級反模式），而症狀是**產出一段合法但不同的程式**。
 */
function unwrapPointers(decl: AstNode): { stars: number; inner: AstNode } {
  let inner = decl
  let stars = 0
  while (inner.type === 'pointer_declarator') {
    stars++
    const next = inner.namedChildren.find(
      (c) =>
        c.type === 'pointer_declarator' ||
        c.type === 'array_declarator' ||
        c.type === 'reference_declarator' ||
        c.type === 'function_declarator' ||
        c.type === 'identifier' ||
        // 🔴 **結構／類別成員的名字是 `field_identifier`，不是 `identifier`。**
        //    少了這一行，`struct Node { Node* next; };` 剝不開——迴圈找不到
        //    下一層就 break，`inner` 停在 `pointer_declarator` 上，
        //    於是名字變成 **`"* next"`**（星號跑進名字裡）而型別是 `"Node"`。
        //    下游 `instantiate` 看到「`Node` 有一個 `Node` 成員」，丟出
        //    「結構 Node 直接或間接包含自己——那在 C++ 不合法（**要用指標**）」
        //    ——**而它已經是指標了**（2026-08-27 生 Linked List 課時撞到）。
        c.type === 'field_identifier',
    )
    if (!next) break
    inner = next
  }
  return { stars, inner }
}

function liftSingleDeclarator(decl: AstNode, type: string, ctx: LiftContext): SemanticNode {
  // **膠囊自己的判別先問**——「宣告子長成這樣時是我」是元件的知識。
  const claim = tryDeclaratorBranches(decl, type, ctx)
  if (claim) return claim

  // Array declarator: int arr[10]
  if (decl.type === 'array_declarator') return buildArrayDeclare(type, decl, ctx)

  // Plain identifier: int x
  if (decl.type === 'identifier') {
    return buildVarDeclare({ name: decl.text, type })
  }

  // Bare pointer declarator without init: int* ptr;
  if (decl.type === 'pointer_declarator') {
    // ⚠️ `int* a[3]` 的 pointer_declarator 裡包的是 **array_declarator**，
    // 不是 identifier。只找 identifier 的話名字取不到，落到預設 `'ptr'`
    // ——**名字與大小都掉了**，而產出的 `int* ptr;` 看起來像一段合法程式。
    const { stars, inner } = unwrapPointers(decl)
    if (inner.type === 'array_declarator') {
      // 指標陣列：元素型別帶星號，其餘與一般陣列相同
      return buildArrayDeclare(`${type}${'*'.repeat(stars)}`, inner, ctx)
    }
    const name = inner.type === 'identifier' ? inner.text : 'ptr'
    // 🔴 這顆元件的產生器**自己會補一顆星**（`${type}* ${name}`），所以少算一顆
    return buildPointerDeclare(name, type + '*'.repeat(stars - 1))
  }

  // Bare reference declarator without init: int& ref; (rare, usually has init)
  if (decl.type === 'reference_declarator') {
    const refIdent = decl.namedChildren.find(c => c.type === 'identifier')
    const name = refIdent?.text ?? 'ref'
    return buildVarDeclareRef(name, type)
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
      return buildVarDeclareRef(name, type, value)
    }
    return buildVarDeclareRef(name, type)
  }

  // Pointer declarator: int* ptr = &x
  if (nameNode?.type === 'pointer_declarator') {
    // ⚠️ `int* a[3]` 的 pointer_declarator 裡包的是 **array_declarator**，
    // 不是 identifier。只找 identifier 的話名字取不到，落到預設 `'ptr'`
    // ——**名字與大小都掉了**，而產出的 `int* ptr;` 看起來像一段合法程式。
    const { stars, inner } = unwrapPointers(nameNode)
    if (inner.type === 'array_declarator') {
      // 指標陣列：元素型別帶星號，其餘與一般陣列相同
      return attachInitializer(
        buildArrayDeclare(`${type}${'*'.repeat(stars)}`, inner, ctx),
        decl.childForFieldName('value'),
        ctx,
      )
    }
    name = inner.type === 'identifier' ? inner.text : 'ptr'
    const ptrType = type + '*'.repeat(stars - 1)
    const valueNode = decl.childForFieldName('value')
    if (valueNode) {
      const value = ctx.lift(valueNode)
      return buildPointerDeclare(name, ptrType, value)
    }
    return buildPointerDeclare(name, ptrType)
  }

  // Array init_declarator: int arr[10] = {...}
  if (nameNode?.type === 'array_declarator') {
    // 🔴 **帶初始值的多維陣列原本走不到 `cpp:array_2d_declare`**。
    //
    // 那顆元件的判別登錄在**宣告子分支**上，而分支只在「沒有初始值」那條路
    // 被問——`int a[2][3] = {{1,2,3},{4,5,6}}` 走的是這裡。
    // 於是它落到一維的 `cpp:array_declare`，而維度被塞進**名字**：
    // `name: "a[2]"`、`size: 3`。產出的碼是對的（名字原樣印出），
    // **而執行時變數就叫 `a[2]`**——`a[1][2]` 說「a 未宣告」。
    //
    // > **一個判別如果只掛在一條路上，另一條路會安靜地走到別的地方去。**
    const claim2d = tryDeclaratorBranches(nameNode, type, ctx)
    if (claim2d) return attachInitializer(claim2d, decl.childForFieldName('value'), ctx)
    return attachInitializer(buildArrayDeclare(type, nameNode, ctx), decl.childForFieldName('value'), ctx)
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
        return buildStringStreamDecl(name, args.length > 0 ? args[0] : null)
      }
      return buildVarDeclare({ name, type, init_style: 'constructor' }, {
        initializer: args,
      })
    }
    const value = ctx.lift(valueNode)
    return buildVarDeclare({ name, type }, {
      initializer: value ? [value] : [],
    })
  }

  return buildVarDeclare({ name, type })
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
      // **成員初始化列 → 一串賦值**（`: v(x), w(y)` → `v = x; w = y;`）。
      //
      // 🔴 它原本被記成一個字串屬性，而**執行那一路從未讀它**：
      // `Node(int x) : v(x) {}` 建出來的物件 `v` 是 0，而產生的程式碼完全正確。
      // **投影對、執行錯**——一個要 parse 回結構才能用的字串，就不該是字串。
      const initListNode = node.namedChildren.find(c => c.type === 'field_initializer_list')
      const inits: SemanticNode[] = []
      for (const fi of initListNode?.namedChildren ?? []) {
        if (fi.type !== 'field_initializer') continue
        const field = fi.namedChildren[0]?.text
        // 值的形式是 `(x)` 或 `{x}`——兩種都取第一個實際的運算式
        const valueHolder = fi.namedChildren[1]
        const valueNode = valueHolder?.namedChildren[0] ?? valueHolder
        const value = valueNode ? ctx.lift(valueNode) : null
        if (!field || !value) continue
        // 🟢 建構式的初始化列（`: x(1)`）——左值是那個欄位的名字，
        //    而它現在也是一顆節點（2026-08-25，左值接點化）。
        inits.push(buildVarAssign({ target: [buildVarRef(field)], value: [value] }))
      }
      const body = extractBody(bodyNode, ctx)
      return buildConstructor({ class_name: className }, { params, inits, body })
    }

    // Destructor: function_definition where declarator is destructor_name
    if (nameNode?.type === 'destructor_name') {
      const body = extractBody(bodyNode, ctx)
      return buildDestructor({ class_name: className }, { body })
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
      return buildOperatorOverload({ return_type: returnType, operator: op, param_type: paramType, param_name: paramName }, { body })
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
      return buildMethodOverride({ return_type: returnType, name: methodName }, { params, body })
    }

    // Virtual method with body
    if (isVirtual) {
      const methodName = nameNode?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const body = extractBody(bodyNode, ctx)
      return buildMethodVirtual({ return_type: returnType, name: methodName }, { params, body })
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
      return buildMethodVirtualPure({ return_type: returnType, name: methodName }, { params })
    }

    // Static member: static int count;
    const isStatic = node.namedChildren.some(c => c.type === 'storage_class_specifier' && c.text === 'static')
    if (isStatic) {
      const typeNode = node.childForFieldName('type')
      const type = typeNode?.text ?? 'int'
      const declNode = node.childForFieldName('declarator')
      const name = declNode?.text ?? 'member'
      return buildMemberStatic(type, name)
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
      // ⚠️ 星號要搬進型別——與下面單一宣告子那條同一個理由
      const nodes = declarators.map((d) => {
        const { stars, inner } = unwrapPointers(d)
        return buildVarDeclare({ type: type + '*'.repeat(stars), name: inner.text })
      })
      // Return first and add rest — use a wrapper approach
      // Actually, we need to return multiple nodes. Use the fact that struct/class member lifting
      // collects all slots. Return a compound node that generateBody will flatten.
      return createNode('_multi_field', {}, { fields: nodes })
    }
    const declNode = node.childForFieldName('declarator')
    // 🔴 **星號屬於型別，不屬於名字。**
    //    `Node* next;` 的 declarator 是 `pointer_declarator`，而它的 `.text`
    //    是逐字的 `"* next"`。直接拿來當名字的話，積木上會出現一個
    //    叫 `* next` 的變數，而型別是 `"Node"`——**指標性整個消失了**。
    const { stars, inner } = declNode ? unwrapPointers(declNode) : { stars: 0, inner: null }
    const type2 = type + '*'.repeat(stars)
    const name = inner?.text ?? declNode?.text ?? 'x'
    // 成員預設值：class A { int v = 7; };
    // ⚠️ `= 0` 的純虛擬已在上面被攔截，走到這裡的 default_value 一律是初始值
    const defaultValueNode = node.childForFieldName('default_value')
    const init = defaultValueNode ? ctx.lift(defaultValueNode) : null
    return init
      ? buildVarDeclare({ type: type2, name }, { initializer: [init] })
      : buildVarDeclare({ type: type2, name })
  }

  // Fallback: try generic lift
  return ctx.lift(node)
}


/** Extract parameters from a parameter_list node */
export function liftParamList(paramList: AstNode | null, _ctx: LiftContext): SemanticNode[] {
  if (!paramList) return []
  const params: SemanticNode[] = []
  for (const p of paramList.namedChildren) {
    // 🔴 **帶預設值的參數是【另一個】節點型別**（`optional_parameter_declaration`），
    //    而它本來整個被跳過——`int add(int a, int b = 0)` 產回去變成 `int add(int a)`，
    //    **而主體照樣用 b**：產出的碼編不過。
    //    ⚠️ 症狀不是報錯：抬升沒有失敗，只是少了一格
    //    （2026-08-23 由 C++ 語料的形狀覆蓋抓到——那個型別在「沒碰到」裡）。
    if (p.type === 'parameter_declaration' || p.type === 'optional_parameter_declaration') {
      const { type, name } = parseParamDeclaration(p)
      const dflt = p.type === 'optional_parameter_declaration'
        ? p.childForFieldName('default_value')?.text ?? ''
        : ''
      params.push(createNode('param_decl', { type, name, ...(dflt ? { default: dflt } : {}) }))
    }
  }
  return params
}

export function registerCppLiftStrategies(registry: LiftStrategyRegistry): void {








  // doc comment: /** ... */ → doc_comment with structured properties
  registry.register('cpp:liftDocComment', (node) => {
    const props = parseDocComment(node.text)
    return buildDocComment(props)
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
      return buildInclude(header)
    }
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      const header = rawPath.slice(1, -1)
      return buildIncludeLocal(header)
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

      // 🔴 **這裡本來自己抄了一份「怎麼讀一串參數」**，而同一個檔裡就有
      //    `liftParamList`——於是帶預設值的參數在**這一條路**上被跳過
      //    （`int add(int a, int b = 0)` 產回去是 `int add(int a)`，而主體照樣用 `b`）。
      //    > **同一件事兩份實作，修好的那一份不會讓另一份跟著對。**
      paramChildren.push(...liftParamList(fnDecl.childForFieldName('parameters'), ctx))
    }

    // 🔴 **登記這個名字**——之後 `swap(…)` 那種呼叫才不會被內建樣式攔走。
    //    ⚠️ 要在 `extractBody` **之前**：一個遞迴函式在自己的主體裡呼叫自己。
    ctx.data.declareFunction(name)
    /**
     * 🔴 **參數也是「宣告過的名字」**（2026-09-17，模糊測試抓到的）。
     *
     * ```cpp
     * void tally(map<char,int>& om){ om['t']++; }     g++ 數一個字母
     *                                                 我們：INDEX_OUT_OF_RANGE 116
     * ```
     *
     * `m[k]` 要判成對照表還是陣列，判準是**根變數的型別**（`cpp:map_at` 的
     * 檔頭逐字：「差別在律——陣列索引超出範圍是錯誤，對應表的鍵不存在是插入」）。
     * 而那張型別表只收得到**宣告節點**：`recordDeclaration` 認的是
     * `<x>_declare` 那一族，**參數不在裡面**。
     *
     * 於是同一段程式在 `main` 裡是對的、搬進函式就壞了——而它壞成一個
     * 指著使用者沒寫錯的那一行的索引錯誤。
     *
     * > **一張「名字 → 型別」的表如果只收宣告，那麼每一個參數對它來說都不存在
     * > ——而函式正是「同一段程式碼換個地方寫」。**
     *
     * ⚠️ 型別文字要正規化成與宣告那一側**同一個詞彙**（`map<char,int>&` → `map`），
     *    而「哪些名字是容器」問的是**登錄表**，不是自己列一張會過期的清單。
     * ⚠️ 推進一層作用域再登記——否則參數名會洩漏到函式外面，
     *    而外面同名的全域變數會被判成另一個型別。
     */
    ctx.data.pushScope()
    try {
      for (const p of paramChildren) {
        const pname = p.properties?.name
        const ptype = p.properties?.type
        if (typeof pname !== 'string' || pname === '' || typeof ptype !== 'string') continue
        ctx.data.declare(pname, normalizeParamType(ptype))
      }
      const body = extractBody(bodyNode, ctx)
      return buildFuncDef(name, returnType, { params: paramChildren, body })
    } finally {
      ctx.data.popScope()
    }
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
        /**
         * 🔴 **`std::vector<int>` 與 `vector<int>::iterator` 都是 qualified_identifier**
         *    ——而只有前者是一個容器宣告（2026-09-17，盲測抓到）。
         *
         * ```cpp
         * vector<int>::iterator it = v.begin();   →  被認成【第二個 vector 宣告】
         * ```
         *
         * 於是 `it` 變成一個**新的空容器**，而 `v.erase(it)` 說「這個位置不是 v 裡的」
         * ——錯誤指著刪除那一行，而問題在宣告那一行。
         * ⚠️ 在那句錯誤訊息存在之前，這是一個**靜默的錯答案**：`it` 是空的容器，
         *    後面每一次走訪都跑零次。
         *
         * 🟢 判準是**那個樣板型別是它的「名字」還是它的「範圍」**：
         *    `std::vector<int>` 的名字是 `vector<int>`（範圍是 `std`）；
         *    `vector<int>::iterator` 的名字是 `iterator`（範圍才是 `vector<int>`）。
         *
         * > **兩個語法形狀相同的東西，差別在哪一格是哪一格——
         * > 而一個只問「裡面有沒有」的判別式看不見那個差別。**
         */
        const named = qualifiedNode.childForFieldName('name')
        templateTypeNode = named?.type === 'template_type' ? named : undefined
      }
    }
    /**
     * 🔴 **CTAD——樣板引數整段被省略**（C++17，2026-09-20，語料 `AP325/6/6_9.cpp`）。
     *
     * ```cpp
     * vector dp(w+1, vector<int>(n+1));    型別節點是一個【裸的 type_identifier】
     * ```
     *
     * 底下那條容器路要的是 `template_type`（`vector<...>`），而這裡一個角括號都沒有
     * ——於是它掉進一般的變數宣告，`dp` 變成一個純量，而 `dp[1][2]` 說「dp 不是容器」。
     *
     * 🟢 **只有在填充值【說得出自己的型別】時才接手**（見 `ctadElemType`），
     *    否則讓開走原路。
     *
     * ⚠️ **產回去會把省略的那一段補上**（`vector dp(…)` → `vector<vector<int>> dp(…)`）。
     *    那是**正規化不是缺陷**：CTAD 是純粹的省略，兩種寫法指的是同一個型別
     *    ——照判準第三層「文字不同 ≠ 錯，行為不同才是」。
     * 🔴 而它與**別名**不同，不要混為一談：`typedef map<…> Graph;` 的 `Graph`
     *    是學生取的名字，展開它等於把它拿掉；CTAD 沒有名字可以拿掉。
     */
    let ctad: { name: string; inner: string } | undefined
    if (!templateTypeNode) {
      const bare = node.namedChildren.find(c => c.type === 'type_identifier')?.text ?? ''
      if (bare.length > 0 && componentForContainerTemplate(bare)) {
        const initDecl = node.namedChildren.find(c => c.type === 'init_declarator')
        const argList = initDecl?.namedChildren.find(c => c.type === 'argument_list')
        const args = argList?.namedChildren ?? []
        // ⚠️ 只認【大小 ＋ 填充值】那一種：一個引數的 `vector v(other)` 是複製建構，
        //    它的型別在別人身上，這裡證不出來。
        const inner = args.length >= 2 ? ctadElemType(args[args.length - 1]) : undefined
        if (inner !== undefined) ctad = { name: bare, inner }
      }
    }
    if (templateTypeNode || ctad) {
      const templateName = ctad?.name
        ?? templateTypeNode?.namedChildren.find(c => c.type === 'type_identifier')?.text ?? ''
      const templateArgs = templateTypeNode?.namedChildren.find(c => c.type === 'template_argument_list')
      const innerType = ctad?.inner ?? (templateArgs ? templateArgs.text.slice(1, -1).trim() : 'int') // strip < >

      // 容器宣告概念——**從登錄表讀，不寫死**（見 core/component/container-templates.ts）。
      // 已元件化的由膠囊登錄；還沒的由 `pending-containers.ts` 的過渡表提供。
      // 容器宣告概念——**從登錄表讀，不寫死**（見 core/component/container-templates.ts）。
      // 已元件化的由膠囊登錄；還沒的由 `pending-containers.ts` 的過渡表提供。
      const componentId = componentForContainerTemplate(templateName)
      //
      // 🔴 **每一個宣告子都走同一支**（2026-09-10）
      //
      // 這裡原本只認得**一個**宣告子。使用者回報：
      //
      // ```cpp
      // vector<int> C(n), V(n);   →  vector<int> C(n);     🔴 V 整個蒸發
      // ```
      //
      // ⚠️ 而它連 `cpp:vector_declare` 都不是：兩個 `function_declarator` 讓
      // 整句被讀成一個**函式的前置宣告**（`cpp:forward_decl`），第二個直接沒了。
      //
      // > **一個只寫得出「一個」的讀取器，在遇到兩個的時候不會出聲
      // > ——它會安靜地讀完第一個就回去。**
      //
      // 🟢 修法是把「讀一個宣告子」抽成 `ctorSlots`，這裡只負責**跑一遍**。
      // ⚠️ 一個宣告子時**回傳那顆概念本身**（行為與先前逐字相同）；
      //    兩個以上才包一層 `cpp:var_declare`——多宣告子本來就長那樣。
      const declList = componentId ? variableDeclarators(node) : null
      if (componentId && declList) {
        /** 型別參數怎麼變成屬性——`map` 與 `pair` 各有兩個。 */
        const typeArgs = templateArgs?.namedChildren
          .filter((c) => c.type === 'type_descriptor' || c.type === 'type_identifier') ?? []
        /**
         * 🔴 **樣板名自己附帶的屬性**（2026-09-17）——`multiset` → `{ unique: 'false' }`。
         *
         * 下面那條 `if` 鏈旁邊寫著「第三個出現時該收斂成『從宣告推導』，
         * 而不是再加一個 `if`」，而重複性正是那個第三個。所以它**不走那條鏈**：
         * 資料回到登錄那個名字的膠囊，這裡只負責合併。
         */
        const extraProps = propsForContainerTemplate(templateName) ?? {}
        const propsFor = (nm: string): Record<string, string> => ({ ...extraProps, ...baseProps(nm) })
        /**
         * 🟢 **兩個型別參數要放哪兩格，問那顆元件自己宣告了什麼**（2026-09-18）。
         *
         * 這裡本來是一條 `if` 鏈（`templateName === 'map'` ／ `=== 'pair'`），
         * 而它旁邊逐字寫著：「⚠️ 這是**第二個**「兩個型別參數」的特例。
         * **第三個出現時該收斂成「從 `component.json` 的 properties 宣告推導」，
         * 而不是再加一個 `if`。**」
         *
         * 🔴 **第三個到了，而它不是一顆新元件**：`unordered_map` 與 `map`
         * 是**同一顆元件的兩個樣板名**，於是它落到最後那條 `else`，
         * 產出 `type: "string,bool"`——一個要 parse 回結構才能用的字串。
         * 而產碼那一側讀不到 `key_type`／`value_type`，就補 `int, int`：
         * **`unordered_map<string,bool> mp;` 變成 `unordered_map<int,int> mp;`**。
         *
         * > **一個按「名字」分派的特例表，在同一個東西有第二個名字的那天
         * > 會安靜地漏掉它——而那個東西的行為看起來只是「預設值」。**
         *
         * ⚠️ 判準是**宣告**：那顆元件的 `properties` 裡有哪兩格。
         */
        const declared = new Set(
          (componentComponents().find((c) => c.componentId === componentId)?.properties ?? [])
            .map((x) => String((x as { name?: unknown }).name ?? '')),
        )
        const twoArgKeys: [string, string] | null =
          declared.has('key_type') && declared.has('value_type') ? ['key_type', 'value_type']
            : declared.has('type1') && declared.has('type2') ? ['type1', 'type2']
              : null
        /** 🔴 樣板引數是大小的那些，**沒有 `type` 屬性**——見 `templateArgIsSize`。 */
        const argIsSize = templateArgIsSize.has(componentId)
        const baseProps = (nm: string): Record<string, string> =>
          argIsSize
            ? { name: nm }
            : twoArgKeys
              ? {
                  [twoArgKeys[0]]: typeArgs[0]?.text ?? 'int',
                  [twoArgKeys[1]]: typeArgs[1]?.text ?? 'int',
                  name: nm,
                }
              : { type: innerType, name: nm }

        const buildOne = (d: AstNode): SemanticNode => {
          const s = ctorSlots(d, ctx)
          const props = propsFor(s.name)
          /**
           * 🔴 **樣板引數進 `size` 接點**——`bitset<26> bs;`（2026-09-19）。
           * ⚠️ 它 lift 成一顆運算式節點（通常是字面數字），**不是一串文字**
           * ——投影要把它畫成一個放得下運算式的插槽。
           */
          if (argIsSize) {
            /**
             * 🔴 **樣板引數可能被包在一層 `type_descriptor` 裡**（2026-09-20，盲測抓到）。
             *
             * ```
             * bitset<8>      template_argument_list > number_literal          ← 直接是運算式
             * bitset<K>      template_argument_list > type_descriptor > type_identifier
             * bitset<K + 1>  template_argument_list > binary_expression       ← 又是運算式
             * ```
             *
             * tree-sitter 對**裸識別字**的樣板引數一律當成型別（它在語法上分不出
             * 「型別參數」與「非型別參數」）。lift 一個型別節點的結果是
             * `raw_code`——**而症狀是整句宣告消失，不是報錯**。
             *
             * > **同一個位置的三種寫法，有一種會多包一層——
             * > 而那一層讓它從運算式變成型別。**
             */
            const raw = templateArgs?.namedChildren[0]
            const argNode = raw?.type === 'type_descriptor' ? (raw.namedChildren[0] ?? raw) : raw
            /**
             * ⚠️ 剝完之後那一顆仍然是**型別節點**（`type_identifier`），
             * 而 lift 一個型別節點的結果是 `raw_code`——所以裸識別字要直接
             * 造一顆變數引用。**同一個慣用法這個檔裡已經有一處**（樣板引數那一族）。
             */
            const lifted = !argNode
              ? null
              : argNode.type === 'type_identifier'
                ? buildVarRef(argNode.text)
                : ctx.lift(argNode)
            /**
             * 🔴 **初始值也要帶上**（2026-09-19，最小重現抓到）。
             *
             * 第一版在這裡直接 `return`，於是 `bitset<8> b = a >> 2;` 的
             * `a >> 2` **整個從語義樹上消失**——而症狀不是報錯，
             * 是 `b` 每一格都是 0。
             *
             * > **一條提早 return 的路徑，漏掉的是它【沒有抄過去】的那幾格。**
             */
            const slots: Record<string, SemanticNode[]> = {}
            if (lifted) slots.size = [lifted]
            if (s.source && hasInitSourceDecl.has(componentId)) slots.source = [s.source]
            return createNode(componentId, props, slots)
          }
          // ⚠️ **每一格都問過宣告才掛**——沒有宣告那個接點的容器不得收到它
          //    （`hasInitSourceDecl` 的檔頭記過那次翻車：一個未宣告的子節點
          //    讓產生器不認得，來回轉換就掉了那一段）。
          if (s.values.length > 0 && hasValuesDecl.has(componentId)) {
            return createNode(componentId, props, { values: s.values })
          }
          if (s.source && hasInitSourceDecl.has(componentId)) {
            return createNode(componentId, props, { source: [s.source] })
          }
          /**
           * 🔴 **大括號的初始值進來了，而這顆元件的槽叫 `source`**（2026-09-16）。
           *
           * `pair<int,int> pr = {3,4};` 走到這裡時 `s.values` 是 `[3, 4]`，
           * 而 `cpp:pair_declare` 宣告的是 `source` 不是 `values`——於是上面兩條
           * 都不成立，掉到最後那個 `createNode(componentId, props)`，
           * **初始值整個從語義樹上消失**。
           *
           * 症狀有兩層，而第二層更嚴重：
           *
           *     解譯器   pr.first 讀到 0（而 make_pair(3,4) 是好的）
           *     學生     一動積木，`= {3,4}` 就從他的程式碼裡不見了
           *
           * > **一條「我認得的槽有三種」的組裝路徑，第四種不會報錯
           * > ——它會安靜地少一塊，而少掉的那一塊是使用者打的字。**
           *
           * 🟢 把它包成一顆 `initializer_list` 放進 `source`：那正是
           *    `pair<int,int> pr = {3,4}` 在語義上的樣子。
           */
          const listId = aggregateListFor(componentId.split(':')[0])
          if (s.values.length > 0 && listId && hasInitSourceDecl.has(componentId)) {
            return createNode(componentId, props, {
              source: [createNode(listId, {}, { values: s.values })],
            })
          }
          if (s.size && hasSizeDecl.has(componentId)) {
            return s.fill
              ? createNode(componentId, props, { size: [s.size], fill: [s.fill] })
              : createNode(componentId, props, { size: [s.size] })
          }
          return createNode(componentId, props)
        }

        if (declList.length === 1) return buildOne(declList[0])
        return buildVarDeclare(
          // ⚠️ CTAD 沒有 `template_type` 節點可以照抄原文——把推回來的那一段寫出來。
          { type: templateTypeNode?.text ?? `${templateName}<${innerType}>` },
          { declarators: declList.map(buildOne) },
        )
      }

      // Unknown template type — fall through to var_declare with full template text
    }

    // Detect non-template container/stream types (string, ifstream, ofstream, stringstream)
    // These are type_identifier, possibly inside qualified_identifier (std::string, std::ifstream, etc.)
    // ⚠️ **這張表已經空了**——五顆元件各自登錄自己的型別名
    // （`core/component/container-templates.ts` 的 `registerPlainTypeComponent`）。
    // 留著空表是為了讓「查不到」與「忘了查」分得出來。
    const streamComponents: Record<string, string> = {}
    const typeIdentNode = node.namedChildren.find(c => c.type === 'type_identifier')
    const qualifiedIdNode = node.namedChildren.find(c => c.type === 'qualified_identifier')
    // Get the final type name (e.g., "string" from "std::string" or plain "string")
    let simpleTypeName: string | null = null
    if (typeIdentNode && (streamComponents[typeIdentNode.text] ?? plainTypeComponent(typeIdentNode.text))) {
      simpleTypeName = typeIdentNode.text
    } else if (qualifiedIdNode) {
      // Look for type_identifier inside qualified_identifier (e.g., std::string → "string")
      const innerTypeIdent = qualifiedIdNode.namedChildren.find(c => c.type === 'type_identifier')
      if (innerTypeIdent && (streamComponents[innerTypeIdent.text] ?? plainTypeComponent(innerTypeIdent.text))) {
        simpleTypeName = innerTypeIdent.text
      }
    }
    // ⚠️ 讀不懂的宣告子形狀要**讓開**——見 `claimsSimpleDeclarator` 的檔頭。
    //
    // 🟢 **多宣告子由這一支自己包起來**（`string s, t, u;`／`string a(n, '0'), b;`）
    //    ——與容器那一支走同一對 `variableDeclarators` ＋ `ctorSlots`。
    //    ⚠️ 一個宣告子時**不走這條**：底下那一段還有最令人困惑的解析、
    //    `decl_type`、`ctorCount` 幾格這一條沒有的東西。
    const plainDecls = simpleTypeName ? variableDeclarators(node) : null
    if (plainDecls && plainDecls.length > 1 && simpleTypeName) {
      const cid = streamComponents[simpleTypeName] ?? plainTypeComponent(simpleTypeName)
      if (cid) {
        const slots = plainDecls.map((d) => ctorSlots(d, ctx))
        // ⚠️ 與單一宣告子那一條**同一道檢查**：宣告說得下幾個就放幾個。
        // 🔴 而降級的單位是**整句**，不是單一個宣告子——一顆殘差節點當不了
        //    宣告子（產生器不認得它，產出的是 `string x, x;` 那種垃圾）。
        // > **降級要降在一個【自己站得住】的單位上。**
        const tooMany = slots.some((sl) =>
          [sl.size, sl.fill].filter(Boolean).length > 1 && !acceptsManyInitializers(cid))
        if (tooMany) return buildRawCode(node.text)
        return buildVarDeclare(
          { type: simpleTypeName },
          {
            declarators: slots.map((sl) => {
              const args = [sl.size, sl.fill].filter((x): x is SemanticNode => x !== null)
              if (args.length > 0) return createNode(cid, { name: sl.name }, { initializer: args })
              if (sl.source) return createNode(cid, { name: sl.name }, { initializer: [sl.source] })
              return createNode(cid, { name: sl.name })
            }),
          },
        )
      }
    }
    if (claimsSimpleDeclarator(node) && simpleTypeName && (streamComponents[simpleTypeName] ?? plainTypeComponent(simpleTypeName))) {
      const componentId = streamComponents[simpleTypeName] ?? plainTypeComponent(simpleTypeName)
      // 🔴 **一個身分可能被多個型別名登錄**（同一片液晶的並列版與 I2C 版）。
      //    那個差別在程式碼裡是真的，而**它不得被改寫**——所以要帶著。
      //
      // ⚠️ 而只在**概念自己宣告了這一格**時才寫：絕大多數具體型別只有一個名字，
      //    替它們憑空多一個屬性會讓宣告與產出對不上（參數規格護欄在看）。
      //
      // > **共用層要不要記一件事，由那顆元件的宣告說了算。**
      const wantsDeclType = componentComponents().some(
        (c) => (c as { componentId?: string }).componentId === componentId &&
          ((c as { properties?: { name?: string }[] }).properties ?? []).some((pp) => pp?.name === 'decl_type'),
      )
      const extraProps: Record<string, string> = wantsDeclType ? { decl_type: simpleTypeName } : {}
      // 🔴 **建構參數的個數要記在節點上**——投影那一側靠它決定開幾個插槽。
      //
      // ⚠️ 少了它的症狀**只在積木那一側**：語義樹三個接點都在、產生器也對，
      //    而積木上只放得下第一個 → 積木→程式碼時第 2 個之後**安靜地不見**。
      //
      // > **一個只在投影那一側丟資料的 bug，
      // > lift 與 generate 各自的測試都看不到它。**
      //
      // 同上：只在**概念自己宣告了這一格**時才寫。
      const wantsCtorCount = componentComponents().some(
        (c) => (c as { componentId?: string }).componentId === componentId &&
          ((c as { properties?: { name?: string }[] }).properties ?? []).some((pp) => pp?.name === 'ctorCount'),
      )
      const withCount = (args: unknown[]): Record<string, string> =>
        wantsCtorCount ? { ...extraProps, ctorCount: String(args.length) } : extraProps
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      // ⚠️ 走到這裡代表 `claimable`——`decl` 缺席只可能是最令人困惑的解析那一支
      //    （下面的 `fnDecl`），它自己會帶名字進來。
      const name = decl?.type === 'identifier'
        ? decl.text
        : (decl?.childForFieldName('declarator') ?? decl?.namedChildren[0])?.text ?? ''
      // 🔴 **最令人困惑的解析**（most vexing parse）——而它在 Arduino 教學裡是常態。
      //
      // ```cpp
      // #define DHTPIN 2
      // DHT dht(DHTPIN, DHT11);     ← tree-sitter 解析成【函式宣告】
      // DHT dht(2, DHT11);          ← 引數是字面量時才解析成變數定義
      // ```
      //
      // ⚠️ **真編譯器沒有這個問題**：前置處理器先把 `DHTPIN` 換成 `2`，
      // 所以它看到的一直是後者。而 tree-sitter **不做前置處理**。
      //
      // > **一個解析器如果少了一個階段，它會在那個階段本來會消掉的地方看到歧義。**
      //
      // 🟢 而這裡分得出來：**型別是一個登錄過的具體型別**（`DHT`／`Servo`／
      // `LiquidCrystal`／`string`…），而那種型別在 sketch 裡**不會**被當成
      // 函式的回傳型別。⚠️ 走到這一行代表 `plainTypeComponent` 已經認領了它。
      const fnDecl = node.namedChildren.find(c => c.type === 'function_declarator')
      if (!decl && fnDecl) {
        const nameNode = fnDecl.namedChildren.find(c => c.type === 'identifier')
        const params = fnDecl.namedChildren.find(c => c.type === 'parameter_list')
        const args = (params?.namedChildren ?? [])
          .map(pd => {
            // `parameter_declaration :: DHTPIN` 底下是一個 `type_identifier`
            // ——它其實是一個**識別字**（巨集名或常數名）。
            const inner = pd.namedChildren[0]
            if (!inner) return null
            if (inner.type !== 'type_identifier') return ctx.lift(inner)
            /**
             * 🔴 **`string w(names[i]);` 的下標會被這條路吃掉**（2026-09-17）。
             *
             * 同一個「最令人困惑的解析」把 `names[i]` 讀成一個**參數宣告**
             * （型別 `names` ＋ 一個沒有名字的陣列宣告子 `[i]`），而這裡
             * 只取了型別名 —— 於是 `string w(names[0])` 與 `string w(names[1])`
             * **lift 出一模一樣的樹**，兩個都接到整個 `names`。
             *
             * ⚠️ 它是**靜默的**：積木畫得出來、產出的碼少一段下標而仍然合法。
             *
             * > **一個把「型別 ＋ 宣告子」讀成「只有型別」的還原，
             * > 會讓兩段不同的程式碼變成同一棵樹。**
             */
            const plain = buildVarRef(inner.text)
            let expr = plain
            // ⚠️ 多維（`w[0][1]`）的第二層**包在第一層底下**，所以是往下走不是往右走
            let d: AstNode | undefined = pd.namedChildren[1]
            while (d) {
              if (d.type !== 'abstract_array_declarator') return plain
              const idxNode = d.namedChildren.find((c) => c.type !== 'abstract_array_declarator')
              const idx = idxNode ? ctx.lift(idxNode) : null
              // 🔴 **解不開就原樣回去**：`w[]`（沒有下標）不是一個下標運算式。
              //    自己編一個「大概是 0 吧」會讓錯誤指向別的地方。
              if (!idx) return plain
              expr = buildArrayAt({ obj: [expr], index: [idx] })
              d = d.namedChildren.find((c) => c.type === 'abstract_array_declarator')
            }
            return expr
          })
          .filter((n): n is NonNullable<typeof n> => n !== null)
        return createNode(componentId, { name: nameNode?.text ?? name, ...withCount(args) }, { initializer: args })
      }

      // For stream types with constructor args (e.g., ifstream fin("input.txt"))
      if (decl?.type === 'init_declarator') {
        const valueNode = decl.childForFieldName('value')
        if (valueNode?.type === 'argument_list') {
          const args = valueNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          // 🔴 **宣告說得下幾個，就只放幾個**（2026-09-10）
          //
          // `string s(n, '0');`（n 個 '0'）有兩個建構引數，而 `cpp:string_declare`
          // 的宣告寫的是 `"initializer": "expression"`——**一個**。
          //
          // 硬塞兩個進去的後果：積木上只有一格，於是走一趟積木回來變成
          // `string s = n;`——**編不過，而且意思完全不同**。
          //
          // ⚠️ 誠實降級：帶著原文出去（P6）。它來回轉換逐字不變，
          // 而學生看得到那一行——只是拆不開它。
          //
          // > **一個接點裝不下的東西，塞進去之後不會出聲；
          // > 它會在【投影到別的地方】的那一步安靜地掉。**
          if (args.length > 1 && !acceptsManyInitializers(componentId)) {
            return buildRawCode(node.text)
          }
          return createNode(componentId, { name, ...withCount(args) }, { initializer: args })
        }
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return createNode(componentId, { name, ...withCount(value ? [value] : []) }, { initializer: value ? [value] : [] })
        }
      }
      return createNode(componentId, { name, ...withCount([]) })
    }

    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
      c.type === 'template_type' ||
      // 🔴 **C 宣告一個結構變數一定要寫關鍵字**：`struct Point p;`
      //    （C++ 可以省略，而 C 不行——那是 C 軌道結構那一課的主要內容）。
      //
      //    在此之前這個清單沒有它，於是 `typeNode` 是 `undefined`，
      //    `?? 'int'` 讓型別**靜靜降級成 `int`**——lift 殘差是 0、積木長得
      //    很正常、而執行時 `p.x` 丟出「**變數 p（不是一個結構）尚未宣告**」。
      //
      //    > **一個 `?? '預設值'` 讓「沒認出來」與「本來就是這個」
      //    > 長得一模一樣**（`CLAUDE.md` 的靜默降級反模式）。
      //
      //    ⚠️ **只認沒有本體的那種**——`struct Point { int x; };` 是一個
      //    【定義】，由 `cpp:struct_declare` 處理；帶本體的走到這裡會被
      //    當成型別名，而它的 `.text` 是整段結構定義。
      ((c.type === 'struct_specifier' || c.type === 'union_specifier' ||
        c.type === 'enum_specifier') && c.childForFieldName('body') === null)
    )
    const type = typeNode?.text ?? 'int'

    // auto declaration: auto x = expr;
    if (autoNode) {
      /**
       * 🔴 **每一個宣告子都走同一支**（2026-09-17）——這裡本來只認得【第一個】。
       *
       * ```cpp
       * auto lo = s.lower_bound(3), hi = s.upper_bound(6);   →  hi 整個蒸發
       * ```
       *
       * ⚠️ 而它**不出聲**：`hi` 後來被用到時報的是「沒有宣告過這個名字」
       * ——錯誤指著使用的那一行，而問題在宣告那一行。
       *
       * 🔴 **同一個缺陷這個 repo 修過一次**（2026-09-10，容器的宣告）：
       * `vector<int> C(n), V(n);` 的 `V` 整個蒸發。當時的結論逐字是：
       * > **一個只寫得出「一個」的讀取器，在遇到兩個的時候不會出聲
       * > ——它會安靜地讀完第一個就回去。**
       *
       * 那一次修的是容器那一支，而**自動型別這一支沒有跟著修**。
       *
       * ⚠️ 一個宣告子時**回傳那顆概念本身**（行為與先前逐字相同）；
       *    兩個以上才包一層一般的變數宣告——多宣告子本來就長那樣。
       */
      const built = node.namedChildren
        .filter((c) => c.type === 'init_declarator')
        .map((decl) => {
          const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
          const valueNode = decl.childForFieldName('value')
          /**
           * 🔴 **宣告子可能是【一串名字】**（`auto [pt, d] = q.front();`，2026-09-18）。
           *
           * 在此之前 `nameNode.text` 把 `[pt,d]` 整串抄進名字那一格，於是執行期
           * 真的宣告了一個叫 `[pt,d]` 的變數——**下一行用到 `pt` 時說
           * 「沒有宣告過這個名字」**。錯誤指著使用的那一行，而問題在宣告那一行。
           *
           * ⚠️ `auto&` 時外面還包一層 `reference_declarator`（`& [k, val]`），
           *    而**那個 `&` 屬於 `auto` 不屬於第一個名字**——所以它是一個**參數**。
           */
          const bare = nameNode?.type === 'reference_declarator'
            ? nameNode.namedChildren[0] : nameNode
          if (bare?.type === 'structured_binding_declarator') {
            const names = bare.namedChildren.filter((c) => c.type === 'identifier').map((c) => c.text)
            if (names.length > 0) {
              return buildDeclareSequence(
                names,
                nameNode?.type === 'reference_declarator' ? 'reference' : 'value',
                valueNode ? ctx.lift(valueNode) : null,
              )
            }
          }
          return buildAutoDeclare(nameNode?.text ?? 'x', valueNode ? ctx.lift(valueNode) : null)
        })
      if (built.length === 1) return built[0]
      if (built.length > 1) return buildVarDeclare({ type: 'auto' }, { declarators: built })
      return buildAutoDeclare('x', null)
    }

    // 🔴 **`const`／`static` ＋ 陣列：誠實降級，而不是假裝看懂了。**
    //
    // 2026-08-17 盲測（`component-fuzz`）抓到，而**症狀比「不支援」更糟**：
    //
    // ```
    // int t[2] = {7,8};           🟢 好的
    // const int t[2] = {7,8};     🔴 initializer 整個【不見了】→ 之後 t[1] 是 TYPE_MISMATCH
    // static int t[2] = {7,8};    🔴 名字變成 `t[2]` → 之後查 t 是 UNDECLARED_VAR
    // ```
    //
    // ⚠️ **而兩者的 lift 殘差都是 0**——辨識層說它看懂了。
    //
    // > **兩顆宣告概念都把「陣列」這件事吃掉了，而各自吃掉的方式不同
    // > ——一個丟掉初始值，一個把 `[2]` 當成名字的一部分。**
    //
    // **這裡只做誠實降級**（P6）：把一個**安靜的錯樹**換成一個**看得見的缺口**。
    // 🔴 完整支援（`const`／`static` 修飾詞 ＋ 陣列宣告）**是另一輪的事**——
    // 它要一顆概念帶得動修飾詞，而那是概念代數的問題不是 lift 的問題。
    /**
     * 這個宣告子裡有沒有一個陣列？
     *
     * 🔴 **原本只往下看一層**（2026-09-17 修）——而 `const char* n[2]` 的宣告子是
     * `init_declarator → pointer_declarator → array_declarator`，**陣列被指標包住了**。
     * 於是這道閘放它過去，下面那條路把它拆成「型別 ＋ 名字 ＋ 初始值」三格，
     * **陣列那一層就在那裡掉的**：`n` 成了一個純量，而 `n[1]` 說「這不是一個陣列」。
     *
     * > **一道只看最外層形狀的閘，會在「同一個形狀多包了一層」時失效
     * > ——而這個檔上面兩百行處已經記過同一件事一次。**
     */
    const arrayDeclarator = (d: AstNode): boolean => {
      for (let cur: AstNode | null = d; cur; cur = cur.childForFieldName('declarator') as AstNode | null) {
        if (cur.type === 'array_declarator') return true
      }
      return false
    }

    // const/constexpr declaration
    if (qualifier === 'const' || qualifier === 'constexpr') {
      /**
       * 🔴 **每一個宣告子都走同一支**（2026-09-20）——這裡本來只認得【第一個】。
       *
       * ```cpp
       * const ll M = 998244353, MX = 1e7;   →  MX 整個蒸發   語料 template/Cn_k.cpp
       * ```
       *
       * ⚠️ 而它**不出聲**：`MX` 後來被用到時報的是「沒有宣告過這個名字」
       * ——錯誤指著使用的那一行，而問題在宣告那一行。
       *
       * 🔴 **同一個缺陷這個 repo 修過三次了**，每一次修的都是另一支：
       * ```
       * 2026-09-10  容器的宣告      vector<int> C(n), V(n);              V 蒸發
       * 2026-09-17  自動型別        auto lo = …, hi = …;                 hi 蒸發
       * 2026-09-20  const／constexpr  const ll M = …, MX = …;            MX 蒸發
       * ```
       * > **一個只寫得出「一個」的讀取器，在遇到兩個的時候不會出聲
       * > ——它會安靜地讀完第一個就回去。**
       *
       * 🟢 **這一次不再一支一支修**：底下那條路徑抽成 `buildOne`，
       * 三種宣告子形狀（陣列／指標／純量）各自照舊，**差別只有跑幾遍**。
       * ⚠️ 一個宣告子時**回傳那顆概念本身**（行為與先前逐字相同）；
       *    兩個以上才包一層一般的變數宣告，而它的型別帶著修飾詞
       *    ——多宣告子的產生器會把那一段前綴從每一個宣告子身上脫掉。
       */
      const decls = node.namedChildren.filter(c => c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'pointer_declarator')
      if (decls.length > 0) {
        const componentId = qualifierComponent(qualifier)
        if (!componentId) return degrade(createNode('raw_code', {}), `修飾詞 ${qualifier} 沒有對應的元件`)
        /**
         * 🔴 **`const` ＋ 陣列不再降級**（2026-09-17）。上面那段註解說完整支援
         * 「要一顆概念帶得動修飾詞，而那是概念代數的問題」——而**那對 `const` 不成立**：
         *
         * > **`const` 是【型別修飾詞】，它屬於型別；`static` 是【儲存類別】，它不屬於。**
         *
         * `const int` 在 C++ 裡本來就是一個型別，所以它該住在元素型別裡
         * ——那顆陣列宣告的 `type` 今天已經裝得下 `char*`（指標陣列走同一條路），
         * 裝 `const int` 是同一件事，不需要新的一格。
         *
         * ⚠️ **`static` 維持誠實降級**：它說的是「這個變數活多久」，
         * 塞進型別字串會產得出對的碼而模擬不出對的行為——那才是真的要另一輪。
         *
         * 🟢 這解開了 `fuzz-cpp-hardware` 上三個 `it.todo`（fuzz_3／6／10）。
         */
        const buildOne = (decl: AstNode): SemanticNode => {
          if (arrayDeclarator(decl)) {
            return liftSingleDeclarator(decl, `${qualifier} ${type}`, ctx)
          }
          const lifted = liftSingleDeclarator(decl, type, ctx)
          // Use type from lifted node; append * for pointer components
          let liftedType = (lifted.properties.type as string) ?? type
          // ⚠️ 問**性狀**不問身分：「我的型別要接一個 `*`」是那顆元件的性質。
          // 寫死 `'cpp:pointer_declare'` 的話它永遠搬不進膠囊。
          liftedType += typeSuffixOf(lifted.componentId)
          return createNode(componentId, {
            type: liftedType,
            name: lifted.properties.name as string ?? 'x',
          }, {
            initializer: lifted.slots.initializer ?? [],
          })
        }
        if (decls.length === 1) return buildOne(decls[0])
        /**
         * ⚠️ 外層那個型別**帶著修飾詞**（`const int`），而那不是裝飾：
         * 多宣告子的產生器是靠「脫掉外層型別這段前綴」把每一個宣告子還原成
         * `N = 5` 的——而每一顆宣告子自己印出來的是 `const int N = 5;`。
         * 少了修飾詞就脫不掉，產出會退回只印名字，**初始值整批蒸發**。
         */
        return buildVarDeclare({ type: `${qualifier} ${type}` }, { declarators: decls.map(buildOne) })
      }
      const componentId = qualifierComponent(qualifier)
      if (!componentId) return degrade(createNode('raw_code', {}), `修飾詞 ${qualifier} 沒有對應的元件`)
      return createNode(componentId, { type, name: 'x' })
    }

    // Static declarations: static int count = 0;
    const storageSpec = node.namedChildren.find(c => c.type === 'storage_class_specifier')
    if (storageSpec?.text === 'static') {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      if (decl) {
        if (arrayDeclarator(decl)) {
          return degrade(buildRawCode(node.text), 'static ＋ 陣列宣告尚未支援')
        }
        if (decl.type === 'identifier') {
          return buildStaticVar(type, decl.text, null)
        }
        const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
        const name = nameNode?.text ?? 'x'
        const valueNode = decl.childForFieldName('value')
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return buildStaticVar(type, name, value)
        }
        return buildStaticVar(type, name, null)
      }
      return buildMemberStatic(type, 'x')
    }

    // Forward function declarations: void listp(int *, int); → structured forward_decl
    const funcDeclarator = node.namedChildren.find(c => c.type === 'function_declarator')
    // 🔴 **函式指標不是函式宣告**（2026-09-06 補）——`void (*f)(int);`
    //    的 `function_declarator` 底下包的是 `parenthesized_declarator`，
    //    而底下那條路只找**直接**的 `identifier`：找不到就落到預設值 `'f'`。
    //
    //    於是 `void (*f)(int);` 產回去變成 `void f(int);`
    //    ——**不只掉資訊，是改變意義**：一個變數變成了一個宣告。
    //    而它安靜得像一段合法程式。
    //
    // > **一個誠實的「我不會」，比一個安靜的「我改了你的程式」好。**
    //
    // ⚠️ 這裡選的是**出聲**，不是**做對**：把函式指標變成一顆概念是另一刀
    //    （它要有型別、要能當參數、要能呼叫）。而在那之前，
    //    原樣保留是唯一不說謊的做法。
    //
    // 🔴 判準同 CLAUDE.md 的「靜默降級反模式」：
    //    **多層 fallback 都用同一個預設值，會掩蓋真正的資料遺失。**
    if (funcDeclarator?.namedChildren.some(c => c.type === 'parenthesized_declarator')) {
      const raw = createNode('raw_code', {})
      raw.metadata = { rawCode: node.text, degradationCause: 'unsupported' }
      return raw
    }
    // 🔴 **`int a(n), b(n);` 是【兩個變數】，不是一個函式的前置宣告**（2026-09-10）
    //
    // 使用者回報 `vector<int> C(n+1), V(n+1);` 之後，全掃出來的同一族還剩這幾筆：
    // 型別**沒有對應膠囊**時（`int`／`double`／還沒膠囊化的 `deque`），
    // 整句掉進這條前置宣告的路，而它只讀第一個宣告子——`b` 就這樣沒了。
    //
    // ## ⚠️ 判準：括號裡那個名字，是宣告過的變數還是型別
    //
    // ```
    // int a(n), b(n);      n 是宣告過的變數  → 兩個變數（最令人困惑的解析）
    // int f(int), g(int);  int 是 primitive  → 兩個函式的前置宣告
    // void f(MyType);      MyType 沒被宣告成變數 → 函式
    // ```
    //
    // 🟢 `ctx.data.lookup` 這個機制早就在（`pattern-lifter` 用它做過同一種消歧）。
    //
    // > **一個解析器少了前置處理階段，它會在那個階段本來會消掉的地方看到歧義
    // > ——而消歧的資料，通常已經在別的地方被記下來了。**
    const funcDeclarators = node.namedChildren.filter(c => c.type === 'function_declarator')
    if (funcDeclarators.length > 0 && funcDeclarators.every((f) => looksLikeCtorCall(f, ctx))) {
      const kids = funcDeclarators.map((f) => {
        const sl = ctorSlots(f, ctx)
        const args = [sl.size, sl.fill].filter((x): x is SemanticNode => x !== null)
        // ⚠️ **要記成建構子形式**：`deque<int> a(n)` 的 `= n` 版本編不過
        //    （explicit 建構子）。`int a(n)` 兩種都行，而記住原文比較誠實。
        return buildVarDeclare({ name: sl.name, type, init_style: 'constructor' }, { initializer: args })
      })
      return kids.length === 1 ? kids[0] : buildVarDeclare({ type }, { declarators: kids })
    }
    if (funcDeclarator) {
      const nameNode = funcDeclarator.namedChildren.find(c => c.type === 'identifier')
      const paramList = funcDeclarator.childForFieldName('parameters')
        ?? funcDeclarator.namedChildren.find(c => c.type === 'parameter_list')
      // 🔴 **這裡本來是手抄的第三份參數解析，而它漏了帶預設值的那個分支**
      //    （2026-08-26 量到）。`int add(int a, int b = 10);` 的第二個參數
      //    是 `optional_parameter_declaration`，於是這個迴圈**整格跳過它**
      //    ——語義樹裡只剩一個參數，產回去變成 `int add(int a);`。
      //
      //    ⚠️ 而**一模一樣的修法 2026-08-23 就做過了**，做在 `liftParamList` 上
      //    （那次是函式定義；這一份是宣告）。兩份程式碼逐字相同，只差那個分支。
      //
      // > **一個被抄過的解析，不會跟著原本那份一起被修好
      // > ——而它壞掉的樣子與原本那份當初一模一樣。**
      //
      // → 改成呼叫那一份，缺陷與重複一起消失。
      return buildForwardDecl(type, nameNode?.text ?? 'f', liftParamList(paramList ?? null, ctx))
    }

    const declarators = node.namedChildren.filter(c =>
      c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'array_declarator' ||
      c.type === 'pointer_declarator' || c.type === 'reference_declarator'
    )

    if (declarators.length === 0) {
      return buildVarDeclare({ name: 'x', type })
    }

    const liftedNodes = declarators.map(decl => liftSingleDeclarator(decl, type, ctx))

    if (liftedNodes.length === 1) return liftedNodes[0]

    return buildVarDeclare({ type }, { declarators: liftedNodes })
  })



  // template_declaration: template <typename T> T func(T a) { ... }
  registry.register('cpp:liftTemplateFunction', (node, ctx) => {
    const templateParams = node.namedChildren.find(c => c.type === 'template_parameter_list')
    const typeParam = templateParams?.namedChildren.find(c =>
      c.type === 'type_parameter_declaration'
    )
    const t = typeParam?.namedChildren.find(c => c.type === 'type_identifier')?.text ?? 'T'

    // `template<typename T> class C { … };` —— **樣板類別**。
    //
    // 🔴 這裡原本 `return null`，於是整段降級成 `unresolved`
    // （第三十二條護欄的最後 1 段缺口）。
    //
    // 處置：**把類別本體交給既有的 class 路徑**。樣板參數 `T` 在這個直譯器裡
    // 是**裝飾**——型別不參與求值，`vector<T> data` 與 `vector<int> data`
    // 執行起來一樣（見 `defaultValue` 對帶尖括號型別的處置）。
    //
    // ⚠️ 所以這不是「支援泛型」，是**讓它跑得動**。真的泛型要做型別替換與
    // 實例化，而那在一個型別是裝飾的直譯器裡沒有可觀察的差別——
    // 有差別的那天（型別檢查、多載解析）再說。
    const classSpec = node.namedChildren.find(c => c.type === 'class_specifier' || c.type === 'struct_specifier')
    if (classSpec) return ctx.lift(classSpec)

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
          params.push(buildVarDeclare({ type, name }))
        }
      }
    }

    const bodyNode = funcDef.childForFieldName('body')
    const body = extractBody(bodyNode ?? null, ctx)

    return buildTemplateFunc(t, returnType, funcName, params, body)
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
        return buildMalloc(targetType, size)
      }
    }

    // Default: regular cast
    const value = valueNode ? ctx.lift(valueNode) : null
    return buildCast(targetType, value)
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

    return buildLoopCount(varName, inclusive, {
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
    c.type === 'reference_declarator' || c.type === 'array_declarator' ||
    // 🔴 **沒有名字的陣列參數**（`void f(int[10])`）——2026-09-06 補。
    //    在此之前它不在這份清單裡，於是 `declNode` 是 `undefined`，
    //    產出變成 `void f(int)`：**`[10]` 整段消失，而沒有任何一顆節點說它降級了**。
    //
    // > **一個誠實的「我不會」，比一個安靜的「我改了你的程式」好。**
    c.type === 'abstract_array_declarator'
  )

  // If we have structured slots, use them
  if (typeNode || declNode) {
    const qualifier = qualifierNode?.text ? qualifierNode.text + ' ' : ''
    let type = qualifier + (typeNode?.text ?? 'int')
    let name = ''

    if (declNode) {
      if (declNode.type === 'pointer_declarator') {
        // 🔴 多層指標（`int** a`）的 AST 是巢狀的——見 `unwrapPointers`。
        //    只加一顆星、只找直接子的 identifier 的話，**型別少一顆星而名字是空的**。
        const { stars, inner } = unwrapPointers(declNode)
        type += '*'.repeat(stars)
        name = inner.type === 'identifier'
          ? inner.text
          : inner.namedChildren.find((c) => c.type === 'identifier')?.text ?? ''
      } else if (declNode.type === 'reference_declarator') {
        type += '&'
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? ''
      } else if (declNode.type === 'abstract_array_declarator') {
        // ⚠️ **原樣接上去**（`[10]`／`[]`）——它沒有名字，整段就是型別的一部分。
        //    🔴 而**大小要留著**：`int[10]` 與 `int[]` 在參數位置雖然等價，
        //    但那是 C++ 的規則，不是我們的——**改寫使用者的程式碼需要理由，
        //    而「反正等價」不是一個**。
        type += declNode.text
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
  if (lifted.componentId === '_compound') {
    return lifted.slots.body ?? []
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
