/**
 * 時間兩顆的自證測：`cpp:delay` / `cpp:millis`。
 *
 * ⚠️ **兩顆寫在一起，因為它們共用同一個時鐘**——分開測的話
 * 「`delay` 推進了時間而 `millis` 讀得到」**沒有任何一支測得到**。
 *
 * ## 🔴 而這裡有兩條執行路徑，兩條都要被測
 *
 * 使用者 2026-08-17 拍板「模擬為主、可切真實」，**而他是在看過這個代價之後選的**：
 *
 * > **兩條路 ＝ 兩份行為，而只有一條會被測到。**
 *
 * 所以本檔**兩條都測**——而那正是那個代價被「看得見」的方式。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { resetClock, useRealTime, markRealStart } from '../../../languages/cpp/core/runtime/arduino-clock'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

// ⚠️ 每支之後都要關掉真實時間，否則**下一支會在另一條路上跑**——
// 而那個症狀是「時好時壞」，不是「紅」。
afterEach(() => { useRealTime(false); resetClock() })

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<string> => {
  resetClock()
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return i.getOutput().join('')
}

const H = '#include <iostream>\nusing namespace std;\n'

describe('膠囊自證：時間兩顆', () => {
  it('★ lift：兩個名字都認得，且不落進殘差', () => {
    const ids = collect(lift('void loop(){ delay(100); unsigned long t = millis(); }'))
    expect(ids).toContain('cpp:delay')       // ← 正向錨點
    expect(ids).toContain('cpp:millis')
    expect(ids).not.toContain('cpp:raw_code')
    expect(ids, '🔴 還在走 func_call → 登錄沒生效').not.toContain('cpp:func_call')
  })

  it('★ generate：產回原樣', () => {
    const code = generateCode(lift('void loop(){ delay(500); }'), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('delay(500);')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，兩次相同', () => {
    const src = 'void loop(){ delay(1000); }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(once).toContain('delay(1000)')
  })

  /** 🔴 這一支是兩顆共用時鐘的理由——分開做的話它測不出來。 */
  it('★ execute（模擬）：delay 推進了時間，而 millis 讀得到', async () => {
    const out = await run(H + 'void setup(){ cout << millis() << ","; delay(1000); cout << millis(); }')
    expect(out, '🔴 delay 沒有推進模擬時鐘，或 millis 讀的是另一份時間').toBe('0,1000')
  })

  it('★ execute（模擬）：三次 delay(1000) 幾乎不花時間，而時鐘走了 3000', async () => {
    const t0 = Date.now()
    const out = await run(H + 'void setup(){ delay(1000); delay(1000); delay(1000); cout << millis(); }')
    const wall = Date.now() - t0
    expect(out, '模擬時鐘要累加').toBe('3000')
    expect(wall, `🔴 模擬模式卻真的等了 ${wall}ms——那是真實時間那條路`).toBeLessThan(500)
  })

  /**
   * 🔴 **第二條路。**
   *
   * ⚠️ 它**故意用很小的數字**（50ms）：真實時間那條路要被測到，
   * 而測試不能因此變慢——**一支慢到會被人略過的測試，等於沒有**。
   */
  it('★ execute（真實時間）：delay 真的等了，而 millis 走的是牆上時鐘', async () => {
    useRealTime(true)
    markRealStart()
    const t0 = Date.now()
    await run(H + 'void setup(){ delay(50); }')
    const wall = Date.now() - t0
    expect(wall, `🔴 真實時間模式卻沒有真的等（只花了 ${wall}ms）——那條路沒接上`).toBeGreaterThanOrEqual(40)
  })
})
