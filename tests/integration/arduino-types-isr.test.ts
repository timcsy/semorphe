/**
 * 434：Arduino 語料（探針 arduino-realistic／wide）裡兩類【翻不出】與一類【安靜地改掉程式】。
 *
 * ① `byte`／`boolean`（Arduino.h 的 typedef）：Cella 的模型還不認得這兩個名字 → 前端照 typedef 送 tUChar／tBool（Cella 補了名字再改回）
 * ② `volatile bool f`：原本 `volatile` 被丟掉，產回去 `bool f`——另一支程式。434 整句誠實降級；🟢 438 起有自己的元件（易變變數）
 * ③ `void IRAM_ATTR onPress()`：解析器補了不存在的 `::`，被當成類別外的方法定義，產回去 `void IRAM_ATTR::onPress()`——編不過。
 *    434 整段誠實降級；🟢 438 起記成函式定義的屬性，積木換成「定義中斷函式」那個形態，送 Cella 時去掉（板子上）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { expectCellaOut, runCella } from '../helpers/cella-run'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/panels/blocks/dynamic-dropdown-field'
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

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const lift = (code: string) => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode): string[] => [n.componentId, ...Object.values(n.slots ?? {}).flat().flatMap(ids)]
const sketch = (top: string, body: string) => `${top}\nvoid setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {}\n`

describe('Arduino.h 的 byte／boolean', () => {
  for (const board of ['uno', 'esp32']) {
    it(`${board}：byte 255 + 1 繞回 0；boolean 照 bool`, async () => {
      await expectCellaOut(sketch('byte g = 200;', '  byte x = 255;\n  x = x + 1;\n  boolean b = 5;\n  Serial.println(x);\n  Serial.println(g);\n  Serial.println(b);'),
        '0\r\n200\r\n1\r\n', { board })
    })
  }
  it('不在板子上：byte 不是標準 C++ 的型別，照實翻不出', async () => {
    const r = await runCella('int main() { byte x = 1; }\n')
    expect(r.verdict).toBe('untranslated')
  })
})

describe('438：中斷旗標與中斷函式有自己的積木（四個面向 ＋ 翻給 Cella）', () => {
  // ⚠️ 反引號是刻意的：audit-declared-slots 的語料是測試檔裡【反引號】的 C++ 片段——寫成單引號，那條護欄就量不到易變變數這顆
  const ISR_NO_ATTACH = `volatile bool pressed = false;
volatile unsigned long count = 0;
void IRAM_ATTR onPress() {
  pressed = true;
  count = count + 1;
}
void setup() {
  Serial.begin(9600);
  onPress();
  onPress();
  if (pressed) {
    Serial.println(count);
  }
}
void loop() {}
`
  const gen = (t: SemanticNode) => generateCode(t, 'cpp', apcs as StylePreset)
  const findAll = (n: SemanticNode, id: string): SemanticNode[] =>
    [...(n.componentId === id ? [n] : []), ...Object.values(n.slots ?? {}).flat().flatMap((c) => findAll(c, id))]

  let extractor: PatternExtractor
  beforeAll(async () => {
    registerFieldMultilineInput()
    registerDynamicDropdownField()
    for (const k of ['names', 'vars', 'funcs', 'arrays', 'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) declareDropdownSource(k, () => [])
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
    extractor = new PatternExtractor()
    extractor.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(extractor)
  }, 180_000)

  /** render → Blockly 載入 → extract → 產碼（③④） */
  function viaBlocks(code: string): { types: string[]; out: string } {
    const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(code))
    const ws = new Blockly.Workspace()
    try { Blockly.serialization.workspaces.load(state, ws) } finally { ws.dispose() }
    const types: string[] = []
    const chain = (b0: unknown): SemanticNode[] => {
      const acc: SemanticNode[] = []
      let cur = b0 as { type?: string; next?: { block: unknown } } | undefined
      while (cur) { types.push(String(cur.type)); const n = extractor.extract(cur as never); if (n) acc.push(n); cur = (cur.next?.block ?? undefined) as typeof cur }
      return acc
    }
    const backs = (state.blocks.blocks as unknown[]).flatMap(chain)
    return { types, out: gen({ componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode) }
  }

  it('① ② lift：易變變數與帶屬性的函式定義各是自己的形狀，產回去一字不差、轉第二圈不變', () => {
    const t = lift(ISR_NO_ATTACH)
    expect(findAll(t, 'cpp:var_declare_volatile').map((n) => n.properties.name)).toEqual(['pressed', 'count'])   // 正向錨點
    const fd = findAll(t, 'cpp:func_def').find((n) => n.properties.name === 'onPress')
    expect(fd?.properties.attribute).toBe('IRAM_ATTR')
    expect(ids(t)).not.toContain('cpp:raw_code')
    expect(ids(t)).not.toContain('cpp:method_def_outside')
    const out = gen(t)
    expect(out).toContain('volatile unsigned long count = 0;')
    expect(out).toContain('void IRAM_ATTR onPress() {')
    expect(gen(lift(out))).toBe(out)
  })

  it('③ ④ 走一趟積木：用的是「定義中斷函式」與「易變變數」兩顆，回來一字不差', () => {
    const { types, out } = viaBlocks(ISR_NO_ATTACH)
    expect(types).toContain('cpp_func_def_IRAM_ATTR')         // 正向錨點：形態軸選到了
    expect(types).toContain('cpp_var_declare_volatile')
    expect(out).toBe(gen(lift(ISR_NO_ATTACH)))
  })

  // 🔴 438 盲測抓到的兩個形狀：屬性寫在回傳型別【前面】（`IRAM_ATTR void f()`——原本回傳型別被讀成「IRAM_ATTR void」），
  //    與中斷函式的【原型】（`void IRAM_ATTR f(…);`——原本整段降級）。屬性都記在 `attribute`，產回去統一寫在型別與名字之間（同一支程式）
  it.each([
    ['void IRAM_ATTR onPulse() {\n    pulses++;\n}\n', 'cpp:func_def', 'void', 'void IRAM_ATTR onPulse() {', 'cpp_func_def_IRAM_ATTR'],
    ['IRAM_ATTR void pushSample(int v) {\n}\n', 'cpp:func_def', 'void', 'void IRAM_ATTR pushSample(int v) {', 'cpp_func_def_IRAM_ATTR'],
    ['IRAM_ATTR uint8_t onTick(uint8_t step) {\n    return step;\n}\n', 'cpp:func_def', 'uint8_t', 'uint8_t IRAM_ATTR onTick(uint8_t step) {', 'cpp_func_def_IRAM_ATTR'],
    ['void IRAM_ATTR encoderISR(uint8_t a, uint8_t b);\n', 'cpp:forward_decl', 'void', 'void IRAM_ATTR encoderISR(uint8_t a, uint8_t b);', 'cpp_forward_decl_IRAM_ATTR'],
    ['IRAM_ATTR void onPress();\n', 'cpp:forward_decl', 'void', 'void IRAM_ATTR onPress();', 'cpp_forward_decl_IRAM_ATTR'],
    ['IRAM_ATTR uint8_t onTick(uint8_t step);\n', 'cpp:forward_decl', 'uint8_t', 'uint8_t IRAM_ATTR onTick(uint8_t step);', 'cpp_forward_decl_IRAM_ATTR'],
  ])('屬性的位置與原型：%s', (code, id, ret, header, blockType) => {
    const t = lift(code)
    const n = findAll(t, id)[0]
    expect(n?.properties.attribute).toBe('IRAM_ATTR')            // 正向錨點
    expect(n?.properties.return_type).toBe(ret)
    expect(ids(t)).not.toContain('cpp:raw_code')
    // 🔴 瀏覽器實測（438）：lift 認得出意思，而解析器留下的 ERROR 沒有人認領——積木掛「程式碼含語法錯誤」、編輯器畫紅線。
    //    合法的程式不得被標成語法錯誤（樹修復 ⑤ 認領它，見 `misparse.ts`）
    const marked = (x: SemanticNode): boolean => x.metadata?.degradationCause === 'syntax_error' || Object.values(x.slots ?? {}).flat().some(marked)
    expect(marked(t)).toBe(false)
    expect(n?.metadata?.confidence).toBe('high')
    const out = gen(t)
    expect(out).toContain(header)
    expect(gen(lift(out))).toBe(out)
    const back = viaBlocks(code)
    expect(back.types).toContain(blockType)
    expect(back.out).toBe(out)
  })

  it('一般的原型不受影響；別的巨集寫在原型上照舊整段降級', () => {
    expect(viaBlocks('void f(int a);\n').types).toContain('cpp_forward_decl')
    expect(viaBlocks('void f(int a);\n').types).not.toContain('cpp_forward_decl_IRAM_ATTR')
    const t = lift('void ICACHE_RAM_ATTR onPress(int a);\n')
    expect(ids(t).some((x) => x.endsWith('raw_code'))).toBe(true)
    expect(gen(t)).toContain('void ICACHE_RAM_ATTR onPress(int a);')
  })

  it('一般的函式定義不受影響：沒有屬性就是原本那顆積木', () => {
    const { types } = viaBlocks('void f() {\n}\n')
    expect(types).toContain('cpp_func_def')
    expect(types).not.toContain('cpp_func_def_IRAM_ATTR')
  })

  it('別的屬性巨集照舊整段降級（不猜它是什麼）', () => {
    const t = lift('void ICACHE_RAM_ATTR onPress() {\n}\n')
    expect(ids(t)).toContain('cpp:raw_code')
    expect(gen(t)).toContain('void ICACHE_RAM_ATTR onPress() {')
  })

  for (const board of ['uno', 'esp32']) {
    it(`⑤ 翻給 Cella（${board}）：volatile 與 IRAM_ATTR 送出時去掉，結果照一般程式`, async () => {
      await expectCellaOut(ISR_NO_ATTACH, '2\r\n', { board })
    })
  }

  // 🟢 439：**易變陣列**（中斷用的環形緩衝區）——`volatile` 與 `const` 一樣是型別修飾詞，住進元素型別、走陣列宣告那顆元件
  const RING = `volatile int buf[4];
volatile int head = 0;
volatile bool seen[3] = {false, true, false};
void IRAM_ATTR push(int v) {
  buf[head] = v;
  head = (head + 1) % 4;
}
void setup() {
  Serial.begin(9600);
  for (int i = 1; i <= 5; i++) {
    push(i * 10);
  }
  Serial.println(buf[0]);
  Serial.println(head);
  Serial.println(seen[1]);
}
void loop() {}
`
  it('439 ① ② 易變陣列：陣列宣告那顆、元素型別帶著 volatile，產回去一字不差、轉第二圈不變', () => {
    const t = lift(RING)
    expect(findAll(t, 'cpp:array_declare').map((n) => `${n.properties.type} ${n.properties.name}`))
      .toEqual(['volatile int buf', 'volatile bool seen'])        // 正向錨點
    expect(ids(t)).not.toContain('cpp:raw_code')
    const out = gen(t)
    expect(out).toContain('volatile int buf[4];')
    expect(out).toContain('volatile bool seen[3] = {false, true, false};')
    expect(gen(lift(out))).toBe(out)
  })

  it('439 ③ ④ 易變陣列走一趟積木：陣列宣告那顆，回來一字不差', () => {
    const { types, out } = viaBlocks(RING)
    expect(types).toContain('cpp_array_declare')
    expect(out).toBe(gen(lift(RING)))
  })

  for (const board of ['uno', 'esp32']) {
    it(`439 ⑤ 易變陣列翻給 Cella（${board}）：volatile 在型別那一層去掉`, async () => {
      // 五筆寫進四格的環：第五筆蓋掉 buf[0]（50）、head 繞回 1
      await expectCellaOut(board === 'uno' ? RING.replace('void IRAM_ATTR push', 'void push') : RING, '50\r\n1\r\n1\r\n', { board })
    })
  }

  // 🟢 440：多宣告子（照 const 那一族：外層一般宣告帶修飾詞、每一個宣告子是易變變數）與 `static volatile`（靜態變數那顆，volatile 住進型別）
  const MORE = `volatile int a = 0, b = 0;
volatile int c, d = 3;
int bump() {
  static volatile int k = 0;
  k++;
  return k;
}
void setup() {
  Serial.begin(9600);
  a = 2;
  b = a + d;
  bump();
  Serial.println(b);
  Serial.println(bump());
}
void loop() {}
`
  it('440 ① ② 多宣告子與 static volatile：各是自己的形狀，產回去一字不差、轉第二圈不變', () => {
    const t = lift(MORE)
    expect(findAll(t, 'cpp:var_declare_volatile').map((n) => n.properties.name)).toEqual(['a', 'b', 'c', 'd'])  // 正向錨點
    expect(findAll(t, 'cpp:var_declare_static').map((n) => `${n.properties.type} ${n.properties.name}`)).toEqual(['volatile int k'])
    expect(ids(t)).not.toContain('cpp:raw_code')
    const out = gen(t)
    expect(out).toContain('volatile int a = 0, b = 0;')
    expect(out).toContain('volatile int c, d = 3;')
    expect(out).toContain('static volatile int k = 0;')
    expect(gen(lift(out))).toBe(out)
  })

  it('440 ③ ④ 走一趟積木：多宣告子拆成一行一個（與 const 那一族同一個既有行為），其餘一字不差、意思不變', () => {
    const { types, out } = viaBlocks(MORE)
    expect(types.filter((t) => t === 'cpp_var_declare_volatile')).toHaveLength(4)   // 正向錨點：四個宣告子各是一顆
    const split = MORE.replace('volatile int a = 0, b = 0;', 'volatile int a = 0;\nvolatile int b = 0;')
      .replace('volatile int c, d = 3;', 'volatile int c;\nvolatile int d = 3;')
    expect(out).toBe(gen(lift(split)))
    const k = viaBlocks('const int M = 1, N = 2;\n')                               // 同族的對照：const 也是這樣拆
    expect(k.out.trim()).toBe('const int M = 1;\nconst int N = 2;')
  })

  it('440：`static int s1 = 1, s2 = 2;` 每一個宣告子都在（原本 s2 在 lift 就蒸發）', async () => {
    const code = 'static int s1 = 1, s2 = 2;\nstatic int s3;\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(s1 + s2 + s3);\n}\nvoid loop() {}\n'
    const t = lift(code)
    expect(findAll(t, 'cpp:var_declare_static').map((n) => n.properties.name)).toEqual(['s1', 's2', 's3'])  // 正向錨點
    expect(ids(t)).not.toContain('cpp:raw_code')
    const out = gen(t)
    expect(out).toContain('static int s1 = 1, s2 = 2;')
    expect(gen(lift(out))).toBe(out)
    await expectCellaOut(code, '3\r\n', { board: 'uno' })
    const back = viaBlocks(code)
    expect(back.out).toContain('static int s2 = 2;')
  })

  for (const board of ['uno', 'esp32']) {
    it(`440 ⑤ 翻給 Cella（${board}）：volatile 去掉、static 照舊`, async () => {
      await expectCellaOut(MORE, '5\r\n2\r\n', { board })
    })
  }

  it('440：修飾詞寫在 static 前面（`volatile static`）照原文降級——產回去不換順序', () => {
    const t = lift('volatile static int z = 1;\n')
    expect(ids(t)).toContain('cpp:raw_code')
    expect(gen(t).trim()).toBe('volatile static int z = 1;')
  })

  it.each([
    ['static int a[3];\n'],
    ['static int *p;\n'],
    ['static int *q = 0;\n'],
    ['static volatile long counts[3];\n'],
  ])('439：static 的陣列／指標照原文誠實降級（原本 `static int a[3];` 產回 `static int x;`）：%s', (code) => {
    const t = lift(code)
    expect(ids(t)).toContain('cpp:raw_code')                     // 正向錨點：降級了
    expect(gen(t).trim()).toBe(code.trim())
  })

  /** 目標性來回（component-roundtrip，438）：語料原文 ＋ 四支邊界——身分、不動點、走一趟積木、Cella 判決 */
  const CORPUS_ESP32_COUNTER = "// ESP32: counting button presses with a hardware interrupt.\n// The ISR must be short, so it only touches a volatile variable.\n\nconst int BUTTON_PIN = 15;\nconst int LED_PIN = 2;\n\nvolatile unsigned long pressCounter = 0;\nvolatile unsigned long lastInterruptTime = 0;\n\nvoid IRAM_ATTR handleButton() {\n  unsigned long now = millis();\n  // ignore anything within 200 ms, that is just switch bounce\n  if (now - lastInterruptTime > 200) {\n    pressCounter++;\n    lastInterruptTime = now;\n  }\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(BUTTON_PIN, INPUT_PULLUP);\n  pinMode(LED_PIN, OUTPUT);\n\n  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButton, FALLING);\n  Serial.println(\"Interrupt counter ready\");\n}\n\nvoid loop() {\n  static unsigned long shown = 0;\n\n  if (pressCounter != shown) {\n    shown = pressCounter;\n    Serial.print(\"Presses: \");\n    Serial.println(shown);\n\n    // blink to confirm\n    digitalWrite(LED_PIN, HIGH);\n    delay(80);\n    digitalWrite(LED_PIN, LOW);\n  }\n}\n"
  const RT: { name: string; code: string; vol: number; iram: number; out?: string }[] = [
    { name: '語料：ESP32 按鈕計數（wide 語料原文）', code: CORPUS_ESP32_COUNTER, vol: 2, iram: 1 },
    { name: 'Uno：旗標在 loop 裡輪詢', code: 'volatile bool ready = true;\nvolatile int ticks = 0;\nvoid setup() {\n  Serial.begin(9600);\n  for (int i = 0; i < 3; i++) {\n    ticks++;\n  }\n  if (ready) {\n    Serial.println(ticks);\n  }\n}\nvoid loop() {}\n', vol: 2, iram: 0, out: '3\r\n' },
    { name: '函式裡的易變變數，初值是運算式', code: 'int f() {\n  volatile int t = 3 * 4;\n  t = t + 1;\n  return t;\n}\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(f());\n}\nvoid loop() {}\n', vol: 1, iram: 0, out: '13\r\n' },
    { name: '帶參數與回傳值的中斷函式', code: 'int IRAM_ATTR twice(int x) {\n  return x * 2;\n}\nvoid setup() {\n  Serial.begin(9600);\n  Serial.println(twice(21));\n}\nvoid loop() {}\n', vol: 0, iram: 1, out: '42\r\n' },
    { name: '兩個中斷函式共用一個旗標', code: 'volatile byte which = 0;\nvoid IRAM_ATTR onA() {\n  which = 1;\n}\nvoid IRAM_ATTR onB() {\n  which = 2;\n}\nvoid setup() {\n  Serial.begin(9600);\n  onA();\n  onB();\n  Serial.println(which);\n}\nvoid loop() {}\n', vol: 1, iram: 2, out: '2\r\n' },
  ]
  it.each(RT)('來回：$name', ({ code, vol, iram }) => {
    const t = lift(code)
    expect(findAll(t, 'cpp:var_declare_volatile')).toHaveLength(vol)                                   // 身分
    expect(findAll(t, 'cpp:func_def').filter((n) => n.properties.attribute === 'IRAM_ATTR')).toHaveLength(iram)
    expect(ids(t)).not.toContain('cpp:raw_code')
    const out = gen(t)
    expect(gen(lift(out))).toBe(out)                                                                     // 不動點
    const back = viaBlocks(code)
    expect(back.types.filter((x) => x === 'cpp_func_def_IRAM_ATTR')).toHaveLength(iram)                     // 形態
    expect(back.out).toBe(out)                                                                           // 走一趟積木一字不差
  })
  for (const { name, code, out } of RT.filter((r) => r.out)) {
    for (const board of ['uno', 'esp32']) {
      it(`來回後的程式照樣判對（${board}）：${name}`, async () => {
        await expectCellaOut(gen(lift(code)), out!, { board })
      })
    }
  }

  it('⑤ 不在板子上：IRAM_ATTR 不是標準 C++，照實翻不出', async () => {
    const r = await runCella('void IRAM_ATTR f() {\n}\nint main() {\n  f();\n}\n')
    expect(r.verdict).toBe('untranslated')
  })
})

describe('437：中斷函式在 Cella 有模型之前照實翻不出，不被判「未宣告」', () => {
  // 🔴 一支合法的中斷 sketch，原本被 Cella 說「use of undeclared identifier 'attachInterrupt'」（P6：說合法的程式有錯）
  const INT = '#include <Arduino.h>\nint n = 0;\nvoid onPress() {\n  n++;\n}\nvoid setup() {\n  Serial.begin(9600);\n  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);\n}\nvoid loop() {\n  noInterrupts();\n  int c = n;\n  interrupts();\n  Serial.println(c);\n  delay(1000);\n}\n'
  for (const board of ['uno', 'esp32']) {
    it(`${board}：翻不出，原因指名中斷`, async () => {
      // 正向錨點：同一支去掉中斷呼叫就判得出
      const plain = await runCella(INT.replace('  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);\n', '').replace('  noInterrupts();\n', '').replace('  interrupts();\n', ''), { board })
      expect(plain.verdict).not.toBe('untranslated')
      const r = await runCella(INT, { board })
      expect(r.verdict).toBe('untranslated')
      expect(r.untranslated.map((u) => u.reason).join('\n')).toMatch(/中斷/)
      expect(r.problems.some((p) => p.kind === 'undeclared')).toBe(false)
    }, 120_000)
  }
})
