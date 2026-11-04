/**
 * **錄結構頻道的對照樣本**（預設跳過；`STRUCTURE_SAMPLES_OUT=<檔>` 才寫）——cos-mos 2026-11-04 要的：
 * 推送端（`createStructureChannel`）與接收端（cos-mos 的 `createStructureReceiver`）之間的對照樣本。
 * 每一筆是 `onStructure` 收到的原樣；程式走真的 lift（不是手搭的樹），連續幾版、版本號遞增。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticBus } from '../../src/core/sync/semantic-bus'
import { generateExpressionCode } from '../../src/core/projection/code-generator'
import { createStructureChannel } from '../../src/languages/cpp/vocab/structure-channel'
import type { StructureMessage } from '../../src/languages/cpp/vocab/arduino'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import google from '../../src/languages/cpp/styles/google.json'

const OUT = process.env.STRUCTURE_SAMPLES_OUT ?? ''

const PROGRAMS = [
  // ① 閃燈：pin_mode、digital_write（一個字面值、一個變數 ⟹ { expr }）、delay
  'int state = HIGH;\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, state);\n  delay(500);\n  state = !state;\n}\n',
  // ② 改成 serial_print：Serial.begin、Serial.println（obj、newline 由屬性給）、Serial.print（不換行）、帶格式的那一個
  'void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  Serial.println(analogRead(A0));\n  Serial.print("v=");\n  Serial.print(42, HEX);\n  delay(1000);\n}\n',
  // ③ DHT 宣告（可變長度的建構參數）＋ 讀值
  '#include <DHT.h>\nDHT dht(2, DHT11);\nvoid setup() {\n  dht.begin();\n  Serial.begin(9600);\n}\nvoid loop() {\n  Serial.println(dht.readTemperature());\n  delay(2000);\n}\n',
  // ④ 認不出來的一段（組語）⟹ unmapped
  'void setup() {\n  pinMode(13, OUTPUT);\n  asm volatile("nop");\n}\nvoid loop() {\n  digitalWrite(13, HIGH);\n}\n',
]

describe.skipIf(!OUT)('錄結構頻道的對照樣本', () => {
  let parser: Parser
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
  })

  it('四支程式、四版、原樣寫出', async () => {
    const bus = new SemanticBus()
    const ch = await createStructureChannel(bus, { codeOf: (n) => generateExpressionCode(n, 'cpp', google as unknown as StylePreset) })
    const got: StructureMessage[] = []
    ch.onStructure((m) => got.push(m))
    for (const code of PROGRAMS) bus.emit('semantic:update', { tree: createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode })
    expect(got.map((m) => m.at)).toEqual([1, 2, 3, 4])
    expect(got[3].unmapped.length, '④ 要有一筆認不出來的').toBeGreaterThan(0)
    fs.writeFileSync(OUT, JSON.stringify(got, null, 2) + '\n')
    console.log(got.map((m) => `at ${m.at}：${m.actions.map((a) => a.op.replace('arduino:', '')).join('、')}${m.unmapped.length ? `｜unmapped ${m.unmapped.map((u) => u.componentId).join('、')}` : ''}`).join('\n'))
  })
})
