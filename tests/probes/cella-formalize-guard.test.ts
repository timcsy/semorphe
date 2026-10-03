/**
 * **探針：第六路的第一個讀數**（2026-09-25）
 *
 * 語義樹 → cella 項 → `cella holes`，而判準有**兩半**：
 *
 * ```
 * 判定版（守衛編成 Dec）   holes: 0     證明從 `| yes pf =>` 掉出來
 * 🔴 布林版（負向對照）     holes: 1     而且型別要是 `LtB u n`
 * ```
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
import cellaInit, { holes as cellaHoles, stdlib_mode } from 'cella-lang'
import { assets } from 'cella-lang/assets'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalizeFunction, CellaFormalizeError, type ContractSources } from './cella-formalize'
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
 * ## 不預載模式
 *
 * **不呼叫 `init_stdlib_cached`** ⟹ 單檔、不追 import、看不到 stdlib 的名字。
 * 那正是我們要的語義（我們的 prelude 刻意自足，見它的檔頭），
 * 而它也讓 `Nat`／`Bool`／`Dec` 不會跟 stdlib 撞名。
 *
 * 🔴 ⚠️ **stdlib 的狀態是整個行程共用的**：同一個 worker 裡只要有人呼叫過
 * `init_stdlib_cached`，之後的 `holes` 就變成預載模式——而那個模式切換的症狀
 * **不是紅，是綠**（我們的 prelude 少了什麼，stdlib 會補上）。
 * 所以下面有一條入口條件在問「我現在在哪個模式」。
 */

/** 語料 `AP325/7/7_6.cpp` 的形狀：讀進來的索引去取一個長度也是讀進來的陣列。 */
const SRC = `int pick(int n, int u, int fallback) {
  int A[n];
  if (u < n) return A[u];
  return fallback;
}`

let fn: SemanticNode
let contracts: ContractSources
let prelude: string
let parser: Parser

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

  // ⚠️ 一個行程 init 一次就夠；不預載模式連 stdlib 都不載（實測 init 約 30 ms）。
  await cellaInit({ module_or_path: fs.readFileSync(assets.wasm) })
}, 120_000)

interface hole { name: string | null; type: string }
interface checker { name: string; version: string; hash: string; covers: string[] }

/**
 * 🔴 **走 `--json`，不走文字版**（2026-10-03 換的）。
 *
 * 換的理由有兩個，而第二個比第一個重要：
 *
 * ```
 * ① 結構化      型別從 /LtB u n/ 這個 regex 變成 holes[i].type —— 不必剖字串
 * 🔴 ② 版本釘得住  文字版【完全沒有】版本資訊,而 --json 帶 checker
 * ```
 *
 * ⚠️ ②是一個實測到的缺口：2026-10-03 同一天，本機那支 cella 的
 * `checker.hash` 從 `2ff7b715…` 變成 `f2e02b1e…`，**而我們的探針一聲都不吭**
 * ——它這幾個月是對著「機器上剛好是哪一支」在綠的。
 *
 * ## 而雜湊**不上棘輪**，它進報表
 *
 * 對方每重建一次它就變。上棘輪的話這支測試會一直紅，而**一條會假紅的護欄，
 * 人很快就學會忽略它**（我們的 e2e 吃過這個虧）。
 *
 * 🟢 **它的工作是鑑識，不是閘門**：哪天這支紅了，報表上說得出那是對著哪一支 build。
 * 而真正當閘門的是下面那條入口條件——`covers` 要含 `kernel`。
 */
function holes(source: string, tag: string): { count: number; holes: hole[]; checker: checker; report: string } {
  void tag   // 保留參數：失敗訊息要說得出是哪一半（判定版／負向對照）
  const out = cellaHoles(source)
  let j: { ok?: boolean; holes?: hole[]; checker?: checker; errors?: unknown[] }
  try { j = JSON.parse(out) as never } catch {
    throw new Error(`cella 回的不是 JSON：${out.slice(0, 300)}`)
  }
  // ⚠️ `ok:false` 時【沒有】 holes 欄位——那是對方刻意的設計：
  //    「0 個洞」與「沒通過」在結構上分得開,不是靠一個數字。
  if (j.holes === undefined) {
    throw new Error(`cella 沒給 holes（多半是沒通過）：${out.slice(0, 300)}`)
  }
  if (j.checker === undefined) throw new Error(`cella 沒說它是哪一支：${out.slice(0, 300)}`)
  return { count: j.holes.length, holes: j.holes, checker: j.checker, report: out }
}

describe('探針：第六路（語義樹 → cella 項）', () => {
  it('★ 入口條件：語義樹真的是那個形狀（否則下面在編別的東西）', () => {
    expect(fn?.componentId, '入口不是函式定義').toBe('cpp:func_def')
    const ids = JSON.stringify(fn)
    expect(ids, '樹裡沒有比較 —— 守衛不見了').toContain('cpp:compare')
    expect(ids, '樹裡沒有取值 —— 前置條件的消費者不見了').toContain('cpp:array_at')
  })

  it('★ 入口條件：現在是【不預載】模式——預載的話,下面的綠會是假的', () => {
    // 🔴 行程共用的狀態:有人呼叫過 init_stdlib_cached 之後就回不去了。
    //    而那個切換的症狀是綠不是紅——我們的 prelude 少什麼,stdlib 會補上。
    expect(stdlib_mode(), '🔴 跑在預載模式 —— 我們自足的 prelude 會被 stdlib 補洞，'
      + '於是「它自足」這件事就沒有被驗到').toBe('standalone')
  })

  it('★ 入口條件：cella 說得出自己是誰，而且 kernel 真的在驗', () => {
    // 🔴 下面每一個「0 個洞」的綠，都預設了 kernel 有跑過。
    //    `covers` 哪天不含 kernel，那些綠的意思就變了——而那會是靜默的。
    const r = holes(formalizeFunction(fn, { contracts, prelude }), 'anchor')
    console.log(`\n⚙️ 對著 ${r.checker.name} ${r.checker.version}+${r.checker.hash}`
      + `（covers: ${r.checker.covers.join('、')}）`)
    expect(r.checker.hash, 'cella 沒給雜湊 —— 那表示這支測試說不出它對著哪一支 build 綠')
      .toMatch(/^[0-9a-f]{8,}$/)
    expect(r.checker.covers, '🔴 covers 不含 kernel —— 那下面每一個「0 個洞」的意思都變了')
      .toContain('kernel')
  })

  it('★ 入口條件：兩顆元件的形式核都讀得到（宣告與檔案不得分岔）', () => {
    expect(contracts.get('cpp:compare'), 'cpp:compare 的 paths.formalize 讀不到').toBeTruthy()
    expect(contracts.get('cpp:array_at'), 'cpp:array_at 的 paths.formalize 讀不到').toBeTruthy()
  })

  it('🔴 負向對照：守衛編成【布林】時，必須有一個洞，而且型別是 LtB u n', () => {
    const src = formalizeFunction(fn, { contracts, prelude, control: true })
    const r = holes(src, 'control')
    expect(r.count, `布林版應該剛好一個洞。cella 說：\n${r.report}`).toBe(1)
    // cella 建議的那一條：只數數量的話，在【錯的位置】開洞也會過。
    // 🟢 換成 `--json` 之後這裡讀的是結構化的型別，不是對整串輸出做 regex。
    expect(r.holes[0]?.type, `洞的型別不是 LtB u n：\n${r.report}`).toBe('LtB u n')
  })

  it('🟢 守衛編成【判定】時，零個洞 —— 證明從 yes 分支掉出來', () => {
    const src = formalizeFunction(fn, { contracts, prelude })
    const r = holes(src, 'dec')
    expect(r.count, `判定版應該零個洞。cella 說：\n${r.report}\n\n產出的項：\n${src}`).toBe(0)
  })

  it('★ 認不得的東西要擲例外，不准猜（猜出來的項會安靜地通過）', () => {
    const bad = { ...fn, properties: { ...fn.properties, return_type: 'std::string' } } as SemanticNode
    expect(() => formalizeFunction(bad, { contracts, prelude })).toThrow(/還不認得型別/)
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

  /** 嶾狀索引，而守衛正好涵蓋外層——外層拿得到證明，不開洞。 */
  const NESTED_GUARDED = `int pick(int n, int m, int u, int fallback) {
  int A[n];
  int B[m];
  if (B[u] < n) return A[B[u]];
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
    const body = out.split('\n').filter((l) => l.startsWith('  | yes')).join('\n')
    expect(body, `外層 arrayAt 的索引沒有括號：\n${out}`).toContain('(arrayAt ')
    // ★ 正向對照：單層的那一支不得被加上多餘的括號
    const flat = formalizeFunction(fn, { contracts, prelude })
    expect(flat, '單層的索引被加了括號 —— asArg 包過頭了').toContain('arrayAt n A u pf')
  })
})
