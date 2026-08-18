/**
 * 第 2 批套件物件的自證測（十九顆寫在一起，因為**它們共用同一個辨識機制**）。
 *
 * ## 🔴 這一批的核心是：**型別是宣告出來的，不是猜的**
 *
 * ```
 * Servo myServo;          →  作用域記住 myServo 的型別是 Servo
 * myServo.write(90);      →  查得到型別 → 專屬身分
 * something.write(90);    →  查不到型別 → 留在通用的方法呼叫（不猜）
 * ```
 *
 * ⚠️ 而**負向那一條才是重點**：一個「型別查不到就猜」的辨識器會把
 * 任何物件的 `.write()` 都變成伺服馬達。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const nodes = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) nodes(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => nodes(n).map((x) => x.conceptId)
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as StylePreset)
const rt = (src: string): { once: string; twice: string } => {
  const once = gen(lift(src))
  return { once, twice: gen(lift(once)) }
}

const SERVO = `#include <Servo.h>
Servo myServo;
void setup() {
  myServo.attach(9);
}
void loop() {
  myServo.write(90);
  int a = myServo.read();
  delay(500);
}
`
const DHT = `#include <DHT.h>
DHT dht(2, DHT11);
void setup() {
  Serial.begin(9600);
  dht.begin();
}
void loop() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  Serial.println(h);
  delay(2000);
}
`
const LCD = `#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello");
}
void loop() {
  lcd.setCursor(0, 1);
  lcd.print(millis());
  delay(1000);
}
`
const EEPROM_SK = `#include <EEPROM.h>
void setup() {
  Serial.begin(9600);
  EEPROM.write(0, 42);
  int v = EEPROM.read(0);
  Serial.println(v);
}
void loop() {}
`
const WIFI = `#include <WiFi.h>
void setup() {
  Serial.begin(9600);
  WiFi.begin("MyNet", "secret");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.println(WiFi.localIP());
}
void loop() {}
`

describe('第 2 批：套件物件（型別辨識）', () => {
  it('🔴 伺服：宣告 ＋ 三個方法都認得出來', () => {
    const list = ids(lift(SERVO))
    expect(list).toContain('cpp:servo_declare')   // ← 正向錨點
    expect(list).toContain('cpp:servo_attach')
    expect(list).toContain('cpp:servo_write')
    expect(list).toContain('cpp:servo_read')
    expect(list).not.toContain('cpp:raw_code')
    expect(list).not.toContain('cpp:method_call') // 🔴 沒有降級成通用方法呼叫
  })

  it('🔴 溫濕度：而 dht.begin() 不得再被容器迭代器搶走', () => {
    const list = ids(lift(DHT))
    expect(list).toContain('cpp:dht_declare')     // ← 正向錨點
    expect(list).toContain('cpp:dht_open')
    // 🔴 這一條就是那個 bug 本身：`begin()` 零引數，而迭代器認的正是零引數的 begin
    expect(list).not.toContain('cpp:container_iter')
    // 濕度與溫度是同一顆的兩個參數
    const reads = nodes(lift(DHT)).filter((x) => x.conceptId === 'cpp:dht_read')
    expect(reads.map((r) => r.properties.quantity).sort()).toEqual(['humidity', 'temperature'])
  })

  it('液晶：宣告 ＋ 四個方法', () => {
    const list = ids(lift(LCD))
    expect(list).toContain('cpp:lcd_declare')     // ← 正向錨點
    expect(list).toContain('cpp:lcd_open')
    expect(list).toContain('cpp:lcd_print')
    expect(list).toContain('cpp:lcd_at')
    expect(list).not.toContain('cpp:raw_code')
  })

  it('內建記憶體與無線網路：全域單例綁 obj', () => {
    const e = ids(lift(EEPROM_SK))
    expect(e).toContain('cpp:eeprom_read')        // ← 正向錨點
    expect(e).toContain('cpp:eeprom_write')
    const w = ids(lift(WIFI))
    expect(w).toContain('cpp:wifi_open')
    const reads = nodes(lift(WIFI)).filter((x) => x.conceptId === 'cpp:wifi_read')
    expect(reads.map((r) => r.properties.quantity).sort()).toEqual(['address', 'status'])
  })

  it('🔴 型別查不到就【不猜】——別的物件的 .write() 不得變成伺服馬達', () => {
    const src = 'struct Thing { void write(int x); };\nvoid setup() { Thing t; t.write(90); }\nvoid loop() {}\n'
    const list = ids(lift(src))
    expect(list).toContain('cpp:method_call')     // ← 正向錨點：它被認成通用方法呼叫
    expect(list).not.toContain('cpp:servo_write')
  })

  it('🔴 而容器的 begin() 仍然是迭代器——不得為了修 dht 而改壞既有行為', () => {
    const src = '#include <vector>\nvoid setup() { vector<int> v; auto it = v.begin(); }\nvoid loop() {}\n'
    const list = ids(lift(src))
    expect(list).toContain('cpp:vector_declare')  // ← 正向錨點
    expect(list).toContain('cpp:container_iter')
  })

  it('generate ＋ round-trip —— 五段都不漂移', () => {
    for (const [name, src] of Object.entries({ SERVO, DHT, LCD, EEPROM_SK, WIFI })) {
      const { once, twice } = rt(src)
      expect(once.length, `${name}：產出是空的`).toBeGreaterThan(50)  // ← 正向錨點
      expect(twice, `${name} 漂移`).toBe(once)
    }
  })

  it('generate —— 產回原本的方法名', () => {
    const s = gen(lift(SERVO))
    expect(s).toContain('myServo.attach(9);')     // ← 正向錨點
    expect(s).toContain('myServo.write(90);')
    expect(s).toContain('myServo.read()')
    const d = gen(lift(DHT))
    expect(d).toContain('dht.readHumidity()')
    expect(d).toContain('dht.readTemperature()')
    expect(d).toContain('DHT dht(2, DHT11);')
  })

  it('🔴 execute ①：伺服的角度是【記住的】，read 回得到 write 寫進去的值', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(lift(`#include <Servo.h>
Servo myServo;
void setup() {
  myServo.attach(9);
  myServo.write(120);
  Serial.println(myServo.read());
}
void loop() {}
`))
    expect(i.getOutput().join('')).toContain('120')
  })

  it('🔴 execute ②：內建記憶體【完全模擬得了】——寫進去讀得回來', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(lift(EEPROM_SK))
    expect(i.getOutput().join('')).toContain('42')
  })

  it('🔴 execute ③：溫濕度回「不是數字」——而學生的 isnan 檢查會成功', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100_000 })
    await i.execute(lift(`#include <DHT.h>
DHT dht(2, DHT11);
void setup() {
  Serial.begin(9600);
  float h = dht.readHumidity();
  if (isnan(h)) {
    Serial.println("no sensor");
  } else {
    Serial.println(h);
  }
}
void loop() {}
`))
    // 🔴 那條檢查分支**真的被走到**——這就是「NaN 不是投降」的證據
    expect(i.getOutput().join('')).toContain('no sensor')
  })

  it('🔴 execute ④：無線網路回已連上，讓教學程式的等待迴圈跑得完', async () => {
    const i = new SemanticInterpreter({ maxSteps: 50_000 })
    await i.execute(lift(WIFI))
    // ⚠️ 沒卡在 while 裡，而且印得出位址——那是這個【取捨】的全部目的
    expect(i.getOutput().join('')).toContain('192.168.1.100')
  })
})
