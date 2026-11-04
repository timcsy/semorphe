/**
 * **契約 `@cos-mos/arduino` 的範例材料**（history/015 六步之 ⑤；預設跳過，`CONTRACT_EXAMPLES_OUT=<檔>` 才寫）。
 *
 * cos-mos 2026-11-05 要的：每一支程式兩份，**由同一份工作區產生**——
 * (a) 結構頻道的動作清單訊息（`createStructureChannel` 推出去的原樣）；
 * (b) formalize 之後交給 Cella 的程式 JSON（板子 uno）。
 * 兩份都從**同一棵語意樹**來（積木工作區也是畫這一棵）。預期判決由 cos-mos 用 Cella 跑出來寫進契約的 examples/，這裡不填。
 * 第 3 層檢查：(a) 在契約下全部通過宿主核對；(b) Cella 的判決等於預期——所以要有一支「應該被拒」的。
 *
 * ```bash
 * CONTRACT_EXAMPLES_OUT=$PWD/build/cos-mos/arduino-examples.json npx vitest run tests/probes/export-contract-examples.test.ts
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticBus } from '../../src/core/sync/semantic-bus'
import { generateExpressionCode } from '../../src/core/projection/code-generator'
import { createStructureChannel } from '../../src/languages/cpp/vocab/structure-channel'
import { formalize } from '../../src/providers/cella/formalize'
import type { StructureMessage } from '../../src/languages/cpp/vocab/arduino'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import google from '../../src/languages/cpp/styles/google.json'

const OUT = process.env.CONTRACT_EXAMPLES_OUT ?? ''
const BOARD = 'uno'

/** 與結構頻道樣本（afc79823）同三支，加一支應該被拒的 */
const EXAMPLES: { name: string; what: string; code: string }[] = [
  { name: 'blink', what: '閃燈：pinMode、digitalWrite（字面值與變數）、delay',
    code: 'int state = HIGH;\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(13, state);\n  delay(500);\n  state = !state;\n}\n' },
  { name: 'serial', what: 'Serial：begin、println（類比讀值）、print（字串、帶格式）',
    code: 'void setup() {\n  Serial.begin(9600);\n}\nvoid loop() {\n  Serial.println(analogRead(A0));\n  Serial.print("v=");\n  Serial.print(42, HEX);\n  delay(1000);\n}\n' },
  { name: 'dht', what: 'DHT：可變長度的建構參數、begin、讀溫度',
    code: '#include <DHT.h>\nDHT dht(2, DHT11);\nvoid setup() {\n  dht.begin();\n  Serial.begin(9600);\n}\nvoid loop() {\n  Serial.println(dht.readTemperature());\n  delay(2000);\n}\n' },
  { name: 'uninit-read', what: '應該被拒：讀取沒有初始化的變數（未定義行為）',
    code: 'void setup() {\n  pinMode(13, OUTPUT);\n}\nvoid loop() {\n  int level;\n  digitalWrite(13, level);\n  delay(500);\n}\n' },
]

describe.skipIf(!OUT)('契約的範例材料', () => {
  let parser: Parser
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
  })

  it('每一支：同一棵樹推出動作清單與程式 JSON', async () => {
    const out = []
    for (const ex of EXAMPLES) {
      const tree = createTestLifter().lift(parser.parse(ex.code)!.rootNode as never) as SemanticNode
      const bus = new SemanticBus()
      const ch = await createStructureChannel(bus, { codeOf: (n) => generateExpressionCode(n, 'cpp', google as unknown as StylePreset) })
      let structure: StructureMessage | null = null
      ch.onStructure((m) => { structure = m })
      bus.emit('semantic:update', { tree })
      const f = formalize(tree, { board: BOARD })
      expect(structure, `${ex.name}：結構頻道沒有推出訊息`).not.toBeNull()
      expect(f.program, `${ex.name}：翻不出——${JSON.stringify(f.unknown)}`).toBeTruthy()
      expect((structure as unknown as StructureMessage).unmapped, `${ex.name}：有對不上契約的元件`).toEqual([])
      out.push({ name: ex.name, what: ex.what, source: ex.code, structure, program: f.program })
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
    console.log(out.map((e) => `${e.name}：${(e.structure as unknown as StructureMessage).actions.map((a) => a.op.replace('arduino:', '')).join('、')}`).join('\n'))
  })
})
