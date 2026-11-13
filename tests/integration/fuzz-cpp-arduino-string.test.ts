/**
 * **435 盲測：Arduino `String` 方法與序列埠讀取**（component-fuzz，2026-11-13）。
 *
 * 出題者是隔離的子代理（不知道 Semorphe），寫了 8 支 sketch，各自附一段序列埠輸入。
 * 判準不是出題者手算的預期輸出，是 **Cella 跑原始程式** 與 **Cella 跑走一趟積木回來的程式** 印的東西相同（uno 與 esp32 各一次）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { runCella, describeCellaResult } from '../helpers/cella-run'
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


const PROGRAMS: { id: string; code: string; stdin: string }[] = [
  {
    "id": "fuzz_1",
    "code": "void setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    String line = Serial.readStringUntil('\\n');\n    line.trim();\n    int c = line.indexOf(':');\n    if (c < 0) {\n      Serial.println(\"no colon\");\n    } else {\n      String key = line.substring(0, c);\n      String val = line.substring(c + 1);\n      key.trim();\n      val.trim();\n      Serial.print(\"key=[\");\n      Serial.print(key);\n      Serial.print(\"] val=[\");\n      Serial.print(val);\n      Serial.println(\"]\");\n      Serial.println(val.length() + key.length());\n      Serial.println(line.indexOf('l', c));\n      Serial.println(line.indexOf(\"zz\"));\n    }\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "  name: Alice  \n"
  },
  {
    "id": "fuzz_2",
    "code": "int sumCsv(String s) {\n  int total = 0;\n  int start = 0;\n  while (true) {\n    int comma = s.indexOf(',', start);\n    String tok;\n    if (comma < 0) {\n      tok = s.substring(start);\n    } else {\n      tok = s.substring(start, comma);\n    }\n    tok.trim();\n    total += tok.toInt();\n    Serial.print(tok.toInt());\n    Serial.print(' ');\n    if (comma < 0) break;\n    start = comma + 1;\n  }\n  Serial.println();\n  return total;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    String line = Serial.readStringUntil('\\n');\n    int t = sumCsv(line);\n    Serial.print(\"total=\");\n    Serial.println(t);\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "10,20,abc,-5,7\n"
  },
  {
    "id": "fuzz_3",
    "code": "void setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    int n = Serial.parseInt();\n    Serial.print(\"n=\");\n    Serial.println(n);\n    int sum = 0;\n    int mx = -32768;\n    int mn = 32767;\n    int neg = 0;\n    for (int i = 0; i < n; i++) {\n      int v = Serial.parseInt();\n      Serial.print(\"v\");\n      Serial.print(i);\n      Serial.print('=');\n      Serial.println(v);\n      sum += v;\n      if (v > mx) mx = v;\n      if (v < mn) mn = v;\n      if (v < 0) neg++;\n    }\n    Serial.print(\"sum=\");\n    Serial.print(sum);\n    Serial.print(\" max=\");\n    Serial.print(mx);\n    Serial.print(\" min=\");\n    Serial.print(mn);\n    Serial.print(\" neg=\");\n    Serial.println(neg);\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "3\n-4 15 -200\n"
  },
  {
    "id": "fuzz_4",
    "code": "void setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    int count = Serial.parseInt();\n    for (int i = 0; i < count; i++) {\n      String item = Serial.readStringUntil(',');\n      item.trim();\n      if (item.length() == 0) continue;\n      int eq = item.indexOf('=');\n      if (eq < 0) {\n        Serial.print(item);\n        Serial.println(\": no value\");\n      } else {\n        String key = item.substring(0, eq);\n        String val = item.substring(eq + 1);\n        val.trim();\n        if (val.toInt() > 0) {\n          Serial.print(key);\n          Serial.print(\" numeric \");\n          Serial.println(val.toInt() * 2);\n        } else {\n          Serial.print(key);\n          Serial.print(\" text \");\n          Serial.println(val);\n        }\n      }\n    }\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "4 temp=25, hum=60 ,mode=auto,bad,\n"
  },
  {
    "id": "fuzz_5",
    "code": "String nextToken(String &s) {\n  s.trim();\n  int sp = s.indexOf(' ');\n  String t;\n  if (sp < 0) {\n    t = s;\n    s = \"\";\n  } else {\n    t = s.substring(0, sp);\n    s = s.substring(sp + 1);\n  }\n  return t;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    String line = Serial.readStringUntil('\\n');\n    line.trim();\n    String work = line;\n    String verb = nextToken(work);\n    String dev = nextToken(work);\n    String pinTxt = nextToken(work);\n    String state = nextToken(work);\n    int pin = pinTxt.toInt();\n    Serial.print(\"verb=\");\n    Serial.print(verb);\n    Serial.print(\" dev=\");\n    Serial.print(dev);\n    Serial.print(\" pin=\");\n    Serial.print(pin);\n    Serial.print(\" state=\");\n    Serial.println(state);\n    pinMode(pin, OUTPUT);\n    digitalWrite(pin, state == \"ON\" ? HIGH : LOW);\n    Serial.println(pin + 1);\n    Serial.println(line.indexOf(\"ON\"));\n    Serial.println(line.length());\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "  SET LED 13 ON  \n"
  },
  {
    "id": "fuzz_6",
    "code": "void setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    String line = Serial.readStringUntil('\\n');\n    int pos = 0;\n    int sum = 0;\n    while (pos < (int)line.length()) {\n      int open = line.indexOf('[', pos);\n      if (open < 0) break;\n      String name = line.substring(pos, open);\n      name.trim();\n      int close = line.indexOf(']', open + 1);\n      if (close < 0) {\n        Serial.print(name);\n        Serial.print(\": unclosed \");\n        Serial.println(line.substring(open + 1));\n        break;\n      }\n      String inner = line.substring(open + 1, close);\n      inner.trim();\n      if (inner.length() == 0) {\n        Serial.print(name);\n        Serial.println(\"=empty\");\n      } else if (inner.toInt() == 0 && inner != \"0\") {\n        Serial.print(name);\n        Serial.println(\"=0 (not numeric)\");\n      } else {\n        Serial.print(name);\n        Serial.print('=');\n        Serial.println(inner.toInt());\n        sum += inner.toInt();\n      }\n      pos = close + 1;\n    }\n    Serial.print(\"sum=\");\n    Serial.println(sum);\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "a[12] b[ -7 ] c[] d[x9] e[4\n"
  },
  {
    "id": "fuzz_7",
    "code": "long toSeconds(String t, bool &ok) {\n  t.trim();\n  int c1 = t.indexOf(':');\n  if (c1 < 0) {\n    ok = false;\n    return 0;\n  }\n  int c2 = t.indexOf(':', c1 + 1);\n  long h = t.substring(0, c1).toInt();\n  long m = 0;\n  long s = 0;\n  if (c2 < 0) {\n    m = t.substring(c1 + 1).toInt();\n  } else {\n    m = t.substring(c1 + 1, c2).toInt();\n    s = t.substring(c2 + 1).toInt();\n  }\n  ok = true;\n  return h * 3600L + m * 60L + s;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  int n = 0;\n  long total = 0;\n  while (Serial.available() > 0) {\n    String line = Serial.readStringUntil('\\n');\n    n++;\n    bool ok = false;\n    long secs = toSeconds(line, ok);\n    Serial.print(n);\n    Serial.print(\": \");\n    if (ok) {\n      Serial.println(secs);\n      total += secs;\n    } else {\n      Serial.println(\"invalid\");\n    }\n  }\n  Serial.print(\"total=\");\n  Serial.println(total);\n}\n\nvoid loop() {\n}\n",
    "stdin": "01:02:03\n 12:30\nbad\n23:59:59\n"
  },
  {
    "id": "fuzz_8",
    "code": "int countPattern(String text, String pat, bool overlap) {\n  int n = 0;\n  int pos = text.indexOf(pat);\n  while (pos >= 0) {\n    n++;\n    pos = text.indexOf(pat, overlap ? pos + 1 : pos + pat.length());\n  }\n  return n;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  if (Serial.available() > 0) {\n    String text = Serial.readStringUntil('\\n');\n    text.trim();\n    String pat = \"aba\";\n    Serial.print(\"at\");\n    int p = text.indexOf(pat);\n    while (p >= 0) {\n      Serial.print(' ');\n      Serial.print(p);\n      p = text.indexOf(pat, p + 1);\n    }\n    Serial.println();\n    Serial.print(\"overlap=\");\n    Serial.println(countPattern(text, pat, true));\n    Serial.print(\"plain=\");\n    Serial.println(countPattern(text, pat, false));\n    int words = 1;\n    int pos = 0;\n    int sp;\n    while ((sp = text.indexOf(' ', pos)) >= 0) {\n      words++;\n      pos = sp + 1;\n    }\n    Serial.print(\"words=\");\n    Serial.println(words);\n    String first = text.substring(0, text.indexOf(' '));\n    Serial.print(\"first=\");\n    Serial.print(first);\n    Serial.print('(');\n    Serial.print(first.length());\n    Serial.println(')');\n  }\n}\n\nvoid loop() {\n}\n",
    "stdin": "ababa aba\n"
  }
]

const NEW_IDS = ['cpp:arduino_string_trim', 'cpp:arduino_string_find', 'cpp:arduino_string_substr', 'cpp:arduino_string_as_int', 'cpp:serial_read_string', 'cpp:serial_read_number']

describe('435 盲測：Arduino String 與序列埠讀取', () => {
  it('★ 入口條件：八支都在、每支都用到至少一顆新元件', () => {
    expect(PROGRAMS).toHaveLength(8)
    for (const p of PROGRAMS) expect(ids(lift(p.code)).some((i) => NEW_IDS.includes(i)), p.id).toBe(true)
  })

  describe.each(PROGRAMS)('$id', (p) => {
    it('沒有降級', () => {
      const got = ids(lift(p.code))
      expect(got.filter((i) => /raw_code|raw_expression|unresolved/.test(i))).toEqual([])
    })
    // ⚠️ 不比原文：學生寫的不帶大括號的 `if (c < 0) break;`，產出會補上大括號（排版風格的正規化，4 支，
    //    fuzz_2／3／4／6）——文字不同 ≠ 錯，行為不同才是（行為由 ⑤ 比）。這裡量的是「再 lift 是不動點」。
    it('② 產碼再 lift 是不動點', () => {
      const once = generateCode(lift(p.code), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S)).toBe(once)
    })
    it('④ 走一趟積木回來一字不差', () => {
      expect(viaBlocks(lift(p.code))).toBe(generateCode(lift(p.code), 'cpp', S))
    })
    // 🔴 Uno 上 `trim()` 遇到開頭的空白會判 reject（AVR 核心的 String::trim 用 memcpy 搬重疊的區段，是未定義行為；
    //    cella 2026-11-13 確認這是忠實的判決）。所以 Uno 只要求「原始與走一趟積木回來的判決與輸出相同」，
    //    而且 reject 的原因只能是那一條；ESP32 的核心用 memmove，必須 accept。
    for (const board of ['uno', 'esp32']) {
      it(`⑤ Cella（${board}）：原始與走一趟積木回來的判決與輸出相同`, async () => {
        const a = await runCella(p.code, { board, stdin: p.stdin })
        const b = await runCella(viaBlocks(lift(p.code)), { board, stdin: p.stdin })
        if (board === 'uno' && a.verdict === 'reject') {
          expect(a.problems.map((x) => `${x.kind}:${x.source?.text}`).join(' ')).toMatch(/^ubLib:\w+\.trim\(\)$/)
        } else {
          expect(a.verdict, describeCellaResult(a)).toBe('accept')
          expect(a.out.length).toBeGreaterThan(0)
        }
        expect(b.verdict, describeCellaResult(b)).toBe(a.verdict)
        expect(b.out).toBe(a.out)
      }, 120_000)
    }
  })
})
