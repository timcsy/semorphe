/**
 * 第 1 批兩顆**湊在一起**的 round-trip：`cpp:pin_attach` / `cpp:ultrasonic_trigger`。
 *
 * ## 🔴 這兩顆有一個別顆沒有的風險：**它們會改變【別人】的辨識結果**
 *
 * ```
 * pin_attach          搶走了本來會變成常數宣告的那些語句
 * ultrasonic_trigger  它的策略跑在【每一個大括號與每一個 translation_unit】上
 * ```
 *
 * 所以本檔除了「它們自己對不對」，還有一整節在問**「不該動的有沒有被動到」**
 * ——⚠️ 而那一節才是這一批的主要風險。
 *
 * ## 🔴 而這兩顆的假陽性形狀特別
 *
 * `pin_attach` 降級成常數宣告時，**產出的程式碼一模一樣**：
 *
 * ```cpp
 * const int ledPin = 13;      ← 兩種身分產出的文字完全相同
 * ```
 *
 * > **當兩個身分的投影一字不差時，只驗投影的測試永遠是綠的。**
 *
 * 所以每一段都必須斷言**身分**，不能只斷言輸出字串。
 *
 * ## ⚠️ 不做編譯與執行比對
 *
 * `g++` 編不動 sketch（沒有 `Arduino.h`），而這個專案沒有接 `arduino-cli`
 * ——**那不在本檔的宣稱範圍內**（第 0 批的報告也是這樣寫的）。
 * 本檔量的是辨識、產生、與 round-trip 的穩定性。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) nodes(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => nodes(n).map((x) => x.componentId)
const attaches = (n: SemanticNode): SemanticNode[] =>
  nodes(n).filter((x) => x.componentId === 'cpp:pin_attach')

function roundTrip(src: string): { once: string; twice: string; a: string[]; b: string[]; t1: SemanticNode; t2: SemanticNode } {
  const t1 = lift(src)
  const once = gen(t1)
  const t2 = lift(once)
  return { once, twice: gen(t2), a: ids(t1).sort(), b: ids(t2).sort(), t1, t2 }
}

/** 🔴 專屬身分在、而且沒有掉進降級。⚠️ 正向錨點先，負向才有意義。 */
function expectOwn(list: string[], own: string[]): void {
  for (const c of own) {
    expect(list, `🔴 專屬身分 ${c} 不見了——它可能降級了`).toContain(c)
  }
  expect(list, '🔴 有節點掉進 raw_code').not.toContain('cpp:raw_code')
  expect(list, '🔴 有節點掉進 raw_expression').not.toContain('cpp:raw_expression')
}

// ── 四段真實場景 ─────────────────────────────────────────────────────

/** ① 完整 HC-SR04——第 1 批的主場景，而它同時用到第 0 批的三顆 */
const HCSR04 = `const int trigPin = 9;
const int echoPin = 10;
const int buzzerPin = 8;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH);
  int distance = duration * 0.034 / 2;
  Serial.println(distance);
  if (distance < 20) {
    tone(buzzerPin, 880);
  } else {
    noTone(buzzerPin);
  }
  delay(200);
}
`

/** ② 紅綠燈——三顆接線並存，各自的 device 要各自正確 */
const TRAFFIC = `const int redPin = 2;
const int yellowPin = 3;
const int greenPin = 4;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop() {
  digitalWrite(greenPin, HIGH);
  delay(3000);
  digitalWrite(greenPin, LOW);
  digitalWrite(yellowPin, HIGH);
  delay(1000);
  digitalWrite(yellowPin, LOW);
  digitalWrite(redPin, HIGH);
  delay(3000);
  digitalWrite(redPin, LOW);
}
`

/** ③ L298N 馬達——🔴 名字裡真的沒有零件資訊，三顆的 device 都該是 unknown */
const L298N = `const int ENA = 5;
const int IN1 = 6;
const int IN2 = 7;

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
}

void loop() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 200);
  delay(2000);
  analogWrite(ENA, 0);
  delay(1000);
}
`

/** ④ 混合陷阱——該認的與不該認的在同一支程式裡 */
const MIXED_CONST = `const int ledPin = 13;
const int MAX_COUNT = 100;
const int threshold = 500;

int counter = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  counter = counter + 1;
  if (counter > MAX_COUNT) {
    counter = 0;
  }
  if (analogRead(A0) > threshold) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
  delay(50);
}
`

describe('第 1 批兩顆湊在一起（Arduino 零件）', () => {
  it('① 完整 HC-SR04：接線兩顆 ＋ 觸發摺起來 ＋ 換算留著', () => {
    const { once, twice, a, b, t1 } = roundTrip(HCSR04)
    expectOwn(a, [
      'cpp:pin_attach', 'cpp:ultrasonic_trigger',
      'cpp:pulse_read', 'cpp:tone', 'cpp:tone_stop',   // ← 第 0 批的三顆
      'cpp:pin_mode', 'cpp:serial_open', 'cpp:serial_print', 'cpp:delay',
    ])
    expect(twice, '文字漂移').toBe(once)
    expect(b, '結構漂移').toEqual(a)

    // 🔴 三顆接線各自的 device——這是「名字只決定標籤」真的在運作的證據
    const byName = new Map(attaches(t1).map((n) => [n.properties.name, n.properties.device]))
    expect(byName.size, '三顆接線都要在').toBe(3)
    expect(byName.get('trigPin')).toBe('ultrasonic_trig')
    expect(byName.get('echoPin')).toBe('ultrasonic_echo')
    expect(byName.get('buzzerPin')).toBe('buzzer')

    // ⚠️ 觸發序列摺成一顆之後，那五句不再各自出現；而換算兩句必須還在
    expect(a.filter((c) => c === 'cpp:ultrasonic_trigger')).toHaveLength(1)
    expect(a.filter((c) => c === 'cpp:delay_microseconds')).toHaveLength(0)
    expect(a).toContain('cpp:arithmetic')
  })

  it('② 紅綠燈：三顆接線並存，device 各自正確而不互相汙染', () => {
    const { once, twice, a, b, t1 } = roundTrip(TRAFFIC)
    expectOwn(a, ['cpp:pin_attach', 'cpp:digital_write', 'cpp:delay', 'cpp:pin_mode'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)

    const byName = new Map(attaches(t1).map((n) => [n.properties.name, n.properties.device]))
    expect(byName.size).toBe(3)                       // ← 正向錨點
    // 🔴 `red`／`yellow`／`green` 三個詞根都在 LED 那一族——而它們排在
    //    `buzzer`／`relay` 這些更明確的後面，所以不會被搶
    expect([...byName.values()]).toEqual(['led', 'led', 'led'])
  })

  it('🔴 ③ L298N：結構認得出來、名字認不出來——三顆 device 全是 unknown', () => {
    const { once, twice, a, b, t1 } = roundTrip(L298N)
    expectOwn(a, ['cpp:pin_attach', 'cpp:analog_write', 'cpp:digital_write'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)

    const list = attaches(t1)
    expect(list.map((n) => n.properties.name).sort()).toEqual(['ENA', 'IN1', 'IN2'])  // ← 正向錨點
    // 🔴 **這一條就是設計本身**：名字裡沒有零件資訊時，退的是【標籤】不是【結構】。
    //    馬達驅動的慣例腳位名（ENA／IN1／IN2）在 100 段語料裡是成系統的一族。
    expect(list.map((n) => n.properties.device)).toEqual(['unknown', 'unknown', 'unknown'])
  })

  it('🔴 ④ 混合：該認的認、不該認的一個都不准動', () => {
    const { once, twice, a, b, t1 } = roundTrip(MIXED_CONST)
    expectOwn(a, ['cpp:pin_attach', 'cpp:var_declare_const', 'cpp:analog_read'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)

    const list = attaches(t1)
    expect(list.map((n) => n.properties.name)).toEqual(['ledPin'])   // ← 只有它
    // 🔴 另外兩個常數必須**還是常數宣告**——而它們產出的文字與接線一模一樣，
    //    所以這一條只有問身分才問得出來。
    expect(a.filter((c) => c === 'cpp:var_declare_const')).toHaveLength(2)
  })
})

// ── 🔴 只有這一批才有的軸：不該認的時候，不認 ────────────────────────

describe('🔴 回歸：這兩顆不得改變【不相干程式】的辨識結果', () => {
  /**
   * 判準：**拿真實語料，挑掉與這兩顆相關的段落，其餘一個字都不能變。**
   *
   * ⚠️ 而「不能變」用什麼比？沒有「改動前」的樹可以比——
   * 所以比的是**這兩顆的身分一次都不該出現**，加上**殘差為零**。
   * 前者防誤認，後者防「認錯之後把別人的節點吃掉」。
   */
  const corpus = (): { id: string; code: string }[] => {
    const raw = JSON.parse(
      readFileSync(join(__dirname, '../probes/arduino-realistic-corpus.json'), 'utf8'),
    ) as Record<string, { code: string }>
    return Object.entries(raw)
      .map(([id, v]) => ({ id, code: v.code }))
      // 挑掉真的用到這兩顆的：有觸發序列的、有 const 腳位宣告的
      .filter((s) => !s.code.includes('delayMicroseconds'))
      .filter((s) => !/const\s+(?:int|byte|uint8_t)\s+\w+\s*=\s*\d+\s*;/.test(s.code))
  }

  it('⚠️ 入口條件：真的挑出了一批不相干的語料', () => {
    expect(corpus().length).toBeGreaterThanOrEqual(3)
  })

  it('🔴 不相干的語料裡，這兩顆的身分一次都不得出現', () => {
    const offenders: string[] = []
    let totalNodes = 0
    for (const s of corpus()) {
      const list = ids(lift(s.code))
      totalNodes += list.length
      for (const c of ['cpp:pin_attach', 'cpp:ultrasonic_trigger']) {
        if (list.includes(c)) offenders.push(`${s.id} → ${c}`)
      }
    }
    // ← 正向錨點：先證明真的 lift 出了東西，否則下面的負向會空過
    expect(totalNodes, 'lift 沒有產出任何節點——負向斷言會空過').toBeGreaterThan(200)
    expect(offenders, `誤認：${offenders.join('、')}`).toEqual([])
  })

  it('🔴 而誤認的另一種形狀是「把別人吃掉」——殘差必須是零', () => {
    const bad: string[] = []
    let total = 0
    for (const s of corpus()) {
      const list = ids(lift(s.code))
      total += list.length
      const residue = list.filter((c) => c === 'cpp:raw_code' || c === 'cpp:raw_expression')
      if (residue.length > 0) bad.push(`${s.id}: ${residue.length}`)
    }
    expect(total).toBeGreaterThan(200)              // ← 正向錨點
    expect(bad, `殘差：${bad.join('、')}`).toEqual([])
  })
})
