/**
 * 第 0 批九顆**湊在一起**的 round-trip（階段 6.16 的地基）。
 *
 * ## 🔴 這一支問的與各膠囊的 `spec.test.ts` 不同
 *
 * 那九支問的是「這一顆自己對不對」。**這一支問的是「它們一起用會不會壞」**
 * ——而測的是**真實的教學場景**，不是單顆片段。
 *
 * > **一顆一顆都對，不等於一段程式對——
 * > 而學生寫的永遠是一段，不是一顆。**
 *
 * ## 三個層級，缺一條都會讓綠燈變成假的
 *
 * ```
 * ① 文字不漂移      generate 兩次相同
 * ② 結構不漂移      lift → generate → lift 的身分集合相同
 * ③ 🔴 身分正確      用【專屬身分】而不是降級到 cpp:func_call／cpp:method_call
 * ```
 *
 * ③ 是最容易被漏掉的：一顆降級成 `func_call` 的積木**照樣產出正確的程式碼**
 * ——文字比對全綠，而學生的畫布上是一顆通用積木。
 *
 * ⚠️ **不重測單顆已釘住的東西**（可選引數的空逗號、micros 的毫秒解析度、
 * pulse_read 的 0、serial_read 的 -1、constrain 的型別、參數驗證）——那些在各自的
 * `spec.test.ts` 裡。重複測會讓「哪一條在守什麼」變模糊。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { resetClock, useRealTime } from '../../src/languages/cpp/core/runtime/arduino-clock'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
afterEach(() => { useRealTime(false); resetClock() })

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as StylePreset)
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) ids(k, out)
  return out
}

/**
 * 一段程式走完三個層級。
 *
 * ⚠️ 回傳身分**陣列**（不是集合）——同一顆出現兩次與出現一次是不同的樹，
 * 而集合會把那個差別吃掉。
 */
function roundTrip(src: string): { once: string; twice: string; a: string[]; b: string[] } {
  const t1 = lift(src)
  const once = gen(t1)
  const t2 = lift(once)
  const twice = gen(t2)
  return { once, twice, a: ids(t1).sort(), b: ids(t2).sort() }
}

/** 🔴 專屬身分在、而且沒有掉進降級或通用呼叫。 */
function expectOwn(list: string[], own: string[]): void {
  for (const c of own) {
    expect(list, `🔴 專屬身分 ${c} 不見了——它可能降級成了通用呼叫`).toContain(c)
  }
  // ← 正向錨點在上面：先證明專屬身分真的在，下面的負向才有意義
  expect(list, '🔴 有節點掉進 raw_code').not.toContain('cpp:raw_code')
  expect(list, '🔴 有節點掉進 raw_expression').not.toContain('cpp:raw_expression')
  expect(list, '🔴 降級成了通用的自由函式呼叫').not.toContain('cpp:func_call')
  expect(list, '🔴 降級成了通用的方法呼叫').not.toContain('cpp:method_call')
}

// ─────────────────────────────────────────────────────────────
// 四段真實的教學場景
// ─────────────────────────────────────────────────────────────

const BUZZER = `void setup() {
  pinMode(8, OUTPUT);
}

void loop() {
  tone(8, 440, 200);
  delay(300);
  tone(8, 880);
  delay(200);
  noTone(8);
  delay(1000);
}
`

/** 🔴 第 0 批的主場景——它同時用到四顆新的與兩顆舊的。 */
const ULTRASONIC = `const int trigPin = 9;
const int echoPin = 10;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000);
  long distance = duration * 0.034 / 2;
  distance = constrain(distance, 0, 400);
  Serial.println(distance);
  delay(200);
}
`

const SERIAL_IN = `void setup() {
  Serial.begin(9600);
}

void loop() {
  while (Serial.available()) {
    int c = Serial.read();
    Serial.println(c);
  }
}
`

/**
 * ⑤ **軟體 PWM**——`delayMicroseconds` 在超音波以外的真實用法。
 *
 * 🔴 加入日 2026-08-18：第 1 批把觸發序列摺成一顆之後，②不再覆蓋
 * `delay_microseconds`。而本檔的標題斷言是「九顆全部被覆蓋到」——
 * ⚠️ **不補的話那句話會變成假的，而它仍然是綠的。**
 *
 * 這段刻意**不是**觸發序列的形狀（HIGH → 等 → LOW → 等，而觸發是
 * LOW → 2µs → HIGH → 10µs → LOW），所以它不會被摺。
 */
const SOFT_PWM = `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  delayMicroseconds(500);
  digitalWrite(9, LOW);
  delayMicroseconds(1500);
}
`

const MIXED = `void setup() {
  Serial.begin(9600);
  analogReadResolution(12);
}

void loop() {
  unsigned long t = micros();
  int hz = map(analogRead(A0), 0, 4095, 100, 2000);
  hz = constrain(hz, 100, 2000);
  tone(8, hz);
  Serial.println(t);
}
`

describe('第 0 批九顆湊在一起（Arduino 內建函式）', () => {
  it('① 蜂鳴器：tone／noTone／delay', () => {
    const { once, twice, a, b } = roundTrip(BUZZER)
    expectOwn(a, ['cpp:tone', 'cpp:tone_stop', 'cpp:delay', 'cpp:pin_mode'])
    expect(twice, '文字漂移').toBe(once)
    expect(b, '結構漂移').toEqual(a)
    // ⚠️ 兩顆 tone 都要在（一顆帶毫秒、一顆不帶）——集合會吃掉這個差別
    expect(a.filter((c) => c === 'cpp:tone')).toHaveLength(2)
  })

  it('② 🔴 超音波：觸發序列【已被第 1 批摺成一顆】，而換算沒有', () => {
    const { once, twice, a, b } = roundTrip(ULTRASONIC)
    expectOwn(a, [
      'cpp:ultrasonic_trigger', 'cpp:pulse_read', 'cpp:math_constrain',
      'cpp:pin_mode', 'cpp:serial_open', 'cpp:serial_print', 'cpp:delay',
    ])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // 🔴 **這一條在 2026-08-18 從「兩次 delayMicroseconds」改成「零次」。**
    //
    // 第 1 批把那五句觸發序列摺成一顆積木——資格是數出來的（100 段語料裡
    // 用到超音波的 14 段，觸發序列 14/14 完全一致）。⚠️ 而摺進去之後，
    // 這一段就**不再覆蓋** `delay_microseconds` 與 `digital_write` 了。
    //
    // > **一顆預組積木把它摺掉的那些概念，從別人的覆蓋清單裡一起帶走。**
    //
    // 覆蓋補在下面的⑤（軟體 PWM——`delayMicroseconds` 真實的另一種用法）。
    expect(a.filter((c) => c === 'cpp:delay_microseconds')).toHaveLength(0)
    expect(a.filter((c) => c === 'cpp:ultrasonic_trigger')).toHaveLength(1)
    // ⚠️ 而換算那兩句**必須還在**——摺的只有觸發（觸發＋換算緊鄰只有 9/14）
    expect(a).toContain('cpp:pulse_read')
  })

  it('③ 序列埠輸入：available ＋ read 的成對寫法', () => {
    const { once, twice, a, b } = roundTrip(SERIAL_IN)
    expectOwn(a, ['cpp:serial_count', 'cpp:serial_read', 'cpp:serial_open', 'cpp:serial_print'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // ⚠️ `while (Serial.available())` —— 條件裡的那顆不得被吃掉
    expect(a).toContain('cpp:loop_while')
  })

  it('④ 混合：micros ＋ analogReadResolution ＋ map ＋ constrain ＋ tone', () => {
    const { once, twice, a, b } = roundTrip(MIXED)
    expectOwn(a, [
      'cpp:micros', 'cpp:analog_resolution', 'cpp:math_constrain',
      'cpp:tone', 'cpp:range_remap', 'cpp:analog_read',
    ])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
  })

  it('🔴 殘差：四段合起來零個降級節點', () => {
    const all = [BUZZER, ULTRASONIC, SERIAL_IN, MIXED].flatMap((s) => ids(lift(s)))
    // ← 正向錨點：先證明真的量到了東西
    expect(all.length, '一個節點都沒量到 → 下面的負向會空過').toBeGreaterThan(80)
    const bad = all.filter((c) => c === 'cpp:raw_code' || c === 'cpp:raw_expression')
    expect(bad, `殘差 ${bad.length}/${all.length}`).toHaveLength(0)
  })

  it('⑤ 軟體 PWM：delayMicroseconds 的另一種真實用法（不得被摺）', () => {
    const { once, twice, a, b } = roundTrip(SOFT_PWM)
    expectOwn(a, ['cpp:delay_microseconds', 'cpp:digital_write', 'cpp:pin_mode'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // 🔴 這段不是觸發序列的形狀——摺了就是誤認
    expect(a).not.toContain('cpp:ultrasonic_trigger')
    expect(a.filter((c) => c === 'cpp:delay_microseconds')).toHaveLength(2)
  })

  it('🔴 九顆【全部】在這五段裡被覆蓋到——沒有一顆是靠單顆測試自證的', () => {
    // ⚠️ **從四段變五段**（2026-08-18）：第 1 批把超音波的觸發序列摺成一顆，
    //    ②因此不再產出 `delay_microseconds`——而這一條當場變紅。
    //    🟢 **那正是它存在的理由**：覆蓋被別人帶走時要有人叫。
    const all = new Set([BUZZER, ULTRASONIC, SERIAL_IN, MIXED, SOFT_PWM].flatMap((s) => ids(lift(s))))
    const BATCH0 = [
      'cpp:micros', 'cpp:delay_microseconds', 'cpp:tone', 'cpp:tone_stop', 'cpp:pulse_read',
      'cpp:math_constrain', 'cpp:analog_resolution', 'cpp:serial_count', 'cpp:serial_read',
    ]
    const missing = BATCH0.filter((c) => !all.has(c))
    // ⚠️ 這一條防的是「場景寫得漂亮而漏掉一顆」——那會讓覆蓋看起來比實際好
    expect(missing, `這幾顆只有單顆測試在守：${missing.join('、')}`).toEqual([])
  })
})
