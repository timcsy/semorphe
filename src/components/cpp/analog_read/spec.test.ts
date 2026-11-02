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
import { runCella, boardPin, describeCellaResult, expectCellaOut } from '../../../../tests/helpers/cella-run'
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
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
/**
 * spec 201：執行判準換成 Cella 的 Uno 板子判決。原本的程式用 `cout`——AVR 沒有 `<iostream>`，
 * 改成 sketch 真正會寫的 `Serial.print`（程式的意思不變）。
 */
const S = (setup: string): string => `void setup(){ Serial.begin(9600); ${setup} }\nvoid loop(){}\n`
const uno = async (c: string, inputs?: { t: number; key: string; value: number }[]) => {
  const r = await runCella(c, { board: 'uno', inputs })
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r
}

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

  // 改寫了（原本是「analogWrite(9, 200) 之後 analogRead(9) 讀回 200」）。依據：真的 Uno 上兩者不是同一個東西——
  // analogWrite 是計時器的 PWM，analogRead 讀 ADC；AVR 核心的 `analogRead(9)` 讀的是 ADC 通道 9 & 7 = 1（A1），不是腳位 9 的 PWM。
  // 所以兩件事分開驗：寫——腳位 9 的 PWM 是 200；讀——讀得到環境給 A0 的值
  it('★ execute：寫進類比腳位、讀得到類比輸入', async () => {
    const r = await uno(S('analogWrite(9, 200); Serial.print(analogRead(A0));'), [{ t: 0, key: 'analog:A0', value: 512 }])
    expect(boardPin(r, 9)?.pwm).toBe(200)
    expect(r.out).toBe('512')
  })

  /**
   * 🔴 **整數捨去是 Arduino 的真實行為，不是我們算錯。**
   *
   * `map(511, 0, 1023, 0, 255)` 在真板子上是 **127**，不是 127.5 也不是 128。
   * ⚠️ 這一支釘住它，免得未來有人「順手」改成浮點——**那會讓積木與真板子算出不同的數**。
   */
  it('★ map 用整數運算而會捨去——那是真板子的行為', async () => {
    await expectCellaOut(S('Serial.print(map(511, 0, 1023, 0, 255));'), '127', { board: 'uno' })
  })

  it('★ map 的來源區間零寬 → 出聲，不得回一個看起來合理的數', async () => {
    // `map` 是 (x - in_min) * (out_max - out_min) / (in_max - in_min)：分母 0 是整數除以零（未定義行為）
    const r = await runCella(S('Serial.print(map(5, 3, 3, 0, 100));'), { board: 'uno' })
    expect(r.verdict).toBe('reject')
    expect(r.problems[0]?.kind).toBe('ubDivZero')
    expect(r.problems[0]?.source?.text).toContain('map(5, 3, 3')
  })

  it('★ analogWrite 夾在 0～255——超出範圍不靜默溢位', async () => {
    // 依據（期望值不變、理由更正）：AVR 核心不夾——腳位 9 是 Timer1A，`OCR1A = 999`，而 8 位元相位正確 PWM 的 TOP 是 255，
    // 比較值永遠超過 TOP ⟹ 整個週期都是高電位，效果等於 255；Cella 的板子記成 255
    const r = await uno(S('analogWrite(9, 999);'))
    expect(boardPin(r, 9)?.pwm).toBe(255)
  })
})
