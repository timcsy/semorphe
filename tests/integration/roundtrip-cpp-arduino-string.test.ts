/**
 * **435：Arduino `String` 方法與序列埠讀取——四個面向 ＋ 執行**（`cpp:arduino_string_{trim,find,substr,as_int}`、`cpp:serial_read_string`、`cpp:serial_read_number`）。
 *
 * 來源：433 的序列埠指令解析 sketch（探針 `arduino-builtins` 的 real_11／14／15 蒸餾出來的形狀）。
 * 這一刀之前它們全是通用的「方法呼叫」積木（灰色、文字欄位），學生看不出那是「拆字串」。
 *
 * 🔴 判別看接收者的型別，不是方法名——★ 那兩條是正向錨點：自己的類別、std::string 的同名方法不得被搶走。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { expectCellaOut } from '../helpers/cella-run'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/panels/blocks/dynamic-dropdown-field'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset

let parser: Parser
let blockExtractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()

  registerFieldMultilineInput()
  registerDynamicDropdownField()
  // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是「每一支都紅」，
  //    而那是護欄壞了，不是產品壞了。
  for (const k of ['names', 'vars', 'funcs', 'arrays',
    'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [])
  }
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/panels/blocks/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')
  blockExtractor = new PatternExtractor()
  blockExtractor.loadBlockSpecs(reg.getAll())
  registerCppExtractStrategies(blockExtractor)
}, 180_000)


/** 433 的序列埠指令解析 sketch（`arduino-sketch-formalize.test.ts` 的 PARSER，原封）——五顆新元件同時出現。 */
const PARSER = `void setup() {
  Serial.begin(9600);
  String line = Serial.readStringUntil('\\n');
  line.trim();
  int comma = line.indexOf(',');
  String cmd = line.substring(0, comma);
  int value = line.substring(comma + 1).toInt();
  Serial.print(cmd);
  Serial.print(" -> ");
  Serial.println(value * 2);
}
void loop() {
}
`
const sk = (body: string) => `void setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {\n}\n`

/** [名字, 程式, 一定要出現的身分, 一定不能出現的身分] */
const CASES: readonly [string, string, string[], string[]][] = [
  ['433 指令解析（全套）', PARSER, ['cpp:serial_read_string', 'cpp:arduino_string_trim', 'cpp:arduino_string_find', 'cpp:arduino_string_substr', 'cpp:arduino_string_as_int'], ['cpp:method_call']],
  ['indexOf 兩個引數', sk('  String s = "a,b,c";\n  int i = s.indexOf(\',\', 2);\n  Serial.println(i);'), ['cpp:arduino_string_find'], ['cpp:method_call']],
  ['substring 一個引數接 toInt', sk('  String s = "x=42";\n  Serial.println(s.substring(2).toInt() + 1);'), ['cpp:arduino_string_substr', 'cpp:arduino_string_as_int'], ['cpp:method_call']],
  ['讀一個整數', sk('  int n = Serial.parseInt();\n  Serial.println(n * 2);'), ['cpp:serial_read_number'], ['cpp:method_call']],
  ['readStringUntil 直接接 toInt', sk("  int n = Serial.readStringUntil(',').toInt();\n  Serial.println(n);"), ['cpp:serial_read_string', 'cpp:arduino_string_as_int'], ['cpp:method_call']],
  ['在 if 條件與迴圈裡', sk('  String s = "abc";\n  if (s.indexOf(\'b\') >= 0) {\n    Serial.println(s.substring(1));\n  }\n  while (Serial.parseInt() > 0) {\n  }'), ['cpp:arduino_string_find', 'cpp:arduino_string_substr', 'cpp:serial_read_number'], []],
  ['★ 自己的類別同名方法不搶', 'struct Box {\n  int indexOf(int x) {\n    return x;\n  }\n  void trim() {\n  }\n};\nvoid setup() {\n  Box b;\n  b.trim();\n  int i = b.indexOf(3);\n}\nvoid loop() {\n}\n', ['cpp:method_call'], ['cpp:arduino_string_trim', 'cpp:arduino_string_find']],
  ['★ std::string 的 substr／find 照舊', '#include <string>\nusing namespace std;\nvoid setup() {\n  string s = "hello";\n  int i = s.find("l");\n  string t = s.substr(1, 2);\n}\nvoid loop() {\n}\n', [], ['cpp:arduino_string_find', 'cpp:arduino_string_substr']],
]

const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const squash = (x: string): string => x.replace(/\s+/g, '')
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
function viaBlocks(tree: SemanticNode): string {
  const chainOf = (b0: unknown): SemanticNode[] => {
    const acc: SemanticNode[] = []
    let cur = b0 as { next?: { block: unknown } } | undefined
    while (cur) {
      const n = blockExtractor.extract(cur as never)
      if (n) acc.push(n)
      cur = (cur.next?.block ?? undefined) as typeof cur
    }
    return acc
  }
  const { blockMappings: _drop, ...state } = renderToBlocklyState(tree)
  const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
  return generateCode({ componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode, 'cpp', S)
}

describe('435 Arduino String 方法與序列埠讀取：四個面向 ＋ 執行', () => {
  it('★ 入口條件', () => {
    expect(ids(lift(PARSER))).toContain('cpp:serial_read_string')
  })

  describe('身分：該是的是、不該搶的不搶', () => {
    it.each(CASES)('%s', (_n, code, must, mustNot) => {
      const got = ids(lift(code))
      for (const m of must) expect(got, `少了 ${m}`).toContain(m)
      for (const m of mustNot) expect(got, `不該有 ${m}`).not.toContain(m)
    })
  })

  describe('① ② 產碼一字不差、再 lift 是不動點', () => {
    it.each(CASES)('%s', (_n, code) => {
      const once = generateCode(lift(code), 'cpp', S)
      expect(squash(once), '🔴 產出的程式碼變了').toBe(squash(code))
      expect(generateCode(lift(once), 'cpp', S)).toBe(once)
    })
  })

  describe('③ 載得進工作區', () => {
    it.each(CASES)('%s', (_n, code) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(code))
      const ws = new Blockly.Workspace()
      let err: string | null = null
      try { Blockly.serialization.workspaces.load(state, ws) } catch (e) { err = e instanceof Error ? e.message : String(e) } finally { ws.dispose() }
      expect(err).toBeNull()
    })
  })

  describe('④ 走一趟積木回來一字不差', () => {
    it.each(CASES)('%s', (_n, code) => {
      expect(viaBlocks(lift(code)), '🔴 學生一動積木，程式就變了').toBe(generateCode(lift(code), 'cpp', S))
    })
  })

  describe('⑤ 走一趟積木回來，交給 Cella 跑出來的一樣', () => {
    for (const board of ['uno', 'esp32']) {
      it(`433 指令解析（${board}）`, async () => {
        await expectCellaOut(viaBlocks(lift(PARSER)), 'led -> 42\r\n', { board, stdin: 'led,21\n' })
      })
    }
    it('readStringUntil 直接接 toInt（esp32）', async () => {
      await expectCellaOut(viaBlocks(lift(CASES[4][1])), '17\r\n', { board: 'esp32', stdin: '17,3\n' })
    })
  })
})
