/**
 * **硬體分頁**（spec 184，重構階段 5c）——板子上的程式做了什麼。
 *
 * ```
 * 上半  每支用到的腳一條時間軸：亮（或 PWM 的高度）塗滿、暗空著；橫軸是模擬的毫秒
 * 下半  結束時的板子：每支腳的模式與值、伺服馬達的角度、LCD 上的字
 * ```
 *
 * 資料是 `core/hardware.ts` 的 `HardwareRecord`，來自 Cella 的判決——不另外執行一次。
 * ⚠️ 「沒有資料」有三種，畫面要分得開（P6）：不是板子的目標、判斷功能還沒好、這次沒有腳位變化。
 */
import type { HardwareRecord, PinChange } from '../../core/hardware'
import { msg } from '../../core/messages'

const ROW_H = 28
const LABEL_W = 64
const SVG_NS = 'http://www.w3.org/2000/svg'

export type HardwareView =
  | { kind: 'record'; record: HardwareRecord }
  | { kind: 'no-board' }
  | { kind: 'waiting'; reason: string }

export class HardwarePanel {
  private readonly root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    root.classList.add('hardware-panel')
    this.show({ kind: 'no-board' })
  }

  show(view: HardwareView): void {
    this.root.innerHTML = ''
    this.root.dataset.state = view.kind
    if (view.kind !== 'record') {
      this.note(view.kind === 'no-board'
        ? msg('HARDWARE_NO_BOARD', '這個目標沒有板子——換成 Arduino 或 ESP32 的目標，這裡會畫出每支腳怎麼變。')
        : view.reason)
      return
    }
    const { record } = view
    if (record.changes.length === 0) this.note(msg('HARDWARE_NO_CHANGES', '這次沒有任何腳位變化（忘了 pinMode 或 digitalWrite？）'))
    else this.root.appendChild(this.timeline(record))
    if (record.truncated) this.note(msg('HARDWARE_TRUNCATED', '腳位變化太多，只記下前 1000 筆——後面還有，沒有畫出來。'))
    if (record.end) this.root.appendChild(this.endState(record))
  }

  private note(text: string): void {
    const p = document.createElement('div')
    p.className = 'hardware-note'
    p.textContent = text
    this.root.appendChild(p)
  }

  /** 每支腳一列；值 0 是底線、非 0 塗滿到比例高度（數位 1 ＝滿、PWM 照 0–255）。 */
  private timeline(record: HardwareRecord): SVGSVGElement {
    const byPin = new Map<number, PinChange[]>()
    for (const c of record.changes) {
      const list = byPin.get(c.pin)
      if (list) list.push(c)
      else byPin.set(c.pin, [c])
    }
    const pins = [...byPin.keys()].sort((a, b) => a - b)
    const lastT = Math.max(...record.changes.map((c) => c.t))
    const endMs = Math.max(lastT, record.end ? record.end.clockUs / 1000 : 0, 1)
    const width = 640
    const plotW = width - LABEL_W - 8
    const x = (t: number): number => LABEL_W + (t / endMs) * plotW
    const height = pins.length * ROW_H + 22

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', 'hardware-timeline')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', msg('HARDWARE_TIMELINE', '腳位時間軸'))
    const el = (name: string, attrs: Record<string, string | number>, text?: string): SVGElement => {
      const e = document.createElementNS(SVG_NS, name)
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
      if (text !== undefined) e.textContent = text
      svg.appendChild(e)
      return e
    }

    pins.forEach((pin, row) => {
      const top = row * ROW_H + 4
      const base = top + ROW_H - 8
      el('text', { x: 4, y: base, class: 'hardware-pin-label' }, `${msg('HARDWARE_PIN', '腳')} ${pin}`)
      el('line', { x1: LABEL_W, y1: base, x2: width - 8, y2: base, class: 'hardware-axis' })
      const changes = byPin.get(pin)!
      changes.forEach((c, i) => {
        const until = i + 1 < changes.length ? changes[i + 1].t : endMs
        if (c.value === 0) return
        const level = c.value === 1 ? 1 : Math.min(c.value / 255, 1)
        const h = (ROW_H - 12) * level
        el('rect', { x: x(c.t), y: base - h, width: Math.max(x(until) - x(c.t), 1), height: h, class: 'hardware-high', 'data-pin': pin, 'data-t': c.t })
      })
    })

    // 時間刻度：每秒一格（太長就每五秒）
    const step = endMs > 10_000 ? 5000 : 1000
    for (let t = 0; t <= endMs; t += step) {
      el('line', { x1: x(t), y1: height - 18, x2: x(t), y2: height - 14, class: 'hardware-tick' })
      el('text', { x: x(t), y: height - 4, class: 'hardware-tick-label' }, `${t / 1000}s`)
    }
    return svg
  }

  private endState(record: HardwareRecord): HTMLElement {
    const end = record.end!
    const box = document.createElement('div')
    box.className = 'hardware-end'
    const head = document.createElement('div')
    head.className = 'hardware-end-head'
    head.textContent = `${msg('HARDWARE_END', '結束時')}（${(end.clockUs / 1000).toFixed(0)} ms，loop ${end.loops} ${msg('HARDWARE_LOOPS', '次')}）`
    box.appendChild(head)
    const line = (text: string): void => {
      const d = document.createElement('div')
      d.className = 'hardware-end-row'
      d.textContent = text
      box.appendChild(d)
    }
    for (const p of end.pins ?? []) {
      const value = p.toneHz ? `tone ${p.toneHz} Hz` : p.pwm !== null && p.pwm !== undefined ? `PWM ${p.pwm}` : p.level ? 'HIGH' : 'LOW'
      line(`${msg('HARDWARE_PIN', '腳')} ${p.pin}　${p.mode}　${value}`)
    }
    for (const s of end.servos ?? []) line(`${msg('HARDWARE_SERVO', '伺服')} ${s.name}（${msg('HARDWARE_PIN', '腳')} ${s.pin}）　${s.angle}°`)
    for (const l of end.lcds ?? []) line(`LCD ${l.name}　「${(l.lines ?? []).join('｜')}」`)
    return box
  }
}
