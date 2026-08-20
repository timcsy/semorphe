/**
 * spec 142 · User Story 2：**貼上的程式碼仍然被完整理解。**
 *
 * ## 🔴 這是這一刀最容易做錯的方向
 *
 * 把「拿不到」實作成「認不得」——讓 lift 去問目標，於是 Uno 學生貼一段
 * ESP32 的範例進來，`touchRead` 降級成 `raw_code`。
 *
 * 那違反 P4 逐字：
 *
 * > 「**這是過濾（filtering），不是簡化（simplification）**
 * > ——語義結構始終完整，只是投影時隱藏超出層級的節點」
 *
 * ⚠️ **今天它本來就成立**（`lift` 完全不看目標），所以這幾支一開始就是綠的。
 * 它們守的是**未來**：有人把過濾往上游搬的那一天。
 *
 * `skills/build-guardrail` 第 9 步逐字：
 * 「**正確的輸入**：證明它**不亂報**。第二個不可省。」
 *
 * ## 本測試不檢測什麼
 *
 * - **不檢測工具箱**——那是 `board-target-visibility.test.ts`
 * - **不檢測執行**——ESP32 的觸摸感應沒有虛擬硬體（`history/077`）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { filterByTarget, capabilityOf } from '../../src/core/component/traits'
import unoTarget from '../../src/languages/cpp/targets/arduino-uno.json'
import type { SemanticNode, StylePreset, Target } from '../../src/core/types'

const STYLE: StylePreset = {
  id: 'google', name: { 'zh-TW': 'Google', en: 'Google' }, io_style: 'serial',
  naming_convention: 'camelCase', indent_size: 2, brace_style: 'K&R',
  namespace_style: 'using', header_style: 'individual',
}

/** ⚠️ 一段**真的** ESP32 程式碼——不是合成的節點。 */
const ESP32_SKETCH = `void setup() {
  Serial.begin(9600);
}

void loop() {
  int v = touchRead(T0);
  Serial.println(v);
  delay(100);
}
`

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function componentsIn(n: SemanticNode | null): Set<string> {
  const out = new Set<string>()
  const walk = (x: SemanticNode): void => {
    out.add(x.componentId)
    for (const kids of Object.values(x.children)) for (const k of kids) walk(k)
  }
  if (n) walk(n)
  return out
}

describe('spec 142 · US2：lift 不受目標影響', () => {
  it('★ 錨點：這段程式碼真的 lift 得出東西', () => {
    // 🔴 沒有這一條的話，`lift` 回 null 時集合是空的，
    //    而下面每一條負向斷言都會**空過**。
    const ids = componentsIn(lifter.lift(tsParser.parse(ESP32_SKETCH).rootNode as never))
    expect(ids.size, 'lift 回了空的 → 下面每一條都空過').toBeGreaterThan(5)
    expect(ids.has('cpp:touch_read'), '正向錨點：touchRead 本來就該被認出來').toBe(true)
  })

  it('🔴 在 Uno 目標下，touchRead 仍被認成專屬概念、不得降級', () => {
    // ⚠️ 「在 Uno 目標下」在今天是一句**廢話**——lift 不看目標。
    //    這一支的價值就在於**它會在有人讓 lift 看目標的那天變紅**。
    const ids = componentsIn(lifter.lift(tsParser.parse(ESP32_SKETCH).rootNode as never))
    expect(ids.has('cpp:touch_read')).toBe(true)
    expect(ids.has('cpp:raw_code'), 'touchRead 降級成 raw_code → 過濾被搬到 lift 了').toBe(false)
    expect(ids.has('cpp:raw_expression')).toBe(false)
  })

  it('🔴 round-trip 一字不差，且 generate 兩次相同', () => {
    const tree = lifter.lift(tsParser.parse(ESP32_SKETCH).rootNode as never)
    const once = generateCode(tree!, 'cpp', STYLE)
    const twice = generateCode(tree!, 'cpp', STYLE)
    expect(twice, 'generate 不是純函式').toBe(once)
    expect(once).toContain('touchRead(T0)')
    // 二次 lift 結構等價
    const again = componentsIn(lifter.lift(tsParser.parse(once).rootNode as never))
    expect(again.has('cpp:touch_read'), '二次 lift 認不得自己產出的程式碼').toBe(true)
  })

  it('🔴 守住未來：能力過濾只作用在【一組概念身分】上，碰不到語義樹', () => {
    // 過濾函式的簽章本身就是保證——它吃 Set<string> 吐 Set<string>，
    // **它連 SemanticNode 這個型別都看不到**。
    const all = new Set(['cpp:touch_read', 'cpp:pin_mode'])
    const kept = filterByTarget(all, unoTarget as Target)
    expect(kept.has('cpp:pin_mode'), '正向：不挑板子的概念留下來').toBe(true)
    expect(kept.has('cpp:touch_read'), '負向：Uno 濾掉需要 touch 的').toBe(false)
    // ⚠️ 而它濾掉的是「身分」，不是節點——語義樹裡那顆仍然在（見上一支）。
    expect(capabilityOf('cpp:touch_read')).toBe('touch')
  })
})
