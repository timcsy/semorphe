/**
 * 概念身分守恆
 *
 * ## 這裡曾經釘著一個不存在的缺陷
 *
 * `specs/050` 用 `it.fails` 釘住「`print` 走一圈後變成 `cpp_printf`」，並判定
 * 修它會動到跨風格的既有行為，因而擱置。
 *
 * **那個缺陷不存在。** 當時的測試傳的是 `{ id: 'default' }`——一個假的風格
 * 物件。於是 `io_style` 是 undefined，產生器走了非預期的分支產出 `printf(...)`。
 * 換成真的 `apcs`（`io_style: "cout"`，也是應用程式的預設）之後，`print` 與
 * `input` 都完整守住身分。
 *
 * **釘住一個量測假象，比不釘更糟**——它讓後續每一個讀到的人相信系統壞了。
 *
 * ## `it.fails` 這個機制本身是對的
 *
 * 它按設計運作了：假象一被修掉，那支測試立刻變紅提醒拔釘子。**問題不在機制，
 * 在釘之前沒有先確認缺陷是真的。**
 *
 * 教訓：合成測試的**環境**也要真實，不只輸入要真實。
 * 見 specs/057、`knowledge/experience.md`「量測工具的第一版會安靜地量錯」
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
import apcsPreset from '../../src/languages/cpp/styles/apcs.json'

let tsParser: Parser
let lifter: Lifter
/**
 * **用真的風格預設，不要造一個假的。**
 *
 * 原本這裡是 `{ id: 'default' }`——一個不存在的風格。於是 `io_style` 是
 * undefined，產生器走了非預期的分支：`print` 產生 `printf(...)`、`input`
 * 產生 `scanf(...)`，再辨識回來自然變成 `cpp_printf`／`cpp_scanf`。
 *
 * **那被記錄成「概念身分在 round-trip 後改變」的已知缺陷，而它其實不存在**
 * ——換成真的 apcs（`io_style: "cout"`，也是應用程式的預設）之後，
 * `print` 與 `input` 都完整守住身分。
 *
 * 教訓：合成測試的**環境**也要真實，不只輸入要真實。
 * 見 specs/057、`knowledge/experience.md`「量測工具的第一版會安靜地量錯」
 */
const STYLE = apcsPreset as unknown as StylePreset

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
  acc.add(node.conceptId)
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
  const code = generateCode(createNode('cpp:program', {}, { body: [node] }), 'cpp', STYLE)
  const back = lifter.lift(tsParser.parse(code).rootNode as never)
  const found = conceptsIn(back)
  return {
    kept: found.has(conceptId),
    // 回來的樹裡出現、但不是結構性外殼的概念——就是「它變成了什麼」
    became: [...found].filter((c) => !['cpp:program', 'cpp:func_def', 'cpp:literal_number', 'cpp:literal_string'].includes(c)),
    code: code.trim(),
  }
}

describe('概念身分守恆：走一圈之後還是同一個概念', () => {
  it('對照組：`if` 的身分守得住（證明測試本身能通過）', () => {
    const r = roundTripIdentity('cpp:if')
    expect(
      r.kept,
      `身分未守住：if → ${r.became.join(', ')}\n產生的程式碼：\n${r.code}`,
    ).toBe(true)
  })

  it('`print` 走一圈之後仍然是 `print`', () => {
    const r = roundTripIdentity('cpp:print')
    expect(
      r.kept,
      `身分未守住：print → ${r.became.join(', ')}｜產生：${r.code.replace(/\n/g, ' ')}`,
    ).toBe(true)
  })

  it('`input` 走一圈之後仍然是 `input`', () => {
    const r = roundTripIdentity('cpp:input')
    expect(r.kept, `身分未守住：input → ${r.became.join(', ')}`).toBe(true)
  })

  it('★ 用真的風格預設——假的風格會讓這支測試量到不存在的缺陷', () => {
    // 這一支釘住的是**測試環境**而不是被測系統。
    // 用 `{ id: 'default' }` 這種假物件時，產生器會走非預期的分支，
    // 於是 print 產出 printf(...)、辨識回來變成 cpp_printf——看起來像缺陷。
    expect((STYLE as unknown as { io_style?: string }).io_style).toBe('cout')
  })

})
