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
