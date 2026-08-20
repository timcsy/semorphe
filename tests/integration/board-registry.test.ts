/**
 * spec 147：**八塊板子，而每一個值都說得出來源。**
 *
 * ## 🔴 這一支存在的理由是【三個病歷】，不是覆蓋率
 *
 * ```
 * ① 憑印象填值      「ESP32 沒有 A0」——真相 A0 = 36
 * ② 用展開運算子推論  NANO_BOARD = { ...UNO_BOARD }，而 Nano 多了 A6／A7
 * ③ 護欄測副本       產品讀 targets/*.json，而護欄測 arduino-pins.ts 的 TS 常數
 * ```
 *
 * 所以下面每一條都對著**產品真的在讀的那份 JSON**，而且
 * **逐塊斷言、不從彼此推論**。
 *
 * ## ⚠️ 自我否證聲明
 *
 * 「每塊板子都有 `source`」如果在**板子清單是空的**時候也通過，
 * 它證明的是「沒有板子」不是「都有來源」——所以第一條先釘住數量。
 */
import { describe, it, expect } from 'vitest'
import type { BoardPinModel } from '../../src/core/types'
import { hasPin, describePins } from '../../src/languages/cpp/core/runtime/arduino-pins'

const modules = import.meta.glob('../../src/languages/cpp/targets/*.json', { eager: true }) as Record<
  string,
  { default: { id: string; provides?: string[]; board?: BoardPinModel } }
>
const targets = Object.values(modules).map((m) => m.default)
const boards = targets.filter((t) => t.board) as Array<{ id: string; provides?: string[]; board: BoardPinModel }>
const byId = (id: string) => boards.find((b) => b.id === id)!

/** 使用者 2026-08-19 說出他會教的板子——**這些一定要有**。 */
const MUST_HAVE = [
  'arduino-uno', 'arduino-nano', 'esp32', 'esp32c3',
  'esp32s3', 'esp32s3-cam', 'wemos-d1-mini', 'nodemcu-esp8266',
] as const

describe('spec 147 · US1：學生選得到自己手上那塊板子', () => {
  it('★ 錨點：八塊板子都在（否則下面每一條都在測空集合）', () => {
    for (const id of MUST_HAVE) {
      expect(byId(id), `少了板子：${id}`).toBeTruthy()
    }
    expect(boards.length).toBeGreaterThanOrEqual(MUST_HAVE.length)
  })

  it('🔴 每一塊板子都說得出資料抄自哪裡', () => {
    // > 一個沒附來源的事實主張，長出護欄之後就變成不可質疑的。
    for (const b of boards) {
      expect(b.board.source, `${b.id} 沒有 source`).toBeTruthy()
      expect(b.board.source.length, `${b.id} 的 source 太短，不足以查證`).toBeGreaterThan(20)
    }
  })

  it('🔴 同一個 `A0`，八塊板子不是同一個值', () => {
    const a0 = MUST_HAVE.map((id) => byId(id).board.constants.A0)
    expect(a0.every((v) => typeof v === 'number'), `有板子沒有 A0：${a0}`).toBe(true)
    // 14（Uno/Nano）· 36（ESP32）· 0（C3）· 1（S3×2）· 17（ESP8266×2）
    expect(new Set(a0).size, `A0 的相異值只有 ${new Set(a0).size} 個——多半是又從別塊推論了`)
      .toBeGreaterThanOrEqual(5)
  })

  it('🔴 每塊板子的 `A0` 都指向它自己真的有的腳位', () => {
    for (const b of boards) {
      const a0 = b.board.constants.A0
      if (typeof a0 !== 'number') continue
      expect(hasPin(b.board, a0), `${b.id} 的 A0=${a0} 不在它的腳位裡（${describePins(b.board)}）`).toBe(true)
    }
  })
})

describe('spec 147 · US2：🔴 一支這塊板子沒有的腳位要被擋下來', () => {
  it('★ 錨點：ESP32 的 32 號腳位【可用】', () => {
    expect(hasPin(byId('esp32').board, 32)).toBe(true)
  })

  it('🔴 ESP32 沒有 GPIO 20／24／28–31——用上界判定會讓它們靜靜地過', () => {
    for (const hole of [20, 24, 28, 29, 30, 31]) {
      expect(hasPin(byId('esp32').board, hole), `ESP32 收下了不存在的 GPIO ${hole}`).toBe(false)
    }
    // ★ 反向：而它的號碼確實到 39——所以上面不是「範圍太小」
    expect(hasPin(byId('esp32').board, 39)).toBe(true)
  })

  it('🔴 S3 沒有 GPIO 22–25，而它到 48', () => {
    for (const hole of [22, 23, 24, 25]) {
      expect(hasPin(byId('esp32s3').board, hole), `S3 收下了不存在的 GPIO ${hole}`).toBe(false)
    }
    expect(hasPin(byId('esp32s3').board, 48)).toBe(true)
  })
})

describe('spec 147 · 🔴 不從彼此推論', () => {
  it('🔴 Nano ≠ Uno——它多了 A6／A7，腳位到 21', () => {
    const uno = byId('arduino-uno').board
    const nano = byId('arduino-nano').board
    // `nano.build.variant=eightanaloginputs`（boards.txt）→ NUM_ANALOG_INPUTS 8
    expect(hasPin(nano, 21), 'Nano 少了 A7(21)——多半又是 { ...UNO_BOARD }').toBe(true)
    expect(hasPin(uno, 20), 'Uno 收下了它沒有的 A6(20)').toBe(false)
  })

  it('⚠️ 而 `A6`／`A7` 這兩個【名字】在 Uno 上存在——只是沒有那支腳', () => {
    // `variants/standard/pins_arduino.h` 定義 A0–A7，而 Uno 的 NUM_ANALOG_INPUTS 是 6。
    // 🔴 於是 Uno 上 `analogRead(A6)` 會說「腳位號碼 20 不在 Arduino Uno 上」
    //    ——那正是我們要的：**常數存在，腳位不存在**。
    expect(byId('arduino-uno').board.constants.A6).toBe(20)
    expect(hasPin(byId('arduino-uno').board, 20)).toBe(false)
  })

  it('🔴 ESP8266 帶的是另一套【命名體系】，不只是另一組值', () => {
    const d1 = byId('wemos-d1-mini').board
    expect(d1.constants.D1, 'D1 應該是 GPIO 5（不連續，不是 1）').toBe(5)
    expect(d1.constants.D0).toBe(16)
    expect(byId('arduino-uno').board.constants.D1, 'Uno 上不該有 D1 這個名字').toBeUndefined()
    expect(d1.constants.A0, 'ESP8266 只有一個類比輸入，A0 = 17').toBe(17)
    expect(d1.constants.A1, 'ESP8266 不該有 A1').toBeUndefined()
  })
})

describe('spec 147 · US3：能力逐塊查證', () => {
  it('🔴 C3 沒有觸控，而 S3 有', () => {
    // esp-idf `esp32c3/soc_caps.h` 完全沒有 SOC_TOUCH_SENSOR_*；
    // `esp32s3/soc_caps.h` 有 SOC_TOUCH_SENSOR_VERSION (2)
    expect(byId('esp32c3').provides, 'C3 宣告了它沒有的觸控').not.toContain('touch')
    expect(byId('esp32s3').provides).toContain('touch')
    // ★ 反向：C3 不是整個空的——它有 LEDC
    expect(byId('esp32c3').provides).toContain('ledc-pwm')
  })

  it('🔴 兩塊 ESP8266 沒有 ESP32 才有的能力——`ledcWrite`／`touchRead` 都是 ESP32 的 API', () => {
    // 🔄 **spec 150 改寫了這條的【判準】，而不是它的【意圖】。**
    //
    // 原文是 `toEqual([])`——「provides 必須是空的」。而那比意圖強：
    // 意圖是「**不得宣告 ESP32 才有的能力**」，
    // 而 ESP8266 **有它自己的能力**（WiFi 就是這兩塊板子的賣點）。
    //
    // > **一條把「今天剛好是空的」寫進判準的護欄，
    // > 會在集合第一次合理長大的時候擋住它。**
    //
    // ⚠️ 判準改成逐項點名，所以它**仍然會紅**：把 `ledc-pwm` 加進去就紅。
    for (const id of ['wemos-d1-mini', 'nodemcu-esp8266'] as const) {
      for (const esp32Only of ['ledc-pwm', 'touch'] as const) {
        expect(byId(id).provides, `${id} 宣告了 ESP32 才有的 ${esp32Only}`).not.toContain(esp32Only)
      }
    }
    // ★ 反向錨點：而它們【有】自己的能力——否則上面可能只是整個空的
    expect(byId('wemos-d1-mini').provides, 'ESP8266 板子少了它的賣點 WiFi').toContain('wifi')
  })
})

describe('spec 147 · 🔴 加了板子而忘了讓它出現在選單裡', () => {
  it('🔴 每一份板子 JSON 都要真的進得了目標登記表', async () => {
    // 🟢 順序是設計出來的（由簡到繁），所以那裡不用 `import.meta.glob`
    //    ——⚠️ 而手寫的清單會漏，這一條就是那個漏的偵測器。
    //
    // 🔴 **2026-08-20（spec 161）換了問法**：原本掃 `app.ts` 的**文字**
    // （`includes('targets/x.json')` ＋ `includes('xTargetDef as Target')`），
    // 而註冊搬進 `languages/cpp/pack.ts` 之後那兩行**當場失效**。
    //
    // > **一條靠檔案文字判斷的護欄，在那段程式碼搬家的那天會說錯話**
    // > ——而它說的是「板子沒註冊」，聽起來像是我弄丟了板子。
    //
    // 🟢 正解與 `component-rename` 第 6 步同一條：**問登記表，不要拿名字的形狀做判斷**。
    // 換完之後這條護欄**不在乎註冊寫在哪個檔**，只在乎「拿不拿得到」。
    const { allLanguagePacks } = await import('../../src/core/language-packs')
    const { loadAllLanguagePacks } = await import('../../src/core/load-language-packs')
    loadAllLanguagePacks()
    const registered = new Set(allLanguagePacks().flatMap((p) => p.targets).map((t) => t.id))
    expect(registered.size, '登記表整個空的 → 是載入壞了，不是板子沒了').toBeGreaterThan(5)
    for (const b of boards) {
      expect(registered.has(b.id), `板子 ${b.id} 有 JSON 但沒有人註冊它`).toBe(true)
    }
  })
})

function camel(id: string): string {
  return id.replace(/-(.)/g, (_, c: string) => c.toUpperCase())
}

describe('spec 147 · 🔴 非硬體目標一個字都不能變', () => {
  it('🔴 `cpp`／`c`／競程沒有板子', () => {
    for (const id of ['cpp', 'c', 'cpp-competitive'] as const) {
      const t = targets.find((x) => x.id === id)
      expect(t, `找不到目標 ${id}`).toBeTruthy()
      expect(t!.board, `${id} 長出了一塊板子`).toBeUndefined()
    }
  })
})
