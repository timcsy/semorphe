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
import { execFileSync } from 'node:child_process'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalizeFunction, type ContractSources } from './cella-formalize'
import type { SemanticNode } from '../../src/core/types'

const CELLA_BIN = process.env.CELLA_BIN
  ?? path.join(os.homedir(), 'Documents/Projects/cella/target/release/cella')
const HAVE_CELLA = fs.existsSync(CELLA_BIN)

/** 語料 `AP325/7/7_6.cpp` 的形狀：讀進來的索引去取一個長度也是讀進來的陣列。 */
const SRC = `int pick(int n, int u, int fallback) {
  int A[n];
  if (u < n) return A[u];
  return fallback;
}`

let fn: SemanticNode
let contracts: ContractSources
let prelude: string

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  const parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  const root = createTestLifter().lift(parser.parse(SRC)!.rootNode as never) as SemanticNode
  fn = (root.slots.body ?? [])[0] as SemanticNode

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
}, 120_000)

function holes(source: string, tag: string): { count: number; report: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'semorphe-cella-'))
  const file = path.join(dir, `${tag}.cella`)
  fs.writeFileSync(file, source)
  const out = execFileSync(CELLA_BIN, ['holes', file], { encoding: 'utf8', timeout: 120_000 })
  const m = /holes:\s*(\d+)/.exec(out)
  if (!m) throw new Error(`讀不出洞的數量，cella 說：${out.slice(0, 300)}`)
  return { count: Number(m[1]), report: out }
}

describe.skipIf(!HAVE_CELLA)('探針：第六路（語義樹 → cella 項）', () => {
  it('★ 入口條件：語義樹真的是那個形狀（否則下面在編別的東西）', () => {
    expect(fn?.componentId, '入口不是函式定義').toBe('cpp:func_def')
    const ids = JSON.stringify(fn)
    expect(ids, '樹裡沒有比較 —— 守衛不見了').toContain('cpp:compare')
    expect(ids, '樹裡沒有取值 —— 前置條件的消費者不見了').toContain('cpp:array_at')
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
    expect(r.report, `洞的型別不是 LtB u n：\n${r.report}`).toMatch(/LtB u n/)
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

describe.skipIf(HAVE_CELLA)('探針：第六路（跳過）', () => {
  it('⚠️ 找不到 cella 的執行檔 —— 這一批沒有跑', () => {
    console.log(`\n⚠️ 第六路探針跳過：${CELLA_BIN} 不存在。設 CELLA_BIN 指到它。`)
    expect(HAVE_CELLA).toBe(false)
  })
})
