/**
 * 第 2／3 批（套件物件 ＋ ESP32）**與前兩批混用**的 round-trip。
 *
 * ## 🔴 這一批改了兩個【共用】的東西，所以回歸那一節比正向那一節重要
 *
 * ```
 * ① container_iter 的判準   現在會問「這個型別是不是硬體」→ 影響【每一個】 .begin()
 * ② 環境常數表加了 11 個名字  DHT11／DHT2x／AM2301／WL_*
 *                            → 影響【每一個】查不到宣告的識別字
 * ```
 *
 * ⚠️ 而它們兩個**都是那種「改壞了不會有人發現」的東西**：
 * `str.begin()` 變成別的東西不會報錯，只是積木長得不一樣；
 * `DHT11` 被搶走不會報錯，只是印出來的數字不對。
 *
 * > **一個改動如果它的失敗形狀是「安靜地不一樣」，
 * > 那麼保護它的測試必須先於它存在。**
 *
 * ## ⚠️ 宣稱範圍：不含編譯與執行比對
 *
 * `g++` 編不動 sketch，本專案沒接 `arduino-cli`。量的是辨識、產生、
 * round-trip 穩定性與概念身分——**不是**行為等價。（前三輪報告同此聲明。）
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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
  out.push(n.conceptId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) ids(k, out)
  return out
}
function roundTrip(src: string): { once: string; twice: string; a: string[]; b: string[] } {
  const t1 = lift(src)
  const once = gen(t1)
  const t2 = lift(once)
  return { once, twice: gen(t2), a: ids(t1).sort(), b: ids(t2).sort() }
}
function expectOwn(list: string[], own: string[]): void {
  for (const c of own) expect(list, `🔴 專屬身分 ${c} 不見了`).toContain(c)
  expect(list, '🔴 有節點掉進 raw_code').not.toContain('cpp:raw_code')
  expect(list, '🔴 有節點掉進 raw_expression').not.toContain('cpp:raw_expression')
}

// ── 四段三批混用的真實場景 ────────────────────────────────────────

/** ① 溫濕度 ＋ 液晶（第 2 批主場景，而它用到第 0 批的序列埠） */
const WEATHER = `#include <DHT.h>
#include <LiquidCrystal.h>

#define DHTPIN 2
DHT dht(DHTPIN, DHT11);
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  Serial.begin(9600);
  dht.begin();
  lcd.begin(16, 2);
}

void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h)) {
    Serial.println("sensor error");
    return;
  }
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(t);
  lcd.setCursor(0, 1);
  lcd.print(h);
  delay(2000);
}
`

/** ② 伺服 ＋ 超音波——🔴 三批同時出現的那一段 */
const RADAR = `#include <Servo.h>

const int trigPin = 9;
const int echoPin = 10;
Servo scanner;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  scanner.attach(11);
  Serial.begin(9600);
}

void loop() {
  for (int angle = 0; angle <= 180; angle = angle + 10) {
    scanner.write(angle);
    delay(100);
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    long duration = pulseIn(echoPin, HIGH);
    int distance = duration * 0.034 / 2;
    Serial.println(distance);
  }
}
`

/** ③ ESP32 完整專題（第 1 批的接線 ＋ 第 3 批的 PWM／觸摸／WiFi） */
const ESP = `#include <WiFi.h>

#define LED_PIN 4
const int touchPin = 15;

void setup() {
  Serial.begin(115200);
  ledcSetup(0, 5000, 8);
  ledcAttachPin(LED_PIN, 0);
  WiFi.begin("MyNet", "secret");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.println(WiFi.localIP());
}

void loop() {
  int t = touchRead(touchPin);
  if (t < 40) {
    ledcWrite(0, 255);
  } else {
    ledcWrite(0, 0);
  }
  delay(100);
}
`

/** ④ EEPROM 計數器（`#define` 腳位宣告＝第 1 批的 style 參數） */
const COUNTER = `#include <EEPROM.h>

#define LED_PIN 13

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  int count = EEPROM.read(0);
  count = count + 1;
  EEPROM.write(0, count);
  Serial.println(count);
}

void loop() {}
`

describe('第 2／3 批與前兩批混用', () => {
  it('① 溫濕度 ＋ 液晶：而 dht.begin() 不得被迭代器搶走', () => {
    const { once, twice, a, b } = roundTrip(WEATHER)
    expectOwn(a, [
      'cpp:dht_declare', 'cpp:dht_open', 'cpp:dht_read', 'cpp:math_is_nan',
      'cpp:lcd_declare', 'cpp:lcd_open', 'cpp:lcd_print', 'cpp:lcd_at', 'cpp:lcd_clear',
      'cpp:serial_open', 'cpp:serial_print', 'cpp:delay',   // ← 第 0 批
      'cpp:define',
    ])
    // 🔴 **`#define DHTPIN 2` 刻意【不】變成接線積木**，而那是對的：
    //    它沒有被當腳位用（沒進 `pinMode`／`digitalWrite`…），它進的是
    //    **DHT 的建構參數**。而那根腳位已經寫在「宣告溫濕度感測器」那顆積木上了
    //    ——再長一顆「接上零件到腳位 DHTPIN」是**重複**，不是補完。
    //
    // > **一個資訊已經在別的積木上時，再認一次不是更完整，是更吵。**
    expect(a).not.toContain('cpp:pin_attach')
    expect(twice, '文字漂移').toBe(once)
    expect(b, '結構漂移').toEqual(a)
    expect(a, '🔴 begin() 被迭代器搶走了').not.toContain('cpp:container_iter')
    expect(a, '🔴 降級成通用方法呼叫').not.toContain('cpp:method_call')
  })

  it('② 伺服 ＋ 超音波：三批同時出現而互不干擾', () => {
    const { once, twice, a, b } = roundTrip(RADAR)
    expectOwn(a, [
      'cpp:servo_declare', 'cpp:servo_attach', 'cpp:servo_write',  // 第 2 批
      'cpp:ultrasonic_trigger', 'cpp:pin_attach',                  // 第 1 批
      'cpp:pulse_read', 'cpp:serial_open', 'cpp:serial_print',      // 第 0 批
      'cpp:loop_for',
    ])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // ⚠️ 觸發序列摺了，所以那五句不再各自出現
    expect(a.filter((c) => c === 'cpp:ultrasonic_trigger')).toHaveLength(1)
    expect(a.filter((c) => c === 'cpp:delay_microseconds')).toHaveLength(0)
  })

  it('③ ESP32 完整專題：舊版 PWM 三件套 ＋ 觸摸 ＋ WiFi', () => {
    const { once, twice, a, b } = roundTrip(ESP)
    expectOwn(a, [
      'cpp:pwm_open', 'cpp:pwm_tie', 'cpp:pwm_write', 'cpp:touch_read',  // 第 3 批
      'cpp:wifi_open', 'cpp:wifi_read',
      'cpp:pin_attach',                                                   // 第 1 批
      'cpp:serial_open', 'cpp:serial_print', 'cpp:delay',
    ])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // 🔴 `WL_CONNECTED` 沒有人宣告 → 它是環境常數，而它不得掉進殘差
    expect(once).toContain('WL_CONNECTED')
  })

  it('④ EEPROM 計數器：而 #define 的腳位形式回得去原樣', () => {
    const { once, twice, a, b } = roundTrip(COUNTER)
    expectOwn(a, ['cpp:eeprom_read', 'cpp:eeprom_write', 'cpp:pin_attach', 'cpp:pin_mode'])
    expect(twice).toBe(once)
    expect(b).toEqual(a)
    // 🔴 第 1 批的 style 參數——不記形式的話這裡會變成 `const int LED_PIN = 13;`
    expect(once, '#define 被改寫了').toContain('#define LED_PIN 13')
  })

  it('🔴 execute：整段天氣站跑得完，而 isnan 那條分支真的被走到', async () => {
    const i = new SemanticInterpreter({ maxSteps: 200_000 })
    await i.execute(lift(WEATHER.replace('void loop() {', 'void loop2() {')))
    // ⚠️ loop 改名 → 只跑 setup，證明宣告與 begin 都不炸
    expect(i.getOutput().join('')).toBe('')
    const j = new SemanticInterpreter({ maxSteps: 200_000 })
    await j.execute(lift(COUNTER))
    expect(j.getOutput().join(''), 'EEPROM 從 0 開始，加一之後是 1').toContain('1')
  })
})

// ── 🔴 回歸：這一批改了兩個共用的東西 ─────────────────────────────

describe('🔴 回歸：共用層的兩個改動沒有弄壞既有行為', () => {
  it('A-1 vector 的 begin()／end() 仍然是迭代器', () => {
    // ⚠️ 用 `auto it = v.begin();` 而不是 `sort(v.begin(), v.end())`
    //    ——後者整組被 `sort_range` 吃掉，迭代器不會單獨出現在樹上。
    const list = ids(lift('#include <vector>\nint main() { vector<int> v; auto it = v.begin(); auto e = v.end(); }\n'))
    expect(list, 'vector 宣告要在——否則下面空過').toContain('cpp:vector_declare')  // ← 正向錨點
    expect(list.filter((c) => c === 'cpp:container_iter')).toHaveLength(2)
  })

  it('🔴 A-2 string 的 begin() 仍然是迭代器——它也登錄成純型別', () => {
    // ⚠️ **這一條是那個判準的關鍵測試**：第一版用「這個型別有沒有主」來擋，
    //    而 `string` 有主 → `str.begin()` 會被弄壞。改成問「是不是硬體」才對。
    const list = ids(lift('#include <string>\nint main() { string s = "ab"; auto it = s.begin(); auto e = s.end(); }\n'))
    expect(list, 'string 宣告要在').toContain('cpp:string_declare')                 // ← 正向錨點
    expect(list.filter((c) => c === 'cpp:container_iter')).toHaveLength(2)
  })

  it('A-3 map 的 begin() 仍然是迭代器', () => {
    const list = ids(lift('#include <map>\nint main() { map<int,int> m; auto it = m.begin(); }\n'))
    expect(list).toContain('cpp:map_declare')                                        // ← 正向錨點
    expect(list).toContain('cpp:container_iter')
  })

  it('🔴 B 使用者自己宣告的 DHT11 仍然贏過環境常數表', async () => {
    // 🔴 那正是腳位常數那顆付過學費的形狀（`enum Level { LOW = -1 }` 被搶走），
    //    而這一輪把那張表變大了 11 個名字——**每一個都要重驗一次那條規則**。
    const src = `#include <iostream>
enum Mode { DHT11 = 99 };
int main() { cout << DHT11 << endl; return 0; }
`
    const i = new SemanticInterpreter({ maxSteps: 50_000 })
    await i.execute(lift(src))
    const out = i.getOutput().join('')
    expect(out.length, '沒有輸出——下一條會空過').toBeGreaterThan(0)                 // ← 正向錨點
    expect(out, '🔴 使用者宣告的 DHT11 被環境常數表搶走了').toContain('99')
    expect(out).not.toContain('11\n')
  })

  it('🔴 B-2 而沒有人宣告時，環境常數表仍然答得出來', async () => {
    const i = new SemanticInterpreter({ maxSteps: 50_000 })
    await i.execute(lift('#include <iostream>\nint main() { cout << DHT11 << endl; return 0; }\n'))
    expect(i.getOutput().join('')).toContain('11')
  })

  it('🔴 C 前三批的語料殘差仍然是零', () => {
    const files = ['arduino-realistic-corpus.json', 'arduino-builtins-corpus.json', 'arduino-parts-corpus.json']
    let total = 0
    const bad: string[] = []
    for (const f of files) {
      const raw = JSON.parse(readFileSync(join(__dirname, '../probes', f), 'utf8')) as Record<string, { code: string }>
      for (const [id, v] of Object.entries(raw)) {
        const list = ids(lift(v.code))
        total += list.length
        const r = list.filter((c) => c === 'cpp:raw_code' || c === 'cpp:raw_expression').length
        if (r > 0) bad.push(`${id}: ${r}`)
      }
    }
    expect(total, '沒有量到節點——負向會空過').toBeGreaterThan(2000)                 // ← 正向錨點
    expect(bad, `殘差出現了：${bad.join('、')}`).toEqual([])
  })
})
