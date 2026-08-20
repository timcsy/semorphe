/**
 * **探測（不是護欄）**：學生或 AI 寫的**典型** Arduino 程式，貼進來轉不轉得動。
 *
 * ## 它從哪來
 *
 * 使用者 2026-08-17 逐字：「**至少讓學生在寫 Arduino 程式的時候可以雙向轉換，
 * 然後甚至 AI 給的 Code 他們貼上來也是可以順利雙向轉換的。**」
 *
 * → [history/077](../../knowledge/history/077-虛擬硬體往後推而先做寬度.md)
 *
 * ## 🔴 而它與 `fuzz-cpp-hardware` 量的是【不同的母體】
 *
 * ```
 * fuzz-cpp-hardware   難度 hard ＋「刻意的陷阱」   → 問「極限在哪」
 * 本檔                 典型的、AI 會寫的            → 問「日常會不會壞」
 * ```
 *
 * ⚠️ **兩個都需要，而它們的數字不可互相解讀。**
 * 前者 20 段裡 7 段執行通過；本檔 20 段裡殘差 0.07%。
 * **同一個系統，兩個數字，而它們沒有矛盾**——因為問的是兩件事。
 *
 * ## 這支不檢測什麼
 *
 * - 🔴 **不檢測執行結果**——`g++` 編不動 sketch，而 Arduino 的裁判是 `arduino-cli`
 *   （`history/071`：**裁判的能力邊界是【目標】的函數**）。那是第 6 項的事。
 * - **不檢測套件的語義**——`Servo`／`DHT`／`WiFi` 的行為沒有被模擬，
 *   本檔只問「**辨識得出來、轉得回去**」。
 * - **不檢測積木長什麼樣**——只走程式碼那一側。
 *
 * ## ⚠️ 自我否證
 *
 * > **如果載入的語料段數低於下限，代表語料檔沒讀到，這份報表不算數
 * > ——不是「殘差是 0」。**
 *
 * 錨在**載入幾段**（合成量）。🔴 **刻意不錨在殘差數**——那正是要推向零的東西
 * （`build-guardrail` 第 2 步簽名一）。
 *
 * ## 為什麼是探測而不是護欄
 *
 * ⚠️ **今天不知道目標值。** 殘差該推向零沒錯，而「漂移 0/20」是不是穩定的
 * 還沒有第二次量測佐證（`build-guardrail` 6.5：先跑、確認、最後才產基線）。
 * 🟢 而它有一天該變成護欄——目標值明確（殘差 0、漂移 0）。
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
  fs.readFileSync(path.join(process.cwd(), 'tests/probes/arduino-realistic-corpus.json'), 'utf8'),
) as Record<string, { board: string; topic: string; libraries: string[]; code: string }>

/** 結構指紋——比對兩次 lift 的樹是否等價 */
const shape = (n: SemanticNode): string =>
  `${n.componentId}(${Object.entries(n.children ?? {}).map(([k, v]) =>
    `${k}:[${(v as SemanticNode[]).map(shape).join(',')}]`).join(' ')})`

/** ⚠️ 殘差通道有兩個身分：核心 Level 4 的裸 `raw_code`／`unresolved`，與膠囊的 `cpp:raw_code`。 */
const RESIDUAL = /^(raw_code|cpp:raw_code|raw_expression|cpp:raw_expression|unresolved)$/

function tally(n: SemanticNode, a = { resid: 0, total: 0, kinds: new Set<string>() }): typeof a {
  a.total++
  if (RESIDUAL.test(n.componentId)) { a.resid++; a.kinds.add(n.componentId) }
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) tally(k, a)
  return a
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

describe('探測：典型 Arduino 程式貼進來轉不轉得動', () => {
  it('★ 殘差率 ＋ round-trip 漂移率', () => {
    const rows: string[] = []
    let complete = 0, fragment = 0, residNodes = 0, allNodes = 0, drift = 0, textDrift = 0

    for (const [id, g] of Object.entries(CORPUS)) {
      const tree = parser.parse(g.code)!
      // 🔴 **語料分欄**——那條殘差護欄付過 200 倍的學費：
      // 「第一版量成 48.83%（正確值 0.23%），**錯的不是程式是語料**」。
      // ⚠️ 而**兩欄都要記**：只記完整那一欄的話，濾掉語料會看起來像改善。
      if (tree.rootNode.hasError) fragment++
      else complete++

      const t1 = createTestLifter().lift(tree.rootNode as never) as SemanticNode
      const a = tally(t1)
      residNodes += a.resid; allNodes += a.total

      const g1 = generateCode(t1, 'cpp', S)
      const t2 = createTestLifter().lift(parser.parse(g1)!.rootNode as never) as SemanticNode
      const g2 = generateCode(t2, 'cpp', S)
      const d = shape(t1) !== shape(t2)
      const td = g1 !== g2
      if (d) drift++
      if (td) textDrift++

      if (a.resid > 0 || d || td) {
        rows.push(`  ✘ ${id}（${g.board}／${g.topic}）` +
          `${a.resid ? ` 殘差 ${a.resid}/${a.total} [${[...a.kinds].join(',')}]` : ''}` +
          `${d ? ' 🔴樹漂移' : ''}${td ? ' 🔴文字漂移' : ''}`)
      }
    }

    console.log(
      `\n  典型 Arduino 語料：語法完整 ${complete}／片段 ${fragment}\n` +
      `  殘差 ${residNodes}/${allNodes} 節點 = ${(residNodes / allNodes * 100).toFixed(2)}%\n` +
      `  round-trip：樹漂移 ${drift}/${complete + fragment}｜文字漂移 ${textDrift}/${complete + fragment}\n` +
      (rows.length ? rows.join('\n') : '  （全部乾淨）'))

    // ★ 入口條件——錨在**載入幾段**（合成量），見檔頭的自我否證
    expect(
      complete + fragment,
      '🔴 語料沒讀到 → 這份報表不算數。⚠️ 這不代表「殘差是 0」。',
    ).toBeGreaterThanOrEqual(15)

    // ⚠️ 而**語法完整那一欄也要有下限**：一批全是片段的語料，殘差再低也不算數
    expect(complete, '🔴 語料裡沒有一段是語法完整的').toBeGreaterThanOrEqual(15)
  }, 120000)
})
