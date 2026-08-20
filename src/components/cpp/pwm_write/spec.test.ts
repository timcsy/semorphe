/**
 * ESP32 PWM 五顆的自證測（寫在一起，因為**它們共用同一份通道狀態**）。
 *
 * ## 🔴 這一批的核心是：`ledcWrite` 的第一格有【兩種意思】，而程式碼裡看不出來
 *
 * ```
 * 2.x   ledcSetup(0,5000,8);  ledcAttachPin(4,0);  ledcWrite(0,128);   ← 0 是通道
 * 3.x   ledcAttach(4,5000,8);                      ledcWrite(4,128);   ← 4 是腳位
 * ```
 *
 * 🟢 而執行期分得出來——**查程式自己說過的話**。
 * 本檔用**腳位狀態**驗那個判斷有沒有生效，而不是驗輸出字串。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { pinsOf } from '../../../languages/cpp/core/runtime/arduino-pins'
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
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) ids(k, out)
  return out
}
const sketch = (body: string): string =>
  `void setup() {\n${body}}\nvoid loop() {}\n`
const runPins = async (c: string): Promise<Map<number, { value: number }>> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  await i.execute(lift(c))
  return pinsOf(i as never) as Map<number, { value: number }>
}

describe('ESP32 PWM（第 3 批五顆）', () => {
  it('🔴 lift ①：舊版三件套（core 2.x）三顆身分都認得出來', () => {
    const list = ids(lift(sketch('  ledcSetup(0, 5000, 8);\n  ledcAttachPin(4, 0);\n  ledcWrite(0, 128);\n')))
    expect(list).toContain('cpp:pwm_open')       // ← 正向錨點
    expect(list).toContain('cpp:pwm_tie')
    expect(list).toContain('cpp:pwm_write')
    expect(list).not.toContain('cpp:raw_code')
    expect(list).not.toContain('cpp:func_call')  // 🔴 沒有降級成通用呼叫
  })

  it('🔴 lift ②：新版一步到位（core 3.x）', () => {
    const list = ids(lift(sketch('  ledcAttach(4, 5000, 8);\n  ledcWrite(4, 128);\n')))
    expect(list).toContain('cpp:pwm_attach')     // ← 正向錨點
    expect(list).toContain('cpp:pwm_write')
    expect(list).not.toContain('cpp:raw_code')
    expect(list).not.toContain('cpp:func_call')
  })

  it('lift ③：touchRead 是運算式，接得進條件裡', () => {
    const list = ids(lift(sketch('  if (touchRead(4) < 40) { }\n')))
    expect(list).toContain('cpp:touch_read')     // ← 正向錨點
    expect(list).toContain('cpp:if')
    expect(list).not.toContain('cpp:raw_code')
  })

  it('generate —— 兩個世代各自產回原樣', () => {
    const old = generateCode(
      lift(sketch('  ledcSetup(0, 5000, 8);\n  ledcAttachPin(4, 0);\n  ledcWrite(0, 128);\n')),
      'cpp', apcs as StylePreset,
    )
    expect(old).toContain('ledcSetup(0, 5000, 8);')   // ← 正向錨點
    expect(old).toContain('ledcAttachPin(4, 0);')
    expect(old).toContain('ledcWrite(0, 128);')
    const neu = generateCode(lift(sketch('  ledcAttach(4, 5000, 8);\n')), 'cpp', apcs as StylePreset)
    expect(neu).toContain('ledcAttach(4, 5000, 8);')
  })

  it('round-trip —— 兩個世代都不漂移', () => {
    for (const body of [
      '  ledcSetup(0, 5000, 8);\n  ledcAttachPin(4, 0);\n  ledcWrite(0, 128);\n',
      '  ledcAttach(4, 5000, 8);\n  ledcWrite(4, 200);\n',
      '  int t = touchRead(4);\n',
    ]) {
      const one = generateCode(lift(sketch(body)), 'cpp', apcs as StylePreset)
      const twice = generateCode(lift(one), 'cpp', apcs as StylePreset)
      expect(one.length, '產出是空的——下一條會空過').toBeGreaterThan(20)  // ← 正向錨點
      expect(twice, `漂移：${body}`).toBe(one)
    }
  })

  it('🔴 execute ①：舊版——duty 寫到【被繫住的那根腳位】，不是通道號', async () => {
    const pins = await runPins(sketch('  ledcSetup(0, 5000, 8);\n  ledcAttachPin(4, 0);\n  ledcWrite(0, 128);\n'))
    expect(pins.has(4), '腳位 4 應該被寫到').toBe(true)      // ← 正向錨點
    expect(pins.get(4)?.value).toBe(128)
    // 🔴 通道號 0 不是腳位——不得被當成腳位寫
    expect(pins.has(0)).toBe(false)
  })

  it('🔴 execute ②：新版——第一格就是腳位', async () => {
    const pins = await runPins(sketch('  ledcAttach(4, 5000, 8);\n  ledcWrite(4, 200);\n'))
    expect(pins.has(4)).toBe(true)                           // ← 正向錨點
    expect(pins.get(4)?.value).toBe(200)
  })

  it('🔴 execute ③：解析度決定上限——10 位元時 1000 不得被夾成 255', async () => {
    const pins = await runPins(sketch('  ledcAttach(4, 5000, 10);\n  ledcWrite(4, 1000);\n'))
    expect(pins.get(4)?.value, '10 位元的上限是 1023').toBe(1000)
  })

  it('🔴 execute ④：設定了通道卻沒接腳位 → 出聲，不得安靜地寫到通道號', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    let err: string | null = null
    try {
      await i.execute(lift(sketch('  ledcSetup(0, 5000, 8);\n  ledcWrite(0, 128);\n')))
    } catch (e) {
      err = e instanceof Error ? e.message : String(e)
    }
    expect(err, '應該要丟錯而不是安靜地寫').toBeTruthy()
    expect(err).toContain('沒有接到任何腳位')
  })

  it('execute ⑤：touchRead 回固定的未觸碰讀數（⚠️ 取捨不是模擬）', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(lift(sketch('  Serial.println(touchRead(4));\n')))
    expect(i.getOutput().join('')).toContain('75')
  })
})
