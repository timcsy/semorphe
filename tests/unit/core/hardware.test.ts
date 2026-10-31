/** 硬體紀錄與課文的腳位事件（spec 184）——資料是 `tests/probes/arduino-pins` 量到的閃燈。 */
import { describe, it, expect } from 'vitest'
import { hardwareOf, matchPinEvents } from '../../../src/core/hardware'

const BLINK = [
  { t: 1, pin: 13, value: 1 }, { t: 1001, pin: 13, value: 0 }, { t: 2002, pin: 13, value: 1 },
  { t: 3002, pin: 13, value: 0 }, { t: 4003, pin: 13, value: 1 }, { t: 5003, pin: 13, value: 0 },
]
const ENV = '{"clockUs":6003000,"loops":3,"pins":[{"pin":13,"mode":"OUTPUT","level":0,"pwm":null,"toneHz":null}],"servos":[],"lcds":[],"eeprom":[]}'

describe('硬體紀錄', () => {
  it('★ 判決 → 紀錄：env 是 JSON 字串也讀得懂', () => {
    const r = hardwareOf({ pins: BLINK, pinsTruncated: false, env: ENV })
    expect(r?.changes).toHaveLength(6)
    expect(r?.end?.pins[0]).toMatchObject({ pin: 13, mode: 'OUTPUT' })
  })
  it('★ 不是板子上的程式（沒有 pins）→ null', () => {
    expect(hardwareOf({})).toBeNull()
    expect(hardwareOf(null)).toBeNull()
  })
  it('🔴 env 讀不懂 → end 是 null，腳位照樣在（不丟例外）', () => {
    expect(hardwareOf({ pins: BLINK, env: '{壞的' })?.end).toBeNull()
  })
})

describe('腳位事件', () => {
  const blinkCheck = [{ pin: 13, value: 1, t: 0 }, { pin: 13, value: 0, t: 1000 }, { pin: 13, value: 1, t: 2000 }]
  it('★ 照課文的閃燈：誤差內，通過', () => {
    expect(matchPinEvents(blinkCheck, BLINK)).toEqual({ ok: true })
  })
  it('🔴 delay(500) 的版本：第二個事件時間對不上，說得出實際幾毫秒', () => {
    const half = [{ t: 1, pin: 13, value: 1 }, { t: 501, pin: 13, value: 0 }, { t: 1002, pin: 13, value: 1 }]
    expect(matchPinEvents(blinkCheck, half)).toMatchObject({ ok: false, index: 1, why: 'time', found: { t: 501 } })
  })
  it('🔴 忘了某個變化（燈一直亮）：missing', () => {
    expect(matchPinEvents(blinkCheck, [{ t: 1, pin: 13, value: 1 }])).toMatchObject({ ok: false, index: 1, why: 'missing', found: null })
  })
  it('★ 照順序：同一個變化不能被兩個事件共用', () => {
    expect(matchPinEvents([{ pin: 13, value: 1 }, { pin: 13, value: 1 }], [{ t: 1, pin: 13, value: 1 }])).toMatchObject({ ok: false, index: 1, why: 'missing' })
  })
  it('★ 不寫 t：只要求照順序發生', () => {
    expect(matchPinEvents([{ pin: 13, value: 1 }, { pin: 13, value: 0 }], BLINK)).toEqual({ ok: true })
  })
})
