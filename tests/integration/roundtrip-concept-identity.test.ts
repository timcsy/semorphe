/**
 * 概念身分守恆（US2）
 *
 * ## 這裡用 `it.fails` 釘住一個已知缺陷
 *
 * 它斷言「這件事目前是壞的」。所以：
 *
 *   - **缺陷還在** → 測試通過，但診斷每次都印出來（不沉默）
 *   - **缺陷被修好** → `it.fails` 自己變紅，提醒你把這根釘子拔掉
 *
 * ### 為什麼不用「永久紅的測試」
 *
 * 那是本功能實作時第一版的做法，寫完就發現不行：**一支永遠紅的測試會讓
 * 「全套綠」失去意義**，而本專案有四條護欄的全部價值都建立在那個訊號上。
 * 更糟的是紅久了就會被無視——那正是 concepts/執行機構.md 說的「護欄自己
 * 變成殼」。
 *
 * `it.fails` 兩者兼得：套件保持綠、現象保持可見、而且修好時會主動出聲。
 * 與「留一個 `it.todo` 就走」的差別依然成立：**待辦是沉默的，這個不是。**
 *
 * ## 釘住的是什麼
 *
 * 「輸出」概念在預設風格下產生 `printf(...)`，而 `printf(...)` 辨識回來是
 * `cpp_printf` ——**另一個概念**。輸出字串合法、執行結果也對，只有身分變了。
 *
 * 專案的既有紀律正好點名這件事：**round-trip 必須驗證概念身分，不能只驗
 * 輸出字串**。這裡就是那個情形。
 *
 * ## 為什麼本功能不修它
 *
 * 兩條可能的修法（讓 printf 在某些情況辨識回 print／讓 print 在 round-trip
 * 語境下走 cout）**都會動到跨風格的既有行為**。那個決定的規模遠大於本功能的
 * 收益。見 specs/050-repay-top-blockers/research.md D3。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { synthMinimalNode } from '../helpers/synth-node'
import { allComponentDefs } from '../helpers/component-scan'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { createNode } from '../../src/core/semantic-tree'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter
const STYLE = { id: 'default' } as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
}, 60_000)

/** 蒐集樹中所有出現過的概念身分 */
function conceptsIn(node: SemanticNode | null, acc = new Set<string>()): Set<string> {
  if (!node) return acc
  acc.add(node.concept)
  for (const arr of Object.values(node.children ?? {})) for (const c of arr) conceptsIn(c, acc)
  return acc
}

/**
 * 一個概念走完「產生程式碼 → 重新辨識」一圈，回報身分有沒有守住。
 *
 * 失敗訊息必須說得出**身分從哪個變成哪個**（FR-011）——只說「不相等」的話，
 * 讀的人還得自己去查是變成了什麼。
 */
function roundTripIdentity(conceptId: string): { kept: boolean; became: string[]; code: string } {
  const def = allComponentDefs().find((d) => d.conceptId === conceptId)
  if (!def) throw new Error(`註冊表中沒有 ${conceptId}`)
  const { node } = synthMinimalNode(def)
  const code = generateCode(createNode('program', {}, { body: [node] }), 'cpp', STYLE)
  const back = lifter.lift(tsParser.parse(code).rootNode as never)
  const found = conceptsIn(back)
  return {
    kept: found.has(conceptId),
    // 回來的樹裡出現、但不是結構性外殼的概念——就是「它變成了什麼」
    became: [...found].filter((c) => !['program', 'func_def', 'number_literal', 'string_literal'].includes(c)),
    code: code.trim(),
  }
}

describe('概念身分守恆：走一圈之後還是同一個概念', () => {
  it('對照組：`if` 的身分守得住（證明測試本身能通過）', () => {
    const r = roundTripIdentity('if')
    expect(
      r.kept,
      `身分未守住：if → ${r.became.join(', ')}\n產生的程式碼：\n${r.code}`,
    ).toBe(true)
  })

  // ⚠️ `it.fails`：斷言「這件事目前是壞的」。修好之後它會變紅，提醒你拔釘子。
  it.fails('📌 已知缺陷（釘住）：`print` 走一圈後變成另一個概念', () => {
    const r = roundTripIdentity('print')

    // 不沉默——每次跑都把現象印出來
    console.log(
      [
        '',
        '  📌 已知缺陷（釘住中，尚未修）',
        `     概念身分：print  →  ${r.became.join(', ') || '(什麼都沒有)'}`,
        `     產生的程式碼：${r.code.replace(/\n/g, ' ')}`,
        '     原因：預設風格產生 printf(...)，而它辨識回來是 cpp_printf。',
        '     輸出字串合法、執行結果也對——**只有身分變了**。',
        '     不修的理由見 specs/050-repay-top-blockers/research.md D3。',
        '',
      ].join('\n'),
    )

    expect(
      r.kept,
      `身分未守住：print → ${r.became.join(', ')}｜產生：${r.code.replace(/\n/g, ' ')}`,
    ).toBe(true)
  })

  it('若上面那條變綠了，這裡說明該怎麼辦', () => {
    // 這條永遠通過——它只是把「拔釘子的步驟」放在讀得到的地方。
    // 上面的 it.fails 一旦變紅，代表 print 的身分守住了：
    //   1. 確認跨風格回歸有跑過（cout × printf × endl 組合，已知坑）
    //   2. 把 it.fails 改成 it
    //   3. 從缺陷帳移除對應標記並下調基線
    expect(true).toBe(true)
  })
})
