/**
 * **探針：第六路的第一個讀數**（2026-09-25）
 *
 * 語義樹 → cella 項 → `cella holes`，而判準有**兩半**：
 *
 * ```
 * 判定版（守衛編成 Dec）   holes: 1     LtB 的證明從 `| yes pf =>` 掉出來，剩 NonNeg
 * 🔴 布林版（負向對照）     holes: 2     多出來的那一個型別要是 `LtB 32 u n`
 * ```
 *
 * 🔴 **2026-10-05 起是 1 與 2，不是 0 與 1**——那是換掉 `Nat` 的結果，不是退步。
 * 索引用 `Nat` 時負數不存在，於是 `if (u < n) return A[u];` 判 0 個洞；
 * 換成 `cpp.IntN`（cella 的原則 C15）之後多一個 `NonNeg 32 u`，而**它是真的**：
 * `u = -1` 在 C++ 裡是越界。**舊的「0 個洞」是對另一支程式的判決。**
 *
 * ## ⚠️ 下半場不可省，而理由踩過五次
 *
 * 只驗「0 個洞」的話，**一個把整棵樹編成 `unit` 的編碼器也會全綠**。
 * 而這條線上「量測工具自己的缺陷」已經出現五次，其中一次逐字就是
 * 「`Err`（沒編過）被併進『無洞』那一格，於是最壞的情況看起來最好」。
 *
 * 🔴 **而洞的【型別】也要斷言**（cella 那側建議的）：只驗「有 1 個洞」的話，
 * 一個在**錯的位置**開洞的編碼器也會過。
 *
 * ## 這一路壞掉的症狀是全綠
 *
 * 編錯的項會型別檢查得過、而驗的是**另一支程式**。所以編碼器對認不得的東西
 * **擲例外而不猜**，而這裡再加一層：**負向對照 ＋ 洞的型別**。
 *
 * ⚠️ 需要 cella 的執行檔（`CELLA_BIN`，預設在姊妹專案的 `target/release/cella`）。
 * 沒有就跳過——而跳過會出聲，不會靜默通過。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import cellaInit, {
  check as cellaCheck, stdlib_mode, init_stdlib_explicit, load_module_pack, load_library_pack,
} from 'cella-lang'
import { assets } from 'cella-lang/assets'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalizeFunction, CellaFormalizeError, INT_BITS, type ContractSources } from './cella-formalize'
import type { SemanticNode } from '../../src/core/types'

/**
 * 🔴 **從 CLI 改讀 npm 套件**（2026-10-04）——而這一刀的重點不是「換個呼叫方式」，
 * 是**這支探針第一次在 CI 上跑**。
 *
 * 在此之前它是 `describe.skipIf(!HAVE_CELLA)`，而 CI 上沒有那支執行檔：
 *
 * > **一條只在裝了 cella 的機器上跑的護欄，CI 上等於不存在。**
 *
 * ⚠️ 而**刻意不留跳過的退路**：`cella-lang` 是 devDependency，`npm ci` 之後
 * 一定在。一條會自己跳過的護欄，它的覆蓋率等於有人記得裝東西。
 *
 * ## explicit 模式（2026-10-05，與 cella 定案的）
 *
 * `init_stdlib_explicit` ⟹ base 在、**沒有任何隱式匯入**：程式只看得到自己
 * `import` 的模組（連 prelude 也要寫）。`@cella-lang/cpp` 疊在上面。
 *
 * 🔴 ⚠️ **模式仍是整個行程共用的**，所以判準不再只信 `stdlib_mode()`：
 * 每一份判決帶 `imports`（它實際看得到的模組＋檢查器指紋），下面**逐次**斷言它
 * ——與第 303 刀同一招：**每一次判決自己的欄位，不是行程或建置期的常數**。
 *
 * 🪦 舊版是 `standalone`（什麼都不載、prelude 自己定義 `Nat`）。接上 cpp 之後那會
 * 讓我們的 `Nat` 與 std 的 `Nat` 成為兩個型別、宣告時無警告——見 prelude 的檔頭。
 * 模式名刻意另立（不沿用 `standalone`），讓舊斷言**紅一次**而不是換了意思還綠著。
 *
 * ⚠️ **`holes()` 在 explicit 模式下不認 `import`**（2026-10-05 量到，已回報 cella），
 * 所以洞從 `check()` 的 `unknown`（`reason: "hole"`）讀，一次呼叫拿到全部。
 */

/** 語料 `AP325/7/7_6.cpp` 的形狀：讀進來的索引去取一個長度也是讀進來的陣列。 */
const SRC = `int pick(int n, int u, int fallback) {
  int A[n];
  if (u < n) return A[u];
  return fallback;
}`

/** 一個**會被判 accept** 的錨：守衛之後兩邊都只回傳變數，沒有取值、沒有算術。 */
const MAX = `int mx(int a, int b) {
  if (a < b) return b;
  return a;
}`

let fn: SemanticNode
let contracts: ContractSources
let prelude: string
let parser: Parser
/** cella-lang 自己說的檢查器指紋（`package.json` 的 `cella.checkerHash`）。 */
let checkerHash: string
/** `load_library_pack` 的回覆（`{"ok":true}` 或帶理由的拒絕）。 */
let libLoad: { ok: boolean; error?: string }
/** 一個【只有那幾行 import】的檔，它的判決看得到哪些模組——我們的產出不得多於它。 */
let importBase: string[]

/** 把一段 C++ lift 成它的第一個函式。 */
function liftFn(src: string): SemanticNode {
  const root = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  return (root.slots.body ?? [])[0] as SemanticNode
}

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  fn = liftFn(SRC)

  // 🔴 **讀的是宣告說的那個檔**（`paths.formalize`），不是寫死的路徑——
  //    宣告與形式核分岔的話，這裡要紅。
  const m = new Map<string, string>()
  for (const dir of fs.readdirSync('src/components/cpp')) {
    const manifest = path.join('src/components/cpp', dir, 'component.json')
    if (!fs.existsSync(manifest)) continue
    const decl = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
      componentId: string
      paths?: Record<string, string | null>
    }
    const rel = decl.paths?.formalize
    if (typeof rel !== 'string') continue
    m.set(decl.componentId, fs.readFileSync(path.join('src/components/cpp', dir, rel), 'utf8'))
  }
  contracts = m
  prelude = fs.readFileSync('src/languages/cpp/cella-prelude.cella', 'utf8')

  // ⚠️ 一個行程 init 一次就夠。
  const R = (u: URL): Uint8Array => fs.readFileSync(fileURLToPath(u))
  await cellaInit({ module_or_path: R(assets.wasm) })
  init_stdlib_explicit(R(assets.stdlib))
  const libDir = path.join(process.cwd(), 'node_modules/@cella-lang/cpp')
  const index = fs.readFileSync(path.join(libDir, 'index.json'), 'utf8')
  const req = (JSON.parse(index) as { requires: Record<string, { modules: string[] }> }).requires['cella-lang']!
  for (const m of req.modules) load_module_pack(R(assets.module(m)))
  libLoad = JSON.parse(load_library_pack(index, 'cpp', fs.readFileSync(path.join(libDir, 'cpp.cell')))) as never
  checkerHash = (JSON.parse(fs.readFileSync('node_modules/cella-lang/package.json', 'utf8')) as
    { cella: { checkerHash: string } }).cella.checkerHash
  importBase = verdict(prelude).imports.map((i) => i.module).sort()
}, 120_000)

interface checker { name: string; version: string; hash: string; covers: string[] }
interface Verdict {
  verdict: string
  /** 洞的型別（`unknown` 裡 `reason: "hole"` 那幾筆的 `detail`）。 */
  holes: string[]
  imports: { module: string; checker: string }[]
  assumptions: { kind: string; name?: string }[]
  unknown: { reason?: string; detail?: string }[]
  warnings: { message: string }[]
  checker: checker
  report: string
}

/**
 * 🔴 **走 `check` 的 JSON**——洞、假設、匯入、檢查器都在同一份判決裡。
 *
 * ⚠️ `checker.hash` **不上棘輪**，它進報表（對方每重建一次它就變）；
 * 真正的閘門是下面的入口條件：逐份判決的 `imports` 與 kernel 重驗欄位。
 */
function verdict(source: string): Verdict {
  const out = cellaCheck(source)
  let j: Partial<Verdict> & { unknown?: { reason?: string; detail?: string }[] }
  try { j = JSON.parse(out) as never } catch {
    throw new Error(`cella 回的不是 JSON：${out.slice(0, 300)}`)
  }
  if (j.checker === undefined) throw new Error(`cella 沒說它是哪一支：${out.slice(0, 300)}`)
  if (j.imports === undefined) throw new Error(`cella 的判決沒有 imports —— 版本不對？${out.slice(0, 300)}`)
  const unknown = j.unknown ?? []
  return {
    verdict: String(j.verdict),
    holes: unknown.filter((u) => u.reason === 'hole').map((u) => String(u.detail)),
    imports: j.imports, assumptions: j.assumptions ?? [], unknown,
    warnings: j.warnings ?? [], checker: j.checker, report: out,
  }
}

describe('探針：第六路（語義樹 → cella 項）', () => {
  it('★ 入口條件：語義樹真的是那個形狀（否則下面在編別的東西）', () => {
    expect(fn?.componentId, '入口不是函式定義').toBe('cpp:func_def')
    const ids = JSON.stringify(fn)
    expect(ids, '樹裡沒有比較 —— 守衛不見了').toContain('cpp:compare')
    expect(ids, '樹裡沒有取值 —— 前置條件的消費者不見了').toContain('cpp:array_at')
  })

  it('★ 入口條件：explicit 模式，而 cpp Library 疊上去了', () => {
    // 🔴 預載模式下 stdlib 會自動匯入，我們沒寫的 import 也看得到 ——症狀是綠不是紅。
    expect(stdlib_mode(), '🔴 不是 explicit 模式 —— 判決可能用到我們沒宣告的模組').toBe('explicit')
    expect(libLoad, `🔴 @cella-lang/cpp 疊不上去：${libLoad?.error ?? ''}`).toEqual({ ok: true })
  })

  it('★ 入口條件：這一份判決【只用到】我們 import 的模組，而且是同一支檢查器建的', () => {
    const v = verdict(formalizeFunction(fn, { contracts, prelude }))
    const mods = v.imports.map((i) => i.module).sort()
    console.log(`\n📦 判決看得到的模組：${mods.join('、')}`)
    expect(mods, '🔴 判決裡沒有 cpp —— 契約沒有站在 Library 上').toContain('cpp')
    // 「只有 import 那幾行的檔」看得到什麼，我們的產出就只能看得到什麼
    // ——契約與函式本身不得再帶進別的模組。
    expect(mods, '🔴 產出的項比 prelude 多看到了模組').toEqual(importBase)
    for (const i of v.imports) {
      expect(i.checker, `🔴 模組 ${i.module} 是另一支檢查器建的`).toBe(checkerHash)
    }
  })

  /**
   * 🔴 **這一條第一版是假的，而那是 cella 那側抓到的**（2026-10-04）。
   *
   * 第一版斷言 `checker.covers` 要含 `kernel`，訊息還寫著
   * 「covers 不含 kernel ⟹ 下面每一個『0 個洞』的意思都變了」。
   *
   * ⚠️ 而 `covers` 是**建置期的常數**——它說的是「`checker.hash` 這個指紋
   * 涵蓋了哪些原始碼」，每一份判決都一樣，永遠是 `["kernel","elaborator"]`。
   *
   * ```
   * ⟹ 那條斷言【永遠會過】。它守不住任何東西,
   *    而它的訊息還宣稱自己守得住 —— 那比沒有斷言更糟
   * ```
   *
   * > **一條永遠綠的斷言，加上一句說明它守著什麼的話，
   * > 是兩個錯：它不量東西，而且它讓人以為有人在量。**
   *
   * 🟢 **逐份判決的那兩個欄位在 `check` 裡**（對方給的）：
   * `assumptions` 裡的 `not_rechecked_by_kernel`、`unknown` 裡的 `kernel_skipped`。
   * ⚠️ 而 `holes` 的輸出**沒有**那兩個欄位（它只有 `ok` / `holes` / `checker`），
   * 所以這裡要多叫一次 `check`。
   */
  it('★ 入口條件：這一份判決，kernel 真的重驗過', () => {
    // ⚠️ 錨換成 `mx`（2026-10-05）：`pick` 現在有一個真的洞（`NonNeg`），判 unknown，
    //    而這一條要的是一份 **accept** 的判決——kernel 重驗過的那一種。
    const src = formalizeFunction(liftFn(MAX), { contracts, prelude })
    const v = verdict(src)
    const r = v
    const assumptions = v.assumptions
    /**
     * 🔴 **兩種假設的【信任等級不同】，所以分開印**（2026-10-04，cella 那側更正）。
     *
     * 我第一版把 `termination_by_elaborator` 讀成「假設的，不是證出來的」
     * ——**那是錯的**。它的意思是：
     *
     * ```
     * postulate                  我們自己扛的 —— 【沒有任何人查過】
     * termination_by_elaborator  Cella 的終止檢查【查過了】,
     *                            而兩個 kernel 都沒有獨立重驗
     *                            ⟹ 是「只有一份檢查」,不是「沒人查」
     * ```
     *
     * ⚠️ 混在一起印的話，讀的人會把「沒人查」與「只查了一次」當成同一件事
     * ——而它們差一個數量級。
     */
    const ours = assumptions.filter((x) => x.kind === 'postulate')
    const once = assumptions.filter((x) => x.kind !== 'postulate')
    console.log(`\n⚙️ 對著 ${r.checker.name} ${r.checker.version}+${r.checker.hash}`
      + `\n   判決 ${v.verdict}，而它站在這些假設上：`)
    console.log(`   🔴 我們自己扛的（沒有任何人查過）：${ours.length}`)
    for (const x of ours) console.log(`        ${x.kind} · ${x.name ?? ''}`)
    console.log(`   🟡 Cella 查過而沒有第二份重驗：${once.length}`)
    for (const x of once) console.log(`        ${x.kind} · ${x.name ?? ''}`)

    expect(r.checker.hash, 'cella 沒給雜湊 —— 那表示這支測試說不出它對著哪一支 build 綠')
      .toMatch(/^[0-9a-f]{8,}$/)
    // 🔴 這兩條才是【逐份判決】的
    expect(
      assumptions.map((a) => a.kind),
      '🔴 這份判決帶著 `not_rechecked_by_kernel` —— 那表示第二個 kernel 沒有重驗，'
      + '而下面每一個「0 個洞」的意思就變了',
    ).not.toContain('not_rechecked_by_kernel')
    expect(
      v.unknown.map((u) => u.reason),
      '🔴 判決裡有 `kernel_skipped`',
    ).not.toContain('kernel_skipped')
    expect(v.verdict, `🔴 錨沒有 accept —— 下面在驗一個站不住的東西\n${v.report}\n\n${src}`)
      .toBe('accept')
  })

  it('★ 入口條件：兩顆元件的形式核都讀得到（宣告與檔案不得分岔）', () => {
    expect(contracts.get('cpp:compare'), 'cpp:compare 的 paths.formalize 讀不到').toBeTruthy()
    expect(contracts.get('cpp:array_at'), 'cpp:array_at 的 paths.formalize 讀不到').toBeTruthy()
  })

  it('🔴 負向對照：守衛編成【布林】時，兩個洞，而其中一個是 LtB 32 u n', () => {
    const src = formalizeFunction(fn, { contracts, prelude, control: true })
    const v = verdict(src)
    // cella 建議的那一條：只數數量的話，在【錯的位置】開洞也會過。⟹ 型別逐字。
    expect([...v.holes].sort(), `布林版的洞不對。cella 說：\n${v.report}\n\n${src}`)
      .toEqual(['LtB 32 u n', 'NonNeg 32 u'])
  })

  it('🟢 守衛編成【判定】時，LtB 的洞消失 —— 證明從 yes 分支掉出來；NonNeg 還在', () => {
    const src = formalizeFunction(fn, { contracts, prelude })
    const v = verdict(src)
    // 🔴 剩下的那一個【是真的】：`u = -1` 在 C++ 裡越界，而守衛 `u < n` 擋不住它。
    expect(v.holes, `判定版應該只剩 NonNeg。cella 說：\n${v.report}\n\n產出的項：\n${src}`)
      .toEqual(['NonNeg 32 u'])
  })

  it('🔴 平台：同一個 `a + b`，桌機的洞是 32 位元的範圍、Arduino 的是 16 位元的', () => {
    // 這一條量的是「profile 真的穿過走訪器進到型別裡」——
    // 只量 lp64 的話，一個把寬度寫死成 32 的走訪器也會全綠。
    const add = liftFn('int add(int a, int b) { return a + b; }')
    for (const profile of ['lp64', 'avr'] as const) {
      const v = verdict(formalizeFunction(add, { contracts, prelude, profile }))
      expect(v.holes.length, `${profile}：a + b 應該剛好一個洞（不溢位）。\n${v.report}`).toBe(1)
      expect(v.holes[0], `${profile}：洞的寬度不對`).toMatch(new RegExp(`^cpp\\.InRange ${INT_BITS[profile]} `))
    }
  })

  it('★ 認不得的東西要擲例外，不准猜（猜出來的項會安靜地通過）', () => {
    const bad = { ...fn, properties: { ...fn.properties, return_type: 'std::string' } } as SemanticNode
    expect(() => formalizeFunction(bad, { contracts, prelude })).toThrow(/還不認得型別/)
    // 🔴 `unsigned` 舊版對到 Nat；Library 沒有無號的語義（環繞），所以它現在也擲
    const uns = { ...fn, properties: { ...fn.properties, return_type: 'unsigned' } } as SemanticNode
    expect(() => formalizeFunction(uns, { contracts, prelude })).toThrow(/還不認得型別/)
  })
})

/**
 * 🔴 **第六路產出的項，語法上站不站得住**（2026-09-30）。
 *
 * 起點是 cella 那側的一句提醒：「`bound_${idx}_lt_${size}` 只要 idx、size
 * 是單純的識別字或數字也沒問題；若它們可能是運算式，組名字前要先清掉。」
 *
 * 拿嶾狀索引量一次，而同一行裡有**兩個**缺陷：
 *
 * ```
 * arrayAt n A arrayAt m B u ?bound_u_lt_m ?bound_arrayAt m B u ?bound_u_lt_m_lt_n
 *             ~~~~~~~~~~~~                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *             ① 子運算式沒有括號      ② 洞名帶空白（cella 說的那個）
 * ```
 *
 * 🔴 **① 比 ② 嚴重**：② 是一個 cella 載不進去的檔（吵的），
 * 而 ① 是**編出另一支程式**——本檔檔頭逐字寫著的那件事。
 *
 * ⚠️ 這一支**不需要 cella 的執行檔**，所以它不在 `skipIf` 裡
 * ——一條只在裝了 cella 的機器上跑的護欄，CI 上等於不存在。
 */
describe('探針：第六路產出的項，語法上站得住（不需要 cella）', () => {
  /** 嶾狀索引，而外層的前置條件沒有被守衛涵蓋——外層要開洞。 */
  const NESTED = `int pick(int n, int m, int u, int fallback) {
  int A[n];
  int B[m];
  if (u < n) return A[B[u]];
  return fallback;
}`

  /**
   * 子運算式出現在**守衛**裡（`B[u] < n`），而 then 分支不再取外層。
   *
   * ⚠️ 2026-10-05 前這裡是 `return A[B[u]]`（守衛涵蓋外層的 `LtB`）。
   * 換成 `cpp.IntN` 之後外層多一個 `NonNeg (arrayAt …)` 的洞，而它的名字組不成識別字
   * ⟹ 擲例外，那一支量不到括號了。所以括號改在守衛那裡量——同一個 `asArg`。
   */
  const NESTED_GUARDED = `int pick(int n, int m, int u, int fallback) {
  int A[n];
  int B[m];
  if (B[u] < n) return n;
  return fallback;
}`

  it('★ 入口條件：兩段都 lift 得出函式（否則下面在量別的東西）', () => {
    expect(liftFn(NESTED)?.componentId).toBe('cpp:func_def')
    expect(liftFn(NESTED_GUARDED)?.componentId).toBe('cpp:func_def')
  })

  it('🔴 洞的名字塞不進一個運算式時，要擲例外——不准產出一個 cella 載不進去的檔', () => {
    expect(() => formalizeFunction(liftFn(NESTED), { contracts, prelude }))
      .toThrow(CellaFormalizeError)
    expect(() => formalizeFunction(liftFn(NESTED), { contracts, prelude }))
      .toThrow(/洞的名字組不成合法的識別字/)
  })

  it('🔴 子運算式當引數時要加括號——沒加的話編出來的是【另一支程式】', () => {
    const out = formalizeFunction(liftFn(NESTED_GUARDED), { contracts, prelude })
    expect(out, `守衛裡的 arrayAt 沒有括號：\n${out}`)
      .toContain('decLt (arrayAt m B u ?nonneg_u ?bound_u_lt_m) n')
    // ★ 正向對照：單層的那一支不得被加上多餘的括號
    const flat = formalizeFunction(fn, { contracts, prelude })
    expect(flat, '單層的索引被加了括號 —— asArg 包過頭了').toContain('arrayAt n A u ?nonneg_u pf')
  })
})
