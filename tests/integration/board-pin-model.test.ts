/**
 * spec 145：**腳位的界由板子決定。**
 *
 * ## 🔴 US2 的測試寫在 US1 前面，而那不是形式
 *
 * 這一刀最可能的失敗是**把界拿掉就不會錯了**。而 `arduino-pins.ts` 的檔頭
 * 寫著那個界存在的理由：
 *
 * > 「`digitalWrite(999, HIGH)` 在真板子上什麼都不會發生，
 * > 而**那正是最難查的那種錯**。」
 *
 * 所以下面「越界仍然拋錯」那幾支先在**還沒有板子模型**的世界裡釘住它。
 * ⚠️ 它們第一次跑是綠的——靠 US1 那幾支當注入（實作前必須紅）。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果「合法腳位」那一支在執行根本沒跑起來時也通過，它證明的是
 * 「什麼都沒執行」，不是「腳位可用」。** 所以每一條前面都有正向錨點：
 * 先斷言那段程式**真的執行完並產出可觀察的結果**。
 */
import { describe, it, expect } from 'vitest'
import { requirePin, boardOf, UNO_BOARD, ESP32_BOARD } from '../../src/languages/cpp/core/runtime/arduino-pins'

describe('spec 145 · US2：🔴 越界仍然要出聲', () => {
  it('★ 錨點：合法的腳位【不】拋錯', () => {
    // 沒有這一條的話，「越界拋錯」也可能是因為它對什麼都拋錯
    expect(() => requirePin(13, UNO_BOARD)).not.toThrow()
    expect(requirePin(13, UNO_BOARD)).toBe(13)
  })

  it('🔴 任一板子，999 號腳位都拋錯', () => {
    for (const b of [UNO_BOARD, ESP32_BOARD]) {
      expect(() => requirePin(999, b), `${b.name} 沒擋住 999`).toThrow()
    }
  })

  it('🔴 負數與非數字也拋錯', () => {
    expect(() => requirePin(-1, UNO_BOARD)).toThrow()
    expect(() => requirePin(Number.NaN, UNO_BOARD)).toThrow()
  })

  it('🔴 訊息說得出是【哪一塊板子】，不是一個裸數字', () => {
    let msg = ''
    try { requirePin(999, ESP32_BOARD) } catch (e) { msg = (e as Error).message }
    expect(msg, `訊息裡沒有板子名稱：${msg}`).toContain(ESP32_BOARD.name)
  })
})

describe('spec 145 · US1：ESP32 的學生用得了他板子上的腳位', () => {
  it('🔴 ESP32 的 25 號腳位可用，而 Uno 的不可用', () => {
    expect(() => requirePin(25, ESP32_BOARD), 'ESP32 擋掉了它自己有的腳位').not.toThrow()
    expect(() => requirePin(25, UNO_BOARD), 'Uno 沒擋住它沒有的腳位').toThrow()
  })

  it('🔴 具名常數由板子提供——ESP32 沒有 `A0`', () => {
    expect(UNO_BOARD.constants.A0, 'Uno 的 A0 應該是 14').toBe(14)
    expect(ESP32_BOARD.constants.A0,
      'ESP32 給了一個 Uno 的 A0 值 → 那是「回錯的值」不是「查不到」').toBeUndefined()
  })

  it('★ 反向：兩塊板子共有的常數要一樣', () => {
    // 🔴 沒有這一條的話，「ESP32 沒有 A0」也可能是因為它的常數表整個是空的
    for (const k of ['HIGH', 'LOW', 'OUTPUT', 'INPUT'] as const) {
      expect(ESP32_BOARD.constants[k], `ESP32 少了共有的 ${k}`).toBe(UNO_BOARD.constants[k])
    }
  })

  it('★ 錨點：目標查得到自己的板子', () => {
    expect(boardOf({ id: 'esp32', board: ESP32_BOARD } as never)?.name).toBe(ESP32_BOARD.name)
    // ⚠️ 非硬體目標省略 board ＝ 沒有板子
    expect(boardOf({ id: 'cpp' } as never)).toBeUndefined()
  })
})
