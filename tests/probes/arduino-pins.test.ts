/**
 * **探針：板子程式的判決帶出的腳位與硬體狀態**（spec 184 的資料來源）——閃燈程式的 `pins`、`pinsTruncated`、`env` 長什麼樣。
 * 只在 `ARDUINO_PINS_PROBE=1` 時跑（要編判決模組，十幾秒）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { formalize, cellaBoardOf } from '../../src/providers/cella/formalize'
import { createCellaChecker, type CellaChecker } from '../../src/providers/cella/verdict'
import type { SemanticNode } from '../../src/core/types'

const RUN = process.env.ARDUINO_PINS_PROBE === '1'
let checker: CellaChecker
let lift: (c: string) => SemanticNode
beforeAll(async () => {
  if (!RUN) return
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  const parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lift = (c) => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
  checker = await createCellaChecker((pkg, file) => fs.readFileSync(path.join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file)))
}, 300_000)

describe.skipIf(!RUN)('板子程式的腳位', () => {
  it('★ 量：閃燈的 pins／env', () => {
    const f = formalize(lift('void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.begin(9600);\n}\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}\n'), { board: cellaBoardOf('arduino-uno') })
    expect(f.program, JSON.stringify(f.unknown)).toBeTruthy()
    const v = checker.verdict(f.program, '', 50_000_000) as unknown as Record<string, unknown>
    console.log('verdict', v.verdict, 'problems', JSON.stringify(v.problems))
    console.log('pins（前 8 筆）', JSON.stringify((v.pins as unknown[])?.slice(0, 8)), '共', (v.pins as unknown[])?.length, 'truncated', v.pinsTruncated)
    console.log('env', JSON.stringify(v.env).slice(0, 800))
  })
})
