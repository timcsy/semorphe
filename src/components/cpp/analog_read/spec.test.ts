/**
 * 類比三顆的自證測：`cpp:analog_read` / `cpp:analog_write` / `cpp:range_remap`。
 *
 * ## 🔴 而 `range_remap` 的身分刻意不叫 `cpp:map`
 *
 * 既有的 `cpp:map_declare`／`map_at`／`map_assign` 是 `std::map`，
 * 而 Arduino 的 `map()` 是**數值區間重映射**——**兩者語義毫無關係，
 * 而它們會出現在同一個工具箱裡**。
 *
 * > **一個與既有概念同名而語義無關的新概念，會讓兩邊的搜尋都變不準。**
 *
 * ⚠️ 而 lift 那一路**仍然認 `map(` 這個語法**——名字是給人看的，不是給 parser 看的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (c: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try {
    await i.execute(lift(c))
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const H = '#include <iostream>\nusing namespace std;\n'

describe('膠囊自證：類比三顆', () => {
  it('★ lift：三個名字都認得，且不落進殘差', () => {
    const ids = collect(lift('void loop(){ int v = analogRead(A0); analogWrite(9, map(v,0,1023,0,255)); }'))
    expect(ids).toContain('cpp:analog_read')     // ← 正向錨點
    expect(ids).toContain('cpp:analog_write')
    expect(ids).toContain('cpp:range_remap')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('★ 而 map( 沒有被誤認成 std::map 那一族', () => {
    const ids = collect(lift('void loop(){ int b = map(1,0,10,0,100); }'))
    expect(ids, '🔴 Arduino 的 map() 被判成關聯容器').not.toContain('cpp:map_declare')
    expect(ids).not.toContain('cpp:map_at')
    expect(ids).toContain('cpp:range_remap')
  })

  it('★ generate：產回原樣（而函式名還是 map）', () => {
    const code = generateCode(
      lift('void loop(){ int v = analogRead(A0); analogWrite(9, map(v, 0, 1023, 0, 255)); }'),
      'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('analogRead(A0)')
    expect(code).toContain('map(v, 0, 1023, 0, 255)')
    expect(code).toContain('analogWrite(9,')
  })

  it('★ round-trip：程式碼 → 樹 → 程式碼，兩次相同', () => {
    const src = 'void loop(){ analogWrite(9, map(analogRead(A0), 0, 1023, 0, 255)); }'
    const once = generateCode(lift(src), 'cpp', apcs as unknown as StylePreset)
    const twice = generateCode(lift(once), 'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
  })

  it('★ execute：寫進類比腳位，讀得回來', async () => {
    const { out, err } = await run(H + 'void setup(){ analogWrite(9, 200); cout << analogRead(9); }')
    expect(err).toBe('')
    expect(out).toBe('200')
  })

  /**
   * 🔴 **整數捨去是 Arduino 的真實行為，不是我們算錯。**
   *
   * `map(511, 0, 1023, 0, 255)` 在真板子上是 **127**，不是 127.5 也不是 128。
   * ⚠️ 這一支釘住它，免得未來有人「順手」改成浮點——**那會讓積木與真板子算出不同的數**。
   */
  it('★ map 用整數運算而會捨去——那是真板子的行為', async () => {
    const { out } = await run(H + 'void setup(){ cout << map(511, 0, 1023, 0, 255); }')
    expect(out, '🔴 改成浮點的話這裡會是 128').toBe('127')
  })

  it('★ map 的來源區間零寬 → 出聲，不得回一個看起來合理的數', async () => {
    const { err } = await run(H + 'void setup(){ cout << map(5, 3, 3, 0, 100); }')
    expect(err).toContain('除以零')
  })

  it('★ analogWrite 夾在 0～255——超出範圍不靜默溢位', async () => {
    const { out } = await run(H + 'void setup(){ analogWrite(9, 999); cout << analogRead(9); }')
    expect(out).toBe('255')
  })
})
