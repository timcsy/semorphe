/**
 * **測試用的共用 Cella 判決入口**（spec 198，重構 6c-1）。
 *
 * 走產品同一條路：tree-sitter 解析 → lift → formalize → Cella 判決（與 `tests/probes/binding-verdict.test.ts` 同一條）。
 *
 * ```
 * runCella(code, opts)            → 完整判決（給刻意驗 reject／unknown 的測試）
 * expectCellaOut(code, out, opts) → accept 且輸出相同才通過；其餘一律失敗並說清楚
 * ```
 *
 * 🔴 **判不出來、翻不出來、判定有錯都算失敗**——不是跳過、不是空字串（P6 誠實降級；6c 測試盤點的風險 2）。
 * ⚠️ 模組在每個測試檔裡只準備一次（懶建、Promise 快取）；跨檔讀建置時編好的那一份（`tools/cella-module-cache.ts`，鍵與建置工具同一份）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from './setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { formalize } from '../../src/providers/cella/formalize'
import { checkerFromBytes, checkerSource, compileCellaChecker, type CellaChecker, type CellaProblem } from '../../src/providers/cella/verdict'
import { cachedCellaModule } from '../../tools/cella-module-cache'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')

export interface ProblemSource { line: number; text: string }
export interface CellaRunProblem extends CellaProblem { source?: ProblemSource }
export interface CellaRunResult {
  verdict: 'accept' | 'reject' | 'unknown' | 'invalid' | 'untranslated'
  out: string
  problems: CellaRunProblem[]
  /** formalize 翻不出時：構造與原因 */
  untranslated: { construct: string; reason: string }[]
  assumes: { implementation: string; choice: string }[]
  /** 判決 JSON 原樣（板子上的程式另有 pins／env／clock——Arduino 的膠囊測試要讀它們；spec 201）；翻不出時是 null */
  raw: Record<string, unknown> | null
}
export interface CellaRunOptions {
  stdin?: string
  /** 步數上限（預設 1,000,000） */
  steps?: number
  lang?: 'cpp' | 'c'
  /** Cella 的板名（`uno`、`esp32`…，見 `cellaBoardOf`）——有板子就走 arduino 分支，預設步數跟產品一樣放大到 5,000 萬（spec 201） */
  board?: string
  /** 板子的環境輸入（`@cella-lang/arduino` README：`{ t: 毫秒, key: 'analog:A0' | 'digital:2' | 'echo:10' | …, value }`）——放在程式 JSON 的 board 旁邊 */
  inputs?: { t: number; key: string; value: number }[]
}

let ready: Promise<{ parser: Parser; checker: CellaChecker }> | null = null

/** 懶建：解析器與判決器在每個測試檔裡只準備一次 */
function prepare(): Promise<{ parser: Parser; checker: CellaChecker }> {
  ready ??= (async () => {
    await Parser.init({ locateFile: (s: string) => path.join(ROOT, 'public', s) })
    const parser = new Parser()
    parser.setLanguage(await Language.load(path.join(ROOT, 'public/tree-sitter-cpp.wasm')))
    registerCppLanguage()
    const read = (pkg: string | null, file: string): Uint8Array =>
      fs.readFileSync(path.join(ROOT, 'node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))
    const { bytes } = await cachedCellaModule('verdict-cfamily', checkerSource('cfamily'), () => compileCellaChecker(read, 'cfamily'), { root: ROOT })
    return { parser, checker: await checkerFromBytes(bytes) }
  })()
  return ready
}

/** `at` 是語義樹的 id，或 `<id>/<角色>`、`<id>#<槽>`——對回原始碼的那一段 */
function locate(tree: SemanticNode, code: string, at: string | undefined): ProblemSource | undefined {
  if (!at) return undefined
  const ids = [at, at.split(/[/#]/)[0]]
  let hit: SemanticNode | undefined
  const walk = (n: SemanticNode): void => {
    if (hit) return
    if (ids.includes(n.id)) { hit = n; return }
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(tree)
  const r = hit?.metadata?.sourceRange as { startLine: number; startColumn: number; endLine: number; endColumn: number } | undefined
  if (!r) return undefined
  const lines = code.split('\n')
  const text = r.startLine === r.endLine
    ? lines[r.startLine]?.slice(r.startColumn, r.endColumn)
    : lines.slice(r.startLine, r.endLine + 1).join('\n')
  return { line: r.startLine + 1, text: (text ?? '').trim().slice(0, 120) }
}

/** 完整判決——不擋任何判決種類 */
export async function runCella(code: string, opts: CellaRunOptions = {}): Promise<CellaRunResult> {
  const { parser, checker } = await prepare()
  const tree = createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
  const fz = formalize(tree, { lang: opts.lang ?? 'cpp', board: opts.board })
  if (!fz.program) {
    return {
      verdict: 'untranslated', out: '', problems: [], assumes: [], raw: null,
      untranslated: (fz.unknown as { construct: string; reason: string }[]).map((u) => ({ construct: u.construct, reason: u.reason })),
    }
  }
  const program = opts.inputs ? { ...(fz.program as Record<string, unknown>), inputs: opts.inputs } : fz.program
  const v = checker.verdict(program, opts.stdin ?? '', opts.steps ?? (opts.board ? 50_000_000 : 1_000_000))
  return {
    verdict: v.verdict,
    out: v.out,
    problems: v.problems.map((p) => ({ ...p, source: locate(tree, code, p.at) })),
    untranslated: [],
    assumes: v.assumes ?? [],
    raw: v as unknown as Record<string, unknown>,
  }
}

/** 一段說得出「為什麼不是 accept」的訊息 */
export function describeCellaResult(r: CellaRunResult): string {
  if (r.verdict === 'untranslated') {
    return `翻不出（formalize 不收）：\n${r.untranslated.map((u) => `  · ${u.construct}：${u.reason}`).join('\n')}`
  }
  const lines = r.problems.map((p) => {
    const where = p.source ? `第 ${p.source.line} 行「${p.source.text}」` : `節點 ${p.at ?? '?'}`
    return `  · ${p.kind}${p.reason ? `：${p.reason}` : ''}（${where}）`
  })
  return `Cella 判 ${r.verdict}${lines.length ? `：\n${lines.join('\n')}` : ''}${r.out ? `\n  已印出：${JSON.stringify(r.out.slice(0, 200))}` : ''}`
}

/** accept 且輸出相同才通過；判不出來、翻不出來、判定有錯一律拋錯並說清楚 */
export async function expectCellaOut(code: string, expected: string, opts: CellaRunOptions = {}): Promise<CellaRunResult> {
  const r = await runCella(code, opts)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  if (r.out !== expected) {
    throw new Error(`Cella 判 accept，但輸出不同：\n  期望 ${JSON.stringify(expected)}\n  實際 ${JSON.stringify(r.out)}`)
  }
  return r
}

/**
 * 已知缺陷的釘子（spec 199）：包住一段原本用 `expectCellaOut` 寫的本體，斷言它【還】失敗、而且原因吻合 `why`。
 * 缺陷還在＝綠；修好的那天（本體不再丟錯）它會紅——那時拿掉這層包裝。原因變了（換成另一個缺陷）也會紅。
 * 不用 `it.skip`：skip 在缺陷修好時一聲都不出，也不檢查缺陷是不是還是同一個（`audit-defect-ledger` 的棘輪也不准 skip 變多）。
 */
export async function knownCellaGap(why: RegExp, body: () => Promise<unknown>): Promise<void> {
  try {
    await body()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (why.test(msg)) return
    throw new Error(`已知缺陷的形狀變了（期望原因吻合 ${why}）：\n${msg}`)
  }
  throw new Error('這個已知缺陷不在了：本體整段通過——拿掉 knownCellaGap 這層包裝，讓它變回一般的測試')
}

/** 板子程式的最終狀態（判決的 `env`，原樣是一段 JSON 字串）——spec 201：Arduino 的膠囊測試讀腳位、時鐘、伺服、液晶、EEPROM */
export interface CellaBoardEnv {
  clockUs: number
  loops: number
  pins: { pin: number; mode: string | null; level: number | null; pwm: number | null; toneHz: number | null }[]
  servos: unknown[]
  lcds: unknown[]
  eeprom: unknown[]
}
export function boardEnv(r: CellaRunResult): CellaBoardEnv {
  const env = r.raw?.env
  if (typeof env !== 'string') throw new Error(`判決沒有板子的狀態（不是板子程式，或判決不是 accept）：\n${describeCellaResult(r)}`)
  return JSON.parse(env) as CellaBoardEnv
}
/** 一支腳的最終狀態；那支腳從沒被碰過就是 undefined */
export const boardPin = (r: CellaRunResult, pin: number): CellaBoardEnv['pins'][number] | undefined =>
  boardEnv(r).pins.find((p) => p.pin === pin)
