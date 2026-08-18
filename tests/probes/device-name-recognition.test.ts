/**
 * 探針：**「從變數名認零件」這張表，在真實語料上認得出幾成？**
 *
 * ## 🔴 這是探針不是護欄——今天不知道目標值
 *
 * 命中率該是多少沒有人知道。⚠️ 而**它會退步**：語料加進來、詞根改動、
 * 有人為了讓某顆積木過而塞一個詞根進去，都會動到這個數字。
 * 所以它要被**量著**，而不是被**卡著**。
 *
 * ⚠️ 入口條件錨在「載入幾段語料」這個**合成量**——
 * 🔴 **不可錨在命中率**（那正是要觀察的東西，把它寫死等於停止觀察）。
 *
 * ## 判準：**寧可漏，不可錯**
 *
 * 認不出來 → 退回原始積木（`digitalWrite`），學生看到的是誠實的東西。
 * 認錯 → 學生看到「LED」而他接的是繼電器，**而他會照著那個標籤理解他的電路**。
 *
 * 所以這支探針量兩個數，⚠️ **而第二個比第一個重要**：
 *
 * ```
 * ① 命中率      有多少腳位變數被認出零件
 * ② 認錯清單    被認成 X 而實際上是 Y ——🔴 這一欄要是空的
 * ```
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deviceFromName, type DeviceKind } from '../../src/languages/cpp/core/runtime/device-names'

interface Sketch { board: string; topic: string; code: string }

function loadCorpus(): Sketch[] {
  const dir = join(__dirname)
  const files = ['arduino-wide-corpus.json', 'arduino-realistic-corpus.json', 'arduino-builtins-corpus.json']
  const out: Sketch[] = []
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, Sketch>
    out.push(...Object.values(raw))
  }
  return out
}

/**
 * 抽出**真的被當腳位用**的識別字。
 *
 * 🔴 判準是「它有沒有進到腳位函式的第一個引數」——**不是名字長得像不像**。
 * ⚠️ 一開始用名字形狀（`\w*[Pp]in\w*`）抓，撈到了 `i`／`brightness`／`freq`
 * 這些根本不是腳位的變數，而**命中率因此虛高**。
 */
const PIN_USE = /\b(?:pinMode|digitalWrite|digitalRead|analogRead|analogWrite|tone|noTone|pulseIn|attach|ledcAttachPin)\s*\(\s*([A-Za-z_]\w*)/g

function pinVarsOf(code: string): Set<string> {
  const out = new Set<string>()
  for (const m of code.matchAll(PIN_USE)) {
    const name = m[1]
    // 直接寫常數（`A0`／`HIGH`）不是變數名，認不認得出零件與這張表無關
    if (/^A\d+$/.test(name) || name === 'HIGH' || name === 'LOW') continue
    out.add(name)
  }
  return out
}

describe('探針：腳位變數名 → 零件的辨識率', () => {
  const corpus = loadCorpus()

  it('語料量到位（⚠️ 入口條件——這一條紅了代表語料掉了，不是辨識壞了）', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(90)
  })

  it('量出辨識率，並列出認不出來的（🔴 不設門檻——這是觀察不是把關）', () => {
    const all = new Set<string>()
    for (const s of corpus) for (const v of pinVarsOf(s.code)) all.add(v)

    // ⚠️ 正向錨點先釘住：語料真的有腳位變數，否則下面全部空過
    expect(all.size).toBeGreaterThan(50)

    const byKind = new Map<DeviceKind, string[]>()
    for (const name of all) {
      const kind = deviceFromName(name)
      const list = byKind.get(kind) ?? []
      list.push(name)
      byKind.set(kind, list)
    }
    const unknown = byKind.get('unknown') ?? []
    const rate = ((all.size - unknown.length) / all.size) * 100

    console.log(`\n零件辨識率：${(all.size - unknown.length)}/${all.size} = ${rate.toFixed(1)}%`)
    for (const [kind, names] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
      if (kind === 'unknown') continue
      console.log(`  ${kind.padEnd(18)} ${String(names.length).padStart(3)}　${names.slice(0, 6).join(' ')}`)
    }
    console.log(`  🔴 認不出來（→ 退回原始積木）  ${unknown.length}　${unknown.join(' ')}`)
  })

  it('🔴 已知的認錯：一個都不准有', () => {
    // ⚠️ 這一組是**人工判過的**——名字與它真正接的零件。
    //    認錯比認不出來嚴重：學生會照著錯的標籤理解他的電路。
    const truth: [string, DeviceKind][] = [
      ['ledPin', 'led'], ['LED_PIN', 'led'], ['redPin', 'led'], ['STATUS_LED', 'led'],
      ['buttonPin', 'button'], ['BUTTON_PIN', 'button'], ['btnPin', 'button'],
      ['buzzerPin', 'buzzer'], ['BUZZER_PIN', 'buzzer'], ['speakerPin', 'buzzer'],
      ['trigPin', 'ultrasonic_trig'], ['TRIG_PIN', 'ultrasonic_trig'],
      ['echoPin', 'ultrasonic_echo'], ['ECHO_PIN', 'ultrasonic_echo'],
      ['servoPin', 'servo'], ['SERVO_PIN', 'servo'],
      ['potPin', 'analog_sensor'], ['POT_PIN', 'analog_sensor'], ['ldrPin', 'analog_sensor'],
      ['relayPin', 'relay'], ['RELAY_PIN', 'relay'],
      // 🔴 探針 2026-08-18 當場抓到的：`alarm` 排在 `led` 前面，於是
      //    `alarmLed`（一顆警示【燈】）被判成蜂鳴器。歧義詞根已移除。
      ['alarmLed', 'led'], ['warnLed', 'led'], ['knobPin', 'analog_sensor'],
      // 🔴 這幾個是**該認不出來的**——名字裡真的沒有零件資訊
      ['ENA', 'unknown'], ['IN1', 'unknown'], ['GATE_R', 'unknown'],
    ]
    const wrong = truth
      .map(([name, want]) => ({ name, want, got: deviceFromName(name) }))
      .filter((r) => r.got !== r.want)
    expect(wrong, `認錯：${wrong.map((r) => `${r.name} → ${r.got}（該是 ${r.want}）`).join('、')}`).toEqual([])
  })
})
