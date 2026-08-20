/**
 * **探測（不是護欄）**：用到**第 0 批九顆**的典型 Arduino 程式，貼進來轉不轉得動。
 *
 * ## 它與姊妹探測 `arduino-realistic.test.ts` 的分工
 *
 * ```
 * arduino-realistic   泛用主題（LED／LCD／WiFi／RFID…）  問「日常會不會壞」
 * 本檔                 主題【集中】在蜂鳴器／超音波／      問「剛做的那九顆撐不撐得住
 *                     序列埠互動／非阻塞計時                真實用法」
 * ```
 *
 * ⚠️ **兩份的數字不可直接互比**——母體不同。而**兩份都要留**：
 * 一份主題集中的語料量出來的殘差，代表不了泛用情況，反之亦然。
 *
 * ## 🔴 出題者沒有被告知那九個函式名
 *
 * 提示裡只寫了**四個主題**（蜂鳴器／超音波／序列埠／非阻塞計時），
 * 而九顆裡有 **7 顆自然出現**。
 *
 * > **一份「照著清單寫」的語料，量出來的覆蓋率是自己給自己的分數。**
 *
 * ⚠️ 而沒出現的兩顆（`micros`／`analogReadResolution`）**也是資訊**：
 * 它們在典型程式裡少見——`millis` 幾乎壟斷了計時，而解析度設定是 ESP32 專屬的少數寫法。
 * 🔴 **那不代表它們不該做**（貼進來的程式一旦有，就必須認得），
 * 而是**不該用它們來宣稱覆蓋率**。
 *
 * ## 這支不檢測什麼
 *
 * - 🔴 **不檢測執行結果**——`g++` 編不動 sketch，而 Arduino 的裁判是 `arduino-cli`
 *   （這個專案沒接）。**「編得過」不在本檔的宣稱範圍內。**
 * - **不檢測套件的語義**——`Servo` 的行為沒有被模擬，只問「辨識得出來、轉得回去」。
 *
 * ## ⚠️ 自我否證
 *
 * > **如果載入的語料段數低於下限，代表語料檔沒讀到，這份報表不算數
 * > ——不是「殘差是 0」。**
 *
 * 錨在**載入幾段**（合成量）。🔴 **刻意不錨在殘差數**——那正是要推向零的東西。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
const CORPUS = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/probes/arduino-builtins-corpus.json'), 'utf8'),
) as Record<string, { board: string; topic: string; libraries: string[]; code: string }>

const shape = (n: SemanticNode): string =>
  `${n.componentId}(${Object.entries(n.children ?? {}).map(([k, v]) =>
    `${k}:[${(v as SemanticNode[]).map(shape).join(',')}]`).join(' ')})`

const RESIDUAL = /^(raw_code|cpp:raw_code|raw_expression|cpp:raw_expression|unresolved)$/
/** 🔴 降級成【通用呼叫】——文字照樣對，而學生的畫布上是一顆通用積木。 */
const GENERIC = /^cpp:(func_call|method_call)$/

function tally(
  n: SemanticNode,
  a = { resid: 0, generic: 0, total: 0, kinds: new Set<string>(), seen: new Set<string>() },
): typeof a {
  a.total++
  a.seen.add(n.componentId)
  if (RESIDUAL.test(n.componentId)) { a.resid++; a.kinds.add(n.componentId) }
  if (GENERIC.test(n.componentId)) a.generic++
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) tally(k, a)
  return a
}

/** 第 0 批九顆的身分。 */
const BATCH0 = [
  'cpp:micros', 'cpp:delay_microseconds', 'cpp:tone', 'cpp:tone_stop', 'cpp:pulse_read',
  'cpp:math_constrain', 'cpp:analog_resolution', 'cpp:serial_count', 'cpp:serial_read',
]

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

describe('探測：用到第 0 批九顆的典型 Arduino 程式', () => {
  it('★ 殘差率 ＋ round-trip 漂移率 ＋ 概念身分', () => {
    const rows: string[] = []
    let complete = 0, fragment = 0, residNodes = 0, allNodes = 0
    let drift = 0, textDrift = 0, genericNodes = 0
    const covered = new Set<string>()

    for (const [id, g] of Object.entries(CORPUS)) {
      const tree = parser.parse(g.code)!
      // 🔴 語料分欄——兩欄都記，不可為了讓比率好看而濾掉語料
      if (tree.rootNode.hasError) fragment++
      else complete++

      const t1 = createTestLifter().lift(tree.rootNode as never) as SemanticNode
      const a = tally(t1)
      residNodes += a.resid; allNodes += a.total; genericNodes += a.generic
      for (const c of a.seen) if (BATCH0.includes(c)) covered.add(c)

      const g1 = generateCode(t1, 'cpp', S)
      const t2 = createTestLifter().lift(parser.parse(g1)!.rootNode as never) as SemanticNode
      const g2 = generateCode(t2, 'cpp', S)
      const d = shape(t1) !== shape(t2)
      const td = g1 !== g2
      if (d) drift++
      if (td) textDrift++

      if (a.resid > 0 || a.generic > 0 || d || td) {
        rows.push(`  ✘ ${id}（${g.board}／${g.topic}）` +
          `${a.resid ? ` 殘差 ${a.resid}/${a.total} [${[...a.kinds].join(',')}]` : ''}` +
          `${a.generic ? ` 🔴降級成通用呼叫 ${a.generic}` : ''}` +
          `${d ? ' 🔴樹漂移' : ''}${td ? ' 🔴文字漂移' : ''}`)
      }
    }

    const missed = BATCH0.filter((c) => !covered.has(c))
    console.log(
      `\n  主題集中語料（蜂鳴器／超音波／序列埠／非阻塞計時）：語法完整 ${complete}／片段 ${fragment}\n` +
      `  殘差 ${residNodes}/${allNodes} 節點 = ${(residNodes / allNodes * 100).toFixed(2)}%\n` +
      `  降級成通用呼叫 ${genericNodes} 個節點\n` +
      `  round-trip：樹漂移 ${drift}/${complete + fragment}｜文字漂移 ${textDrift}/${complete + fragment}\n` +
      `  第 0 批覆蓋：${covered.size}/9${missed.length ? `　未被語料碰到：${missed.join('、')}` : ''}\n` +
      (rows.length ? rows.join('\n') : '  （全部乾淨）'))

    // ★ 入口條件——錨在**載入幾段**（合成量），不錨在殘差
    expect(
      complete + fragment,
      '🔴 語料沒讀到 → 這份報表不算數。⚠️ 這不代表「殘差是 0」。',
    ).toBeGreaterThanOrEqual(15)
    expect(complete, '🔴 語料裡沒有一段是語法完整的').toBeGreaterThanOrEqual(15)

    // ⚠️ 而「這批語料真的用到了新概念」也要有下限——
    //    否則一批完全沒碰到第 0 批的語料，殘差再低也證明不了這九顆。
    expect(
      covered.size,
      '🔴 語料沒有碰到足夠多的第 0 批概念 → 它證明不了這一批',
    ).toBeGreaterThanOrEqual(5)
  }, 120000)
})
