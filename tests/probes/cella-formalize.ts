/**
 * **第六路 `formalize`：語義樹 → cella 項**（2026-09-25，第一段）
 *
 * ## 名字（2026-09-25 拍板，第一版叫 `encode` 是錯的）
 *
 * `encode` 的常見意思是「編碼」——字元編碼、序列化、壓縮。它**說不出形式化，
 * 也說不出驗證**，過不了本 repo 的命名判準（「廣泛使用，**而且它的常見意思
 * 就是你要的那個意思**」）。
 *
 * 否決的另外兩個，以及理由：
 *
 * ```
 * contract   會讓 component.json 裡出現【兩個契約】（postconditions 與它），
 *            差別只在記法；而 contract 已經是整套方法論的名字
 * formal     `formal parameter`（形式參數）是標準 CS 詞彙，而且在一份元件宣告的
 *            脈絡裡比「形式化的」更常出現；且形容詞塞進名詞的位置
 * verify     🔴 階梯上只有 L3 為真。大部分元件永遠到不了 L3，
 *            而「已形式化」在 L0–L3 每一格都是真的
 * ```
 *
 * 🟢 **鍵命名「路」（動詞，與前五路同詞性），檔名命名「內容」**
 * ——`paths.formalize → ./contract.cella`，與 `paths.render → ./forms/blocks.json`
 * 同一個形狀。
 *
 * ## 它在問什麼
 *
 * 前五路問的是「產得出程式碼嗎／畫得出積木嗎／跑得動嗎」。
 * 這一路問的是**另一個問題**：
 *
 * > **這段程式的前置條件，在使用的那一點交得出來嗎？**
 *
 * 交不出來就是一個**洞**，而 2026-09-25 實測到洞的型別**逐字就是缺的那段契約**
 * （`?bound : LtB u n`，還帶著整個 scope 的變數名）。
 *
 * ## 🔴 為什麼守衛要編成【判定】而不是【布林】
 *
 * ```
 * if (u < n) A[u]    守衛回傳 Bool  → `| true =>` 分支裡【沒有】證明 → 洞
 *                    守衛回傳 Dec   → `| yes p =>` 的 p 【就是】證明 → 無洞
 * ```
 *
 * 而這條規則是**局部**的：`cpp:if` 只看「條件的 post 是不是 `Dec P`」，
 * 不讀控制流、不走樹、不比對守衛的語法。
 * （語料量過：342 個 `if` 條件裡 86% 的守衛直接涵蓋。）
 *
 * ## ⚠️ 這一路壞掉的症狀是【全綠】
 *
 * 一個編錯的編碼器會產出一個型別檢查得過、而驗的是**另一支程式**的項。
 * 所以有兩條紀律，都不可省：
 *
 * ```
 * ① 認不得的東西【擲例外】，不准猜        ← 猜出來的項會安靜地通過
 * ② 判準要有負向對照（布林版必須產出洞）   ← 只驗「0 個洞」的話，
 *                                           一個把整棵樹編成 unit 的編碼器也全綠
 * ```
 *
 * ## 範圍（刻意很窄）
 *
 * 今天只認得「一個函式 ＋ 一個陣列宣告 ＋ 一個守衛過的索引取值」那個形狀。
 * **不是通用編碼器**，而它的存在理由是產出第一個讀數，不是覆蓋語料。
 *
 * ⚠️ **零 I/O**：契約的來源由呼叫端餵進來（`contracts`），與核心的既有紀律一致。
 *
 * ## 🔴 為什麼這支走訪器住在 `tests/probes/` 而不是 `src/`
 *
 * 它搬過兩次，而**兩次都是護欄推的**：
 *
 * ```
 * ① src/core/projection/   中立性護欄紅 —— 核心不准認得任何語言的元件身分
 * ② src/languages/cpp/     就近性護欄紅（硬性零）—— 它在一個共用檔裡
 *                          對【七顆】元件的身分做分派，那就是「實作擴散」
 * ```
 *
 * > **護欄抓到的不是位置，是一個設計缺陷：
 * > 我把知識放進了程式碼，而那正是宣告要取代的東西。**
 *
 * 而誠實的判斷是：**這支走訪器今天是量測，不是產品**
 * ——零個產品呼叫者，唯一的消費者是它旁邊那支探針。
 *
 * 🟢 **宣告留在膠囊裡**（每顆元件自己的 `contract.cella` ＋
 * `postconditions.formalize`），**量測留在這裡**。src 與 tests 的分界就是
 * 「宣告」與「量測」的分界。
 *
 * 🪦 **它的歸宿寫在這裡，免得下一個人重推**：
 *
 * ```
 * 每顆元件自己資料夾裡的 formalize.ts，就像 generate.ts 那樣 ＋ 一張登錄表
 * 搬過去的觸發條件：【有產品消費者】——在那之前搬過去只是把量測碼放進 src
 * ```
 */
import type { SemanticNode } from '../../src/core/types'

/**
 * 一顆元件的形式核（`paths.formalize` 指到的那個 `.cella`）與**它依賴誰**。
 *
 * 🔴 `requires` 不是裝飾：`cpp:array_at` 的前置條件引用 `LtB`，而 `LtB` 定義在
 * `cpp:compare` 的形式核裡。依字母序發的話會得到 `unbound variable: LtB`
 * ——2026-09-25 第一刀當場撞到。
 *
 * > **一份「自足」的產物，它的自足是【依賴都在場而且順序對】，
 * > 不是【檔案只有一個】。**
 */
export type ContractSources = ReadonlyMap<string, string>

/** 一份形式核裡 `data`／`def`／`postulate` 定義了哪些名字。 */
function definedNames(src: string): Set<string> {
  const out = new Set<string>()
  for (const m of src.matchAll(/^\s*(?:@\[[^\]]*\]\s*)?(?:data|def|postulate)\s+([A-Za-z_][\w']*)/gm)) {
    out.add(m[1]!)
  }
  return out
}

/**
 * 依「誰定義了誰引用的名字」排出發的順序。
 *
 * 🔴 **這條依賴是【算出來的】，不是宣告的**——而那是被護欄推出來的：
 * 第一版在 `cpp:array_at` 的 `component.json` 寫 `requires: ["cpp:compare"]`，
 * 而就近性護欄的反向條當場紅（膠囊資料夾裡不得出現別顆元件的身分）。
 *
 * 🟢 而算出來比宣告好，理由是這個 repo 本來就有的那條：**別存導得出來的東西。**
 * `arrayAt` 引用 `LtB`、`LtB` 定義在 `cpp:compare` 的形式核裡——這件事**讀得出來**，
 * 不必有人記得寫。
 */
function topoSort(ids: readonly string[], contracts: ContractSources): string[] {
  const defines = new Map<string, Set<string>>()
  for (const id of ids) {
    const src = contracts.get(id)
    if (src !== undefined) defines.set(id, definedNames(src))
  }
  const deps = new Map<string, string[]>()
  for (const id of ids) {
    const src = contracts.get(id)
    if (src === undefined) { deps.set(id, []); continue }
    const body = src.replace(/^\s*--.*$/gm, '')
    const mine = defines.get(id)!
    deps.set(id, [...defines].filter(([other, names]) =>
      other !== id && [...names].some((n) => !mine.has(n) && new RegExp(`\\b${n}\\b`).test(body)),
    ).map(([other]) => other))
  }
  const out: string[] = []
  const done = new Set<string>()
  const visiting = new Set<string>()
  const visit = (id: string): void => {
    if (done.has(id)) return
    if (visiting.has(id)) throw new CellaFormalizeError(id, '形式核的依賴有環')
    visiting.add(id)
    for (const d of deps.get(id) ?? []) visit(d)
    visiting.delete(id); done.add(id); out.push(id)
  }
  for (const id of [...ids].sort()) visit(id)
  return out
}

export interface CellaFormalizeOptions {
  /**
   * 🔴 **負向對照**：把守衛編成布林測試而不是判定。
   *
   * 它**不是**一條支援的投影——它存在的唯一理由是讓判準有下半場
   * （「布林版必須產出 1 個洞」）。少了它，一個什麼都不做的編碼器也會是 0 個洞。
   */
  readonly control?: boolean
  /** 前言（`cella-prelude.cella` 的內容）。呼叫端讀檔，這裡不碰 I/O。 */
  readonly prelude: string
}

/** 這一路認不得的東西。**擲出來，不要猜**——猜出來的項會安靜地通過型別檢查。 */
export class CellaFormalizeError extends Error {
  readonly componentId: string
  constructor(componentId: string, reason: string) {
    super(`形式化編不了 ${componentId}：${reason}`)
    this.name = 'CellaFormalizeError'
    this.componentId = componentId
  }
}

const CPP_INT_TYPES = new Set(['int', 'long', 'long long', 'unsigned', 'size_t'])

/**
 * ⚠️ **這裡有兩張用【名字】當鍵的表，而名字是最誘人也最錯的鍵。**
 *
 * （2026-09-25，cella 那側踩到同一個形狀之後回報的：它用名字去重快取，
 * 把兩個不同模組的同名概念誤判成重複、丟掉一個；換成指標相等才對。）
 *
 * > **判斷「這兩個是同一個東西」時，名字是最誘人也最錯的鍵。**
 *
 * 這支走訪器今天的範圍（一個函式、沒有巢狀作用域）**碰不到那個坑**，
 * 而範圍一長就會碰到：`int A[n]; { int A[m]; A[0]; }` 會拿到錯的長度。
 *
 * 🔴 **所以兩張表都在覆寫時擲例外**——不可達的缺陷要是**吵的**，
 * 因為它一旦可達，症狀是【編出另一支程式】而不是報錯。
 *
 * 🟢 而 `used` 那一張用 `componentId` 當鍵是**對的**：身分本來就是登錄表的鍵，
 * 跨域唯一，同名就是同一顆。
 */
interface Env {
  /** 陣列名 → 它宣告的長度（已編成 cella 的項）。`arrayAt` 的第一個引數要它。 */
  readonly arraySize: Map<string, string>
  /** 目前在場的證明變數：謂詞的字串 → 綁在 pattern 裡的那個名字。 */
  readonly proofs: Map<string, string>
  readonly contracts: ContractSources
  readonly used: Set<string>
  readonly opts: CellaFormalizeOptions
}

function one(node: SemanticNode, slot: string): SemanticNode {
  const xs = node.slots[slot] ?? []
  if (xs.length !== 1) {
    throw new CellaFormalizeError(node.componentId, `槽 ${slot} 要恰好一個子節點，實際 ${xs.length} 個`)
  }
  return xs[0]!
}

/** 把一個 C++ 型別名對到 cella 的型別。**認不得就擲例外。** */
function mapType(componentId: string, cppType: string): string {
  if (CPP_INT_TYPES.has(cppType)) return 'Nat'
  throw new CellaFormalizeError(componentId, `還不認得型別 ${cppType}`)
}

/** 運算式。 */
function expr(node: SemanticNode, env: Env): string {
  env.used.add(node.componentId)
  switch (node.componentId) {
    case 'cpp:var_ref':
      return String(node.properties.name)

    case 'cpp:array_at': {
      const obj = one(node, 'obj')
      if (obj.componentId !== 'cpp:var_ref') {
        throw new CellaFormalizeError(node.componentId, '今天只認得「取一個具名陣列的值」')
      }
      const name = String(obj.properties.name)
      const size = env.arraySize.get(name)
      if (size === undefined) {
        throw new CellaFormalizeError(node.componentId, `找不到 ${name} 的長度宣告`)
      }
      const idx = expr(one(node, 'index'), env)
      // 🔴 前置條件在這裡兌現：在場有證明就用它，沒有就【開一個具名的洞】。
      //    洞的名字會出現在 blame 訊息裡，所以它要說得出缺的是什麼。
      const proof = env.proofs.get(`LtB ${idx} ${size}`) ?? `?bound_${idx}_lt_${size}`
      return `arrayAt ${size} ${name} ${idx} ${proof}`
    }

    default:
      throw new CellaFormalizeError(node.componentId, '這一路還不認得它')
  }
}

/**
 * 守衛。回傳「要 match 的那個項」與「它判定的謂詞」。
 *
 * 🔴 判定版回 `{ scrutinee: 'decLt u n', predicate: 'LtB u n' }`；
 *    對照組（布林）回 `{ scrutinee: 'ltNat u n', predicate: null }`——
 *    **沒有謂詞就沒有證明**，那正是要示範的那件事。
 */
function guard(node: SemanticNode, env: Env): { scrutinee: string; predicate: string | null } {
  env.used.add(node.componentId)
  if (node.componentId !== 'cpp:compare') {
    throw new CellaFormalizeError(node.componentId, '今天只認得「條件就是一個比較」那個形狀')
  }
  const op = String(node.properties.operator)
  if (op !== '<') {
    throw new CellaFormalizeError(node.componentId, `還沒有 ${op} 的宣告——見 component.json 的 _byOperator_why`)
  }
  const l = expr(one(node, 'left'), env)
  const r = expr(one(node, 'right'), env)
  return env.opts.control
    ? { scrutinee: `ltNat ${l} ${r}`, predicate: null }
    : { scrutinee: `decLt ${l} ${r}`, predicate: `LtB ${l} ${r}` }
}

/**
 * 一個函式。
 *
 * ⚠️ 今天只認得這個形狀，而它就是語料裡那個守衛過的索引取值：
 *
 * ```cpp
 * T f(…) { A[n 的宣告]; if (守衛) return 取值; return 退路; }
 * ```
 */
export function formalizeFunction(fn: SemanticNode, opts: CellaFormalizeOptions & { contracts: ContractSources }): string {
  if (fn.componentId !== 'cpp:func_def') {
    throw new CellaFormalizeError(fn.componentId, '入口要是一個函式定義')
  }
  const env: Env = {
    arraySize: new Map(), proofs: new Map(),
    contracts: opts.contracts, used: new Set(), opts,
  }

  const params: string[] = []
  for (const p of fn.slots.params ?? []) {
    params.push(`(${String(p.properties.name)} : ${mapType(fn.componentId, String(p.properties.type))})`)
  }

  const body = fn.slots.body ?? []
  const stmts = [...body]

  // ① 陣列宣告 → 一個參數（`Arr` 是 postulate，構造不出來，只能由外面給）
  while (stmts.length > 0 && stmts[0]!.componentId === 'cpp:array_declare') {
    const decl = stmts.shift()!
    env.used.add(decl.componentId)
    const name = String(decl.properties.name)
    const elem = mapType(decl.componentId, String(decl.properties.type))
    const size = expr(one(decl, 'size'), env)
    // ⚠️ 見 `Env` 的檔頭：名字當鍵，覆寫要吵。
    if (env.arraySize.has(name)) {
      throw new CellaFormalizeError(decl.componentId, `陣列名 ${name} 被遮蔽了——名字當鍵在這裡不成立`)
    }
    env.arraySize.set(name, size)
    params.push(`(${name} : Arr ${elem} ${size})`)
  }

  // ② `if (守衛) return X; return Y;` → 一次 match
  if (stmts.length !== 2 || stmts[0]!.componentId !== 'cpp:if' || stmts[1]!.componentId !== 'cpp:return') {
    throw new CellaFormalizeError(fn.componentId, '今天只認得「一個 if 加一個結尾 return」那個形狀')
  }
  const [ifNode, tail] = stmts as [SemanticNode, SemanticNode]
  env.used.add(ifNode.componentId)
  env.used.add(tail.componentId)

  const g = guard(one(ifNode, 'condition'), env)
  const thenStmts = ifNode.slots.then_body ?? []
  if (thenStmts.length !== 1 || thenStmts[0]!.componentId !== 'cpp:return') {
    throw new CellaFormalizeError(ifNode.componentId, 'then 分支今天只認得一個 return')
  }

  // 🔴 **證明在這裡進到脈絡裡**，而這是整條規則唯一做的事：
  //    條件的 post 是 `Dec P` ⟹ then 分支多一個 `p : P`。
  if (g.predicate !== null) {
    // ⚠️ 這張表的鍵是【印出來的謂詞】，而遮蔽會讓兩個不同的謂詞印成同一個樣子。
    //    今天碰不到（一層作用域），而碰到的那天要吵不要猜。
    if (env.proofs.has(g.predicate)) {
      throw new CellaFormalizeError(ifNode.componentId, `謂詞 ${g.predicate} 已經在場——印出來的形式當鍵在這裡不成立`)
    }
    env.proofs.set(g.predicate, 'pf')
  }
  const thenExpr = expr(one(thenStmts[0]!, 'value'), env)
  env.proofs.clear()
  const elseExpr = expr(one(tail, 'value'), env)

  const ret = mapType(fn.componentId, String(fn.properties.return_type))
  const arms = g.predicate !== null
    ? `  | yes pf => ${thenExpr}\n  | no _ => ${elseExpr}`
    : `  | true => ${thenExpr}\n  | false => ${elseExpr}`

  // ③ 前言 ＝ 基礎 ＋ 用到的每一顆元件的形式核，**依算出來的依賴拓樸排序**。
  //    ⚠️ 字母序會壞：`cpp:array_at` 排在 `cpp:compare` 前面 ⟹ unbound variable: LtB
  const cores: string[] = []
  for (const id of topoSort([...env.used], opts.contracts)) {
    const src = opts.contracts.get(id)
    if (src !== undefined) cores.push(src.trimEnd())
  }

  return [
    `-- 由第六路從語義樹產生（${opts.control ? '🔴 負向對照：守衛編成布林' : '守衛編成判定'}）`,
    '',
    opts.prelude.trimEnd(),
    '',
    ...cores.flatMap((c) => [c, '']),
    `def ${String(fn.properties.name)} ${params.join(' ')} : ${ret} :=`,
    `  match ${g.scrutinee} with`,
    arms,
    '',
  ].join('\n')
}
