/**
 * 模糊測試（438，2026-11-13）：Arduino 的中斷旗標（`volatile`）與 ESP32 的中斷函式（`IRAM_ATTR`）。
 * 八支程式由一個**看不到原始碼**的出題者寫（component-fuzz 的資訊隔離），刻意混了學生真的會寫的怪形狀
 * （多宣告子、修飾詞寫在型別後面、`static volatile`、`const volatile`、指向 volatile 的 volatile 指標、
 *  `IRAM_ATTR` 寫在回傳型別前面、前置宣告的中斷函式）。中斷由 setup() 直接呼叫處理函式來模擬（不用 attachInterrupt）。
 *
 * 判準：① 能 lift，降級的照原文一字不丟；② 產碼是不動點；③ 送 Cella（該板子）判 accept、輸出與出題者手算的一樣
 *   ——或照實 untranslated（降級的那一段 Cella 收不到），**不得是 reject**（說一支合法的程式有錯）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { runCella, expectCellaOut, knownCellaGap } from '../helpers/cella-run'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

const lift = (code: string) => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode) => generateCode(t, 'cpp', apcs as StylePreset)
const ids = (n: SemanticNode): string[] => [n.componentId, ...Object.values(n.slots ?? {}).flat().flatMap(ids)]

interface Fuzz { id: string; board: 'uno' | 'esp32'; code: string; serial: string }

// ⚠️ fuzz_3 的期望輸出出題者手算錯了順序（`handleButton` 裡先印 `reject#1`，`setup` 才印「120 skip」）——這裡是改正後的、Cella 判出來的那一份

const PROGRAMS: Fuzz[] = [
  { id: 'fuzz_1', board: 'uno', serial: 'a=7\r\nb=3\r\nx=73\r\n',
    code: 'volatile int a = 0, b = 0;\nint volatile x;\n\nvoid onRise();\nvoid onFall();\n\nvoid setup() {\n  Serial.begin(9600);\n  for (int i = 0; i < 5; i++) {\n    onRise();\n    if (i % 2 == 0) onFall();\n  }\n  x = a * 10 + b;\n  Serial.print("a=");\n  Serial.println(a);\n  Serial.print("b=");\n  Serial.println(b);\n  Serial.print("x=");\n  Serial.println(x);\n}\n\nvoid loop() {\n}\n\nvoid onRise() {\n  a += 2;\n}\n\nvoid onFall() {\n  b++;\n  a -= 1;\n}\n' },
  { id: 'fuzz_2', board: 'esp32', serial: 'dropped=2\r\n11\r\n22\r\n33\r\nhead=0 tail=3\r\n99\r\n',
    code: '#define BUF_SIZE 4\n\nvolatile uint8_t head = 0;\nvolatile uint8_t tail = 0;\nvolatile int buf[BUF_SIZE];\nvolatile unsigned long dropped = 0;\n\nIRAM_ATTR void pushSample(int v) {\n  uint8_t next = (head + 1) % BUF_SIZE;\n  if (next == tail) {\n    dropped++;\n    return;\n  }\n  buf[head] = v;\n  head = next;\n}\n\nint popSample() {\n  if (head == tail) return -1;\n  int v = buf[tail];\n  tail = (tail + 1) % BUF_SIZE;\n  return v;\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  for (int i = 1; i <= 5; i++) pushSample(i * 11);\n  Serial.print("dropped=");\n  Serial.println(dropped);\n  int v;\n  while ((v = popSample()) != -1) {\n    Serial.println(v);\n  }\n  pushSample(99);\n  Serial.print("head=");\n  Serial.print(head);\n  Serial.print(" tail=");\n  Serial.println(tail);\n  Serial.println(popSample());\n}\n\nvoid loop() {\n}\n' },
  { id: 'fuzz_3', board: 'uno', serial: '100 ok\r\nreject#1\r\n120 skip\r\n160 ok\r\n210 ok\r\nreject#2\r\n215 skip\r\n300 ok\r\npresses=4\r\n',
    code: 'volatile unsigned long lastPress = 0;\nvolatile byte presses = 0;\nconst unsigned long DEBOUNCE = 50;\n\nbool handleButton(unsigned long now);\n\nvoid setup() {\n  Serial.begin(9600);\n  unsigned long stamps[] = {100, 120, 160, 210, 215, 300};\n  for (int i = 0; i < 6; i++) {\n    bool ok = handleButton(stamps[i]);\n    Serial.print(stamps[i]);\n    Serial.println(ok ? " ok" : " skip");\n  }\n  Serial.print("presses=");\n  Serial.println(presses);\n}\n\nvoid loop() {\n}\n\nbool handleButton(unsigned long now) {\n  static unsigned long rejected = 0;\n  if (now - lastPress < DEBOUNCE) {\n    rejected++;\n    Serial.print("reject#");\n    Serial.println(rejected);\n    return false;\n  }\n  lastPress = now;\n  presses++;\n  return true;\n}\n' },
  { id: 'fuzz_4', board: 'esp32', serial: 'counts[0]=15\r\ncounts[1]=-9\r\ncounts[2]=1\r\nflag on\r\n',
    code: 'static volatile long counts[3] = {0, 0, 0};\nvolatile bool flag = false;\n\nvoid IRAM_ATTR isrA() {\n  counts[0] += 5;\n}\n\nvoid IRAM_ATTR isrB() {\n  counts[1] -= 3;\n  flag = !flag;\n}\n\nvoid IRAM_ATTR isrC() {\n  counts[2] = counts[0] + counts[1];\n}\n\nvoid (*handlers[3])() = {isrA, isrB, isrC};\n\nvoid setup() {\n  Serial.begin(115200);\n  int seq[] = {0, 1, 0, 2, 1, 1, 2, 0};\n  for (int i = 0; i < 8; i++) {\n    handlers[seq[i]]();\n  }\n  for (int i = 0; i < 3; i++) {\n    Serial.print("counts[");\n    Serial.print(i);\n    Serial.print("]=");\n    Serial.println(counts[i]);\n  }\n  Serial.println(flag ? "flag on" : "flag off");\n}\n\nvoid loop() {\n}\n' },
  { id: 'fuzz_5', board: 'uno', serial: 'A=-6\r\nB=25\r\nactive is A\r\nlimit=25\r\n',
    code: 'volatile int sensorA = 10;\nvolatile int sensorB = 20;\nvolatile int * volatile active = &sensorA;\nconst volatile int LIMIT = 25;\n\nvoid swapISR() {\n  active = (active == &sensorA) ? &sensorB : &sensorA;\n}\n\nvoid bumpISR(int amount) {\n  *active += amount;\n  if (*active > LIMIT) *active = LIMIT;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  bumpISR(4);\n  swapISR();\n  bumpISR(3);\n  bumpISR(5);\n  swapISR();\n  bumpISR(-20);\n  Serial.print("A=");\n  Serial.println(sensorA);\n  Serial.print("B=");\n  Serial.println(sensorB);\n  Serial.print("active is ");\n  Serial.println(active == &sensorA ? "A" : "B");\n  Serial.print("limit=");\n  Serial.println(LIMIT);\n}\n\nvoid loop() {\n}\n' },
  { id: 'fuzz_6', board: 'esp32', serial: '253\r\n0\r\n4\r\n14\r\ntotal=271\r\nwraps=1\r\n',
    code: 'volatile uint8_t tick = 250;\nvolatile unsigned long total = 0;\nvolatile int wraps = 0;\n\nuint8_t IRAM_ATTR onTick(uint8_t step) {\n  uint8_t before = tick;\n  tick += step;\n  if (tick < before) wraps++;\n  total += tick;\n  return tick;\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  uint8_t steps[] = {3, 3, 4, 10};\n  for (int i = 0; i < 4; i++) {\n    Serial.println(onTick(steps[i]));\n  }\n  Serial.print("total=");\n  Serial.println(total);\n  Serial.print("wraps=");\n  Serial.println(wraps);\n}\n\nvoid loop() {\n}\n' },
  { id: 'fuzz_7', board: 'uno', serial: 'len=4\r\n2,0,3,1\r\nlen=5\r\n2,0,3,1,0\r\npendingCount=3\r\n',
    code: "volatile bool pending[4] = {false, false, false, false};\nvolatile byte order[8];\nvolatile byte orderLen = 0;\n\nvoid markPin(byte pin) {\n  if (!pending[pin]) {\n    pending[pin] = true;\n    order[orderLen++] = pin;\n  }\n}\n\nvoid printOrder() {\n  Serial.print(\"len=\");\n  Serial.println(orderLen);\n  for (byte i = 0; i < orderLen; i++) {\n    Serial.print(order[i]);\n    if (i < orderLen - 1) Serial.print(',');\n  }\n  Serial.println();\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  byte events[] = {2, 0, 2, 3, 0, 1};\n  for (byte i = 0; i < sizeof(events); i++) {\n    markPin(events[i]);\n  }\n  printOrder();\n  pending[0] = false;\n  pending[2] = false;\n  markPin(0);\n  printOrder();\n  int pendingCount = 0;\n  for (int i = 0; i < 4; i++) {\n    pendingCount += pending[i] ? 1 : 0;\n  }\n  Serial.print(\"pendingCount=\");\n  Serial.println(pendingCount);\n}\n\nvoid loop() {\n}\n" },
  { id: 'fuzz_8', board: 'esp32', serial: 'pos=-2\r\nerrors=1\r\nstate=0\r\nCCW\r\n',
    code: 'volatile long position = 0;\nvolatile uint8_t lastState = 0;\nvolatile int errors = 0;\nconst int8_t QEM[16] = {0, -1, 1, 2, 1, 0, 2, -1, -1, 2, 0, 1, 2, 1, -1, 0};\n\nvoid IRAM_ATTR encoderISR(uint8_t a, uint8_t b);\n\nvoid setup() {\n  Serial.begin(115200);\n  uint8_t seqA[] = {0, 1, 1, 0, 0, 1, 0, 0};\n  uint8_t seqB[] = {1, 1, 0, 0, 0, 1, 1, 0};\n  for (int i = 0; i < 8; i++) {\n    encoderISR(seqA[i], seqB[i]);\n  }\n  Serial.print("pos=");\n  Serial.println(position);\n  Serial.print("errors=");\n  Serial.println(errors);\n  Serial.print("state=");\n  Serial.println(lastState);\n  Serial.println(position < 0 ? "CCW" : "CW");\n}\n\nvoid loop() {\n}\n\nvoid IRAM_ATTR encoderISR(uint8_t a, uint8_t b) {\n  uint8_t newState = (a << 1) | b;\n  int8_t delta = QEM[(lastState << 2) | newState];\n  if (delta == 2) {\n    errors++;\n  } else {\n    position += delta;\n  }\n  lastState = newState;\n}\n' },
]

/**
 * 每一支的處置（2026-11-13 量；439 起 volatile 陣列走陣列宣告那顆——fuzz_2 改歸 uint8、fuzz_7 整支 accept）：
 *   accept      整支翻得過去，Cella 判的輸出與期望相同
 *   untranslated 有一段照原文降級（volatile 的陣列／多宣告子／修飾詞在型別後／static volatile／const volatile／volatile 指標、函式指標陣列）
 *                ——降級的那段原文一字不丟，Cella 照實收不到（不是 reject）
 *   uint8       整支翻得過去，而 Cella 今天把沒有 `#include <Arduino.h>` 的 `uint8_t` 判成未宣告（已回報，等 cella 11-13 那一版）
 *               ——原文用 knownCellaGap 釘住；把 uint8_t／int8_t 換成 unsigned char／signed char 驗其餘行為
 */
const OUTCOME: Record<string, 'accept' | 'untranslated' | 'uint8'> = {
  fuzz_1: 'untranslated', fuzz_2: 'uint8', fuzz_3: 'accept', fuzz_4: 'untranslated',
  fuzz_5: 'untranslated', fuzz_6: 'uint8', fuzz_7: 'accept', fuzz_8: 'uint8',
}
/** 降級的那幾段（原文）：每一段都要原封不動出現在產出裡 */
const DEGRADED: Record<string, string[]> = {
  fuzz_1: ['int volatile x;'],   // 440 起 `volatile int a = 0, b = 0;` 有積木
  fuzz_4: ['static volatile long counts[3] = {0, 0, 0};', 'void (*handlers[3])() = {isrA, isrB, isrC};'],
  fuzz_5: ['volatile int * volatile active = &sensorA;', 'const volatile int LIMIT = 25;'],
}
/** 有 IRAM_ATTR 的：名字 → 哪一顆 */
const IRAM: Record<string, [string, string][]> = {
  fuzz_2: [['pushSample', 'cpp:func_def']],
  fuzz_4: [['isrA', 'cpp:func_def'], ['isrB', 'cpp:func_def'], ['isrC', 'cpp:func_def']],
  fuzz_6: [['onTick', 'cpp:func_def']],
  fuzz_8: [['encoderISR', 'cpp:forward_decl'], ['encoderISR', 'cpp:func_def']],
}
const findAll = (n: SemanticNode, id: string): SemanticNode[] =>
  [...(n.componentId === id ? [n] : []), ...Object.values(n.slots ?? {}).flat().flatMap((c) => findAll(c, id))]
const count = (s: string, w: string) => s.split(w).length - 1

describe('模糊測試：Arduino 中斷旗標與中斷函式（438，隔離出題）', () => {
  it.each(PROGRAMS)('$id：lift 不丟字、產碼是不動點、volatile 與 IRAM_ATTR 一個都沒少', ({ id, code }) => {
    const t = lift(code)
    const out = gen(t)
    expect(out.length).toBeGreaterThan(0)                                         // 正向錨點
    expect(gen(lift(out))).toBe(out)
    expect(count(out, 'volatile')).toBe(count(code, 'volatile'))                // 沒有一個 volatile 被悄悄丟掉
    expect(count(out, 'IRAM_ATTR')).toBe(count(code, 'IRAM_ATTR'))
    expect(out).not.toContain('IRAM_ATTR::')                                     // 434 那個錯形狀不回來
    for (const raw of DEGRADED[id] ?? []) expect(out).toContain(raw)
    const raws = ids(t).filter((x) => x.endsWith('raw_code')).length
    expect(raws).toBe((DEGRADED[id] ?? []).length)                              // 降級的就是那幾段，不多不少
    for (const [name, cid] of IRAM[id] ?? []) {
      expect(findAll(t, cid).find((n) => n.properties.name === name)?.properties.attribute).toBe('IRAM_ATTR')
    }
  })

  it.each(PROGRAMS)('$id：交給 Cella（板子）', async ({ id, board, code, serial }) => {
    const outcome = OUTCOME[id]
    if (outcome === 'accept') { await expectCellaOut(code, serial, { board }); return }
    if (outcome === 'uint8') {
      await knownCellaGap(/undeclared identifier 'uint8_t'/, () => expectCellaOut(code, serial, { board }))
      const plain = code.replace(/\buint8_t\b/g, 'unsigned char').replace(/\bint8_t\b/g, 'signed char')
      await expectCellaOut(plain, serial, { board })
      return
    }
    const r = await runCella(code, { board })
    expect(r.verdict).toBe('untranslated')                                       // 照實收不到，不是 reject
    expect(r.untranslated.length).toBeGreaterThan(0)
    expect(r.untranslated.every((u) => u.construct.endsWith('raw_code'))).toBe(true)   // 翻不出的只有降級的那幾段
  })
})
