/**
 * **探針：那 218 支學生的程式，我們的解譯器跑出來的，和真實編譯器一樣嗎。**
 *
 * ## 🔴 它補的是那四個面向都沒看的那一格（2026-09-16）
 *
 * 使用者：「你有幫我驗證語料庫的執行結果與模擬的是一致的嗎？」——沒有。
 * 四支 `studycpp-*` 探針裡 `interpret`／`execute` 的出現次數是 **0**：
 * 它們量的全是形狀（殘差、不動點、載得進工作區、宣告的形狀）。
 *
 * > **殘差量的是「我沒認出來」，而它對「我認錯了」保持沉默。
 * > 而形狀層的「認錯」與行為層的「認錯」，也不是同一件事。**
 *
 * ## ⚠️ 測資怎麼來——使用者拍板「依照題目生」
 *
 * 那批是 AP325／TIOJ／zeroJudge 的題目，**大多要讀 stdin**，而語料沒有測資。
 * 做法是**問程式自己**：語義樹裡有每一次讀取的型別與順序，照那個生。
 *
 * 🔴 而判準是「**兩邊餵同一份**」，不是「這份輸入對那一題有意義」——
 * 輸入合不合題意不影響「g++ 印 A 而我們印 B」這個判定。
 * 型別要對（拿 `abc` 餵 `cin >> n` 會讓後面全部失效），數量要夠（不能餓死）。
 *
 * ## 判準有三層（CLAUDE.md 記過，少一層就會追到雜訊）
 *
 * ```
 * ① 先問參照編譯器「這一段是合法的 C++ 嗎」  不問 → 追自己造的雜訊
 * ② 兩邊餵一模一樣的 stdin                    不同 → 比的是輸入不是行為
 * ③ 文字不同 ≠ 錯，行為不同才是              不分 → 正規化會被算成缺陷
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { runCppBatchDetailed, hasReferenceCompiler } from '../helpers/run-cpp'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const DIR = process.env.STUDYCPP_DIR ?? ''

/**
 * **同時最多編幾支**——🔴 **這個數字是一次當機換來的**（2026-09-16）。
 *
 * 第一版寫 8，而這一支探針要編 204 支**含 `bits/stdc++.h`** 的程式
 * （單支峰值 94 MB、0.64 秒）。實測那天的系統紀錄：
 *
 * ```
 * 14:51  17 支 clang 同時在 unnest DYLD 共享區
 * 14:51:16  kernel: memorystatus: killing_idle_process …（接下來 2,880 次）
 * 14:57  使用者重開機
 * ```
 *
 * 而 kernel 自己說出了機制——每一支 clang 都會把原本**共用**的動態庫區段解巢：
 *
 * > `triggered unnest of DYLD shared region` …
 * > **this increases system memory footprint until the target exits**
 *
 * ⚠️ 所以「峰值 94 MB × N」**低估了**：真正的成本包含那份不再共享的區段，
 * 而它在 `ps` 的 RSS 上看不出來。
 *
 * 🪦 而讓它變重的正是我以為在修的那一步：補 `bits/stdc++.h` 墊片之前，
 * 218 支裡有 206 支在第一行就失敗（幾乎免費）；補上之後它們**真的去編**了。
 *
 * > **一個把「大部分都失敗」修成「大部分都成功」的修法，
 * > 會把一個近乎 no-op 的動作變成真正的負載——而它的帳單不在那份報告裡。**
 *
 * 🟢 判準不是「挑一個小一點的數字」，是**留給機器其他東西用的餘裕**：
 * 這支探針跑在 vitest 裡，而 vitest 自己還開著十幾支 worker。
 */
const COMPILE_CONCURRENCY = 3

function files(): string[] {
  if (!DIR || !fs.existsSync(DIR)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.cpp')) out.push(p)
    }
  }
  walk(DIR)
  return out.sort()
}

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const FS = files()

describe.skipIf(FS.length === 0 || !hasReferenceCompiler())(
  '探針：學生的程式，解譯器與參照編譯器跑出來一不一樣', () => {

  it('① 地基：這 218 支裡，參照編譯器收下幾支', async () => {
    const srcs = FS.map((f) => fs.readFileSync(f, 'utf8'))
    const res = await runCppBatchDetailed(srcs, COMPILE_CONCURRENCY, srcs.map(() => ''))
    const compileFail = res.filter((r) => !r.ok && r.stage === 'compile')
    const runFail = res.filter((r) => !r.ok && r.stage === 'run')
    console.log([
      `  總共            ${FS.length}`,
      `  編得過而跑得完  ${res.filter((r) => r.ok).length}`,
      `  編不過          ${compileFail.length}`,
      `  編得過而跑不完  ${runFail.length}   ← 多半是等 stdin（空輸入餵下去）`,
    ].join('\n'))
    expect(FS.length).toBeGreaterThan(200)
  }, 600_000)

  /**
   * ② **不用讀輸入的那一批**——零生成器風險的第一個數字。
   *
   * 🔴 兩邊都餵空的，所以這一格量的純粹是「同一支程式，兩個執行器的輸出一樣嗎」。
   */
  it('② 不用輸入的那些：兩邊的輸出一樣嗎', async () => {
    const srcs = FS.map((f) => fs.readFileSync(f, 'utf8'))
    const ref = await runCppBatchDetailed(srcs, 8, srcs.map(() => ''))
    const rows: { f: string; want: string; got: string; why: string }[] = []
    let same = 0, lifted = 0
    for (let i = 0; i < FS.length; i++) {
      const r = ref[i]
      if (!r.ok || r.output === null) continue
      lifted++
      let got = ''
      let why = ''
      try {
        const tree = lifter.lift(tsParser.parse(srcs[i]).rootNode as never) as SemanticNode
        const out: string[] = []
        const interp = new SemanticInterpreter({ maxSteps: 2_000_000 })
        interp.setOutputCallback((x) => out.push(x))
        await interp.execute(tree, [])
        got = out.join('')
      } catch (e) {
        why = `解譯器拋了：${String((e as Error).message).slice(0, 90)}`
      }
      // ⚠️ ③ 文字不同 ≠ 錯：只正規化行尾與尾端空白，**不碰內容**
      const norm = (x: string): string =>
        x.replace(/\r\n/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '')
      if (why === '' && norm(got) === norm(r.output)) same++
      else rows.push({ f: path.relative(DIR, FS[i]), want: r.output, got, why })
    }
    console.log([
      `  參照編譯器跑得完的  ${lifted}`,
      `  兩邊一模一樣        ${same}   （${((same / lifted) * 100).toFixed(1)}%）`,
      `  對不上              ${rows.length}`,
      '',
      ...rows.slice(0, 12).map((x) =>
        `  ✘ ${x.f}\n      ${x.why || `g++ ${JSON.stringify(x.want.slice(0, 70))}\n      我們 ${JSON.stringify(x.got.slice(0, 70))}`}`),
    ].join('\n'))
    expect(lifted).toBeGreaterThan(100)
  }, 900_000)
})
