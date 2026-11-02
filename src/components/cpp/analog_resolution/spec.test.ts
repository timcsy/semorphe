/**
 * `cpp:analog_resolution` 的自證測。
 *
 * 🔴 **這一顆今天沒有可觀察的效果**，所以執行那一路測的是
 * 「它不中止程式」與「參數不合理時照真板子的行為」——
 * 而不是假裝去驗一個不存在的副作用。
 *
 * ⚠️ spec 201：執行那兩條改由 Cella 的板子判決背書，而 Cella 的 ESP32 模型還沒有 analogReadResolution——兩條都用 knownCellaGap 釘著。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
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
describe('cpp:analog_resolution', () => {
  it('lift —— 認得出身分（而它不叫 analog_read_resolution）', () => {
    const ids = collect(lift('void setup() { analogReadResolution(12); }\nvoid loop() {}\n'))
    expect(ids).toContain('cpp:analog_resolution')   // ← 正向錨點
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('generate —— 產回原本的呼叫', () => {
    const code = generateCode(lift('void setup() { analogReadResolution(12); }\nvoid loop() {}\n'), 'cpp', apcs as StylePreset)
    expect(code).toContain('analogReadResolution(12)')
  })

  it('round-trip —— 不漂移', () => {
    const src = 'void setup() {\n  analogReadResolution(12);\n}\nvoid loop() {\n}\n'
    const once = generateCode(lift(src), 'cpp', apcs as StylePreset)
    expect(generateCode(lift(once), 'cpp', apcs as StylePreset)).toBe(once)
  })

  // 🟡 spec 201：Cella 未支援——`@cella-lang/arduino`（0.1.202611020258）的 ESP32 核心沒有 analogReadResolution（只有 analogRead／analogWriteResolution），
  //    所以我們這側刻意不補 formalize（硬送會讓學生的程式被判成假錯）；Cella 補上模型、我們接上 formalize 之後這條會紅：拿掉 knownCellaGap 那層
  it('🟡 已知缺陷（修好時這條會紅）：🔴 執行 —— 不中止程式（後面的東西照跑）', () => knownCellaGap(/cpp:analog_resolution：這顆敘述元件還沒有對應/, async () => {
    // 原本是 int main() ＋ cout（JS 直譯器才收）；它是 ESP32／SAMD 才有的函式，改成 ESP32 上的 sketch ＋ Serial
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        analogReadResolution(12);
        Serial.println("still running");
      }
      void loop() {}
    `, 'still running\r\n', { board: 'esp32' })
  }))

  // 🟡 同上（Cella 未支援 analogReadResolution）。
  // 🔴 而這一條的期望改了方向：原本斷言 JS 直譯器丟「解析度」錯誤（出聲）；真實 arduino-esp32 的
  //    __analogReadResolution 遇到 bits 為 0 或 > 16 是直接 return（不改設定、不報錯），讀值照舊是預設的 12 bit。
  //    判準是真板子的行為，所以修好之後要成立的是：accept，而 analogRead 讀回原值（設定被忽略）。
  it('🟡 已知缺陷（修好時這條會紅）：⚠️ 參數不合理（99）—— 真板子忽略它，讀值照舊是預設的 12 bit', () => knownCellaGap(/cpp:analog_resolution：這顆敘述元件還沒有對應/, async () => {
    await expectCellaOut(`
      void setup() {
        Serial.begin(9600);
        analogReadResolution(99);
        Serial.println(analogRead(A0));
      }
      void loop() {}
    `, '4095\r\n', { board: 'esp32', inputs: [{ t: 0, key: 'analog:A0', value: 4095 }] })
  }))
})
