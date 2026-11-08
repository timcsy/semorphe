/**
 * @vitest-environment happy-dom
 */
/** 硬體分頁（spec 184）——三種「沒有資料」分得開；時間軸照判決的腳位變化畫。 */
import { describe, it, expect } from 'vitest'
import { HardwarePanel } from '../../../src/panels/hardware/view'
import { hardwareOf } from '../../../src/core/hardware'

const BLINK = { pins: [
  { t: 1, pin: 13, value: 1 }, { t: 1001, pin: 13, value: 0 }, { t: 2002, pin: 13, value: 1 },
  { t: 3002, pin: 13, value: 0 }, { t: 4003, pin: 13, value: 1 }, { t: 5003, pin: 13, value: 0 },
], pinsTruncated: false, env: '{"clockUs":6003000,"loops":3,"pins":[{"pin":13,"mode":"OUTPUT","level":0,"pwm":null,"toneHz":null}],"servos":[{"name":"arm","pin":9,"angle":90}],"lcds":[{"name":"lcd","lines":["Hi",""]}],"eeprom":[]}' }

describe('硬體分頁', () => {
  it('★ 閃燈：13 號腳一列、三段亮（每段從變亮到變暗）、結束時的狀態列得出來', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: hardwareOf(BLINK)! })
    expect(root.querySelectorAll('.hardware-pin-label')).toHaveLength(1)
    const highs = [...root.querySelectorAll('.hardware-high')].map((r) => Number(r.getAttribute('data-t')))
    expect(highs).toEqual([1, 2002, 4003])
    const end = root.querySelector('.hardware-end')!.textContent!
    expect(end).toMatch(/腳 13.*OUTPUT.*LOW/)
    expect(end).toMatch(/伺服 arm.*90°/)
    expect(end).toMatch(/LCD lcd.*Hi/)
  })

  it('🔴 三種「沒有資料」說的話不一樣（P6：不是一片空白）', () => {
    const root = document.createElement('div')
    const panel = new HardwarePanel(root)
    panel.show({ kind: 'no-board' })
    const noBoard = root.textContent
    panel.show({ kind: 'waiting', reason: '等 Cella' })
    const waiting = root.textContent
    panel.show({ kind: 'record', record: { changes: [], truncated: false, end: null } })
    const noChanges = root.textContent
    expect(new Set([noBoard, waiting, noChanges]).size).toBe(3)
    expect(noChanges).toMatch(/沒有任何腳位變化/)
  })

  it('★ 截斷：畫得出前面，並說後面還有', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: { ...hardwareOf(BLINK)!, truncated: true } })
    expect(root.textContent).toMatch(/1000/)
    expect(root.querySelectorAll('.hardware-high').length).toBeGreaterThan(0)
  })

  it('★ PWM：高度照工作週期（不是一律塗滿）', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: { changes: [{ t: 0, pin: 9, value: 128 }, { t: 500, pin: 9, value: 255 }], truncated: false, end: null } })
    const [half, full] = [...root.querySelectorAll('.hardware-high')].map((r) => Number(r.getAttribute('height')))
    expect(half).toBeLessThan(full)
  })

  it('★ 暫停中（spec 185）：畫板子當下的狀態；有 onSetInput 才畫改輸入，送出時交出 key／value', () => {
    const root = document.createElement('div')
    const panel = new HardwarePanel(root)
    const state = hardwareOf(BLINK)!.end!
    const got: [string, string][] = []
    panel.show({ kind: 'live', state, onSetInput: (k, v) => got.push([k, v]) })
    expect(root.textContent).toMatch(/暫停中（6003 ms）/)
    expect(root.textContent).toMatch(/腳 13.*OUTPUT.*LOW/)
    ;(root.querySelector('.hardware-input-value') as HTMLInputElement).value = '900'
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(got).toEqual([['analog:A0', '900']])
    panel.show({ kind: 'live', state })
    expect(root.querySelector('form'), '提供者不能改輸入 ⟹ 不畫那一列').toBeNull()
  })
})

// ── 停下時說出原因、標出還開著的輸出腳（使用者 11-07 的決定：「結束時沒說停的原因、沒提醒腳還開著」）──
describe('硬體分頁：停下的原因與還開著的腳', () => {
  const ON = { verdict: 'accept', problems: [], pins: [{ t: 1, pin: 13, value: 1 }], pinsTruncated: false,
    env: '{"clockUs":5050000,"loops":50,"pins":[{"pin":13,"mode":"OUTPUT","level":1,"pwm":null,"toneHz":null},{"pin":9,"mode":"OUTPUT","level":0,"pwm":128,"toneHz":null},{"pin":2,"mode":"INPUT","level":1,"pwm":null,"toneHz":null},{"pin":7,"mode":"OUTPUT","level":0,"pwm":null,"toneHz":null}],"servos":[],"lcds":[],"eeprom":[]}' }
  it('★ 正常跑完的模擬：說出「模擬到第 50 次 loop、5050 毫秒就停了，真的板子會一直跑下去」', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: hardwareOf(ON)! })
    expect(root.querySelector('.hardware-stop')!.textContent).toMatch(/50.*loop.*5050.*一直跑/)
  })
  it('★ 還開著的輸出腳：13（HIGH）與 9（PWM 128）被點名；輸入腳與已經 LOW 的不算', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: hardwareOf(ON)! })
    const still = root.querySelector('.hardware-still-on')!.textContent!
    expect(still).toMatch(/13.*HIGH/)
    expect(still).toMatch(/9.*PWM 128/)
    expect(still).not.toMatch(/腳 2|腳 7/)
  })
  it('★ 沒有還開著的腳：那一行不出現', () => {
    const root = document.createElement('div')
    new HardwarePanel(root).show({ kind: 'record', record: hardwareOf(BLINK)! })
    expect(root.querySelector('.hardware-still-on')).toBeNull()
  })
  it('🔴 步數用完、執行期出錯：原因各說各的', () => {
    const fuel = hardwareOf({ ...ON, verdict: 'unknown', problems: [{ kind: 'fuel' }] })!
    const ub = hardwareOf({ ...ON, verdict: 'reject', problems: [{ kind: 'ubBounds', reason: 'index 5 out of range' }] })!
    expect(fuel.stop.kind).toBe('fuel')
    expect(ub.stop).toEqual({ kind: 'error', detail: 'ubBounds' })
    const r1 = document.createElement('div'); new HardwarePanel(r1).show({ kind: 'record', record: fuel })
    const r2 = document.createElement('div'); new HardwarePanel(r2).show({ kind: 'record', record: ub })
    expect(r1.querySelector('.hardware-stop')!.textContent).not.toBe(r2.querySelector('.hardware-stop')!.textContent)
  })
})
