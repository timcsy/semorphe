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
import { generateCode } from '../../../core/projection/code-generator'
import { runCella, boardEnv, boardPin, describeCellaResult, expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
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
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const sketch = (body: string): string =>
  `void setup() {\n${body}}\nvoid loop() {}\n`
/** ESP32 板子上跑一段（Cella 的板子判決；spec 201），accept 才回結果 */
const runEsp32 = async (c: string) => {
  const r = await runCella(c, { board: 'esp32' })
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r
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

  // 🟡 Cella 未支援（0.1.202611020258）：Cella 的 ESP32 模型照 arduino-esp32 3.0.7，而 3.x 移除了 `ledcSetup`／`ledcAttachPin`（模型裡沒有這兩個名字）；
  // 我們這側那兩顆（pwm_open、pwm_tie）也就沒有 formalize——不硬送（送了就是「呼叫未宣告的函式」，學生的 2.x 程式被判成假錯）
  it('🟡 已知缺陷（修好時這條會紅）：🔴 execute ①：舊版——duty 寫到【被繫住的那根腳位】，不是通道號', async () => {
    await knownCellaGap(/cpp:pwm_open[\s\S]*cpp:pwm_tie/, async () => {
      const r = await runEsp32(sketch('  ledcSetup(0, 5000, 8);\n  ledcAttachPin(4, 0);\n  ledcWrite(0, 128);\n'))
      expect(boardPin(r, 4)?.pwm, '腳位 4 應該被寫到').toBe(128)  // ← 正向錨點
      // 🔴 通道號 0 不是腳位——不得被當成腳位寫
      expect(boardPin(r, 0)).toBeUndefined()
    })
  })

  it('🔴 execute ②：新版——第一格就是腳位', async () => {
    const r = await runEsp32(sketch('  ledcAttach(4, 5000, 8);\n  ledcWrite(4, 200);\n'))
    expect(boardPin(r, 4), '腳位 4 應該被寫到').toBeDefined()   // ← 正向錨點
    expect(boardPin(r, 4)?.pwm).toBe(200)
  })

  it('🔴 execute ③：解析度決定上限——10 位元時 1000 不得被夾成 255', async () => {
    const r = await runEsp32(sketch('  ledcAttach(4, 5000, 10);\n  ledcWrite(4, 1000);\n'))
    expect(boardPin(r, 4)?.pwm, '10 位元的上限是 1023').toBe(1000)
  })

  // 🟡 Cella 未支援（0.1.202611020258）：同 ①——「設定了通道卻沒接腳位」只在 2.x 的 API 寫得出來，而模型與我們這側都沒有那兩個呼叫
  it('🟡 已知缺陷（修好時這條會紅）：🔴 execute ④：設定了通道卻沒接腳位 → 出聲，不得安靜地寫到通道號', async () => {
    await knownCellaGap(/cpp:pwm_open/, async () => {
      const r = await runCella(sketch('  ledcSetup(0, 5000, 8);\n  ledcWrite(0, 128);\n'), { board: 'esp32' })
      // 期望：Cella 判 reject，指回那一句 ledcWrite（通道 0 沒有接到任何腳位）——而不是 accept 後安靜地寫到腳位 0
      if (r.verdict !== 'reject') throw new Error(describeCellaResult(r))
      expect(r.problems[0]?.source?.text).toContain('ledcWrite')
      expect(boardEnv(r).pins.find((p) => p.pin === 0)).toBeUndefined()
    })
  })

  it('execute ⑤：touchRead 沒有給觸控輸入時回未觸碰的讀數 75（⚠️ 取捨不是模擬）', async () => {
    // Cella 的 ESP32 模型：`touch:<腳位>` 沒給時讀 75（`@cella-lang/arduino` README），與原本的取捨同一個值
    await expectCellaOut(sketch('  Serial.begin(115200);\n  Serial.println(touchRead(4));\n'), '75\r\n', { board: 'esp32' })
  })
})
