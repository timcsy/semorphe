/**
 * **第一百二十二條護欄：中鍵拖曳要推畫面，而不是拖走那顆積木。**
 *
 * ## 🔴 學生回饋（2026-09-10，附截圖）
 *
 * > 「就是有時候遇到這種其實蠻難滑的（積木），要不要設定按滑鼠中鍵
 * >  可以移動我看的地方然後不會動到積木」
 *
 * 那張截圖是一段 DFS：`陣列 p 的第 [ u ] 格 = v` 橫著長到出畫面。
 *
 * ⚠️ **Blockly 早就能拖背景平移**——而那張畫面上背景不存在：
 * 每一個像素都是積木。
 *
 * > **一個要求使用者先找到空白處的手勢，在畫面最滿的時候最沒有用
 * > ——而那正是他最需要平移的時候。**
 *
 * ## 這裡驗四件事，而每一件都對應一個真的會壞的地方
 *
 * ```
 * ① 中鍵拖 → 工作區捲動，且是【起點 ＋ 位移】   寫成逐格累加會在撞到邊界後漂
 * ② 中鍵的 pointerdown 不得傳下去               傳下去 Blockly 會開始拖那顆積木
 * ③ 左鍵完全不受影響                            接管左鍵 = 把積木變成拖不動
 * ④ 中鍵的預設行為擋掉                          Windows 自動捲動／X11 貼上／開新分頁
 * ```
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enableMiddleDragPan, PANNING_CLASS } from '../../../src/ui/panels/middle-drag-pan'

/** 一個會記帳的假工作區——刻意不造 Blockly。 */
function fakeViewport(): { scrollX: number; scrollY: number; scroll(x: number, y: number): void; calls: Array<[number, number]>; dragging: boolean; isDragging(): boolean } {
  return {
    scrollX: 100,
    scrollY: 200,
    calls: [] as Array<[number, number]>,
    dragging: false,
    isDragging(): boolean { return this.dragging },
    scroll(x: number, y: number): void { this.calls.push([x, y]); this.scrollX = x; this.scrollY = y },
  }
}

function down(el: HTMLElement, button: number, x: number, y: number): PointerEvent {
  const e = new PointerEvent('pointerdown', { button, clientX: x, clientY: y, pointerId: 7, bubbles: true, cancelable: true })
  el.dispatchEvent(e)
  return e
}
function move(x: number, y: number): void {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 7, bubbles: true }))
}
function up(): void {
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }))
}

describe('第一百二十二條護欄：中鍵推畫面', () => {
  let container: HTMLElement
  let off: () => void
  let ws: ReturnType<typeof fakeViewport>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    ws = fakeViewport()
    off = enableMiddleDragPan(container, () => ws)
  })
  afterEach(() => {
    off()
    container.remove()
  })

  it('① 中鍵拖曳 → 工作區捲動，而位移是【起點 ＋ 走了多遠】', () => {
    down(container, 1, 500, 400)
    move(520, 430)
    move(560, 390)
    // 🔴 兩次都以【按下時】的捲動量為基準，不是以上一次的結果為基準。
    expect(ws.calls).toEqual([[120, 230], [160, 190]])
  })

  it('① 之二：放開之後就不再跟著游標走', () => {
    down(container, 1, 500, 400)
    move(520, 430)
    up()
    move(900, 900)
    expect(ws.calls).toHaveLength(1)
  })

  it('② 中鍵的 pointerdown 不得傳下去——不然 Blockly 會開始拖那顆積木', () => {
    let sawIt = false
    // Blockly 的手勢綁在注入區裡面（冒泡上來），這裡用一顆子元素代表它。
    const child = document.createElement('div')
    container.appendChild(child)
    container.addEventListener('pointerdown', () => { sawIt = true })
    child.dispatchEvent(new PointerEvent('pointerdown', { button: 1, clientX: 1, clientY: 1, pointerId: 7, bubbles: true, cancelable: true }))
    expect(sawIt).toBe(false)
  })

  it('③ 左鍵完全不受影響——接管它等於把積木變成拖不動', () => {
    const e = down(container, 0, 500, 400)
    move(520, 430)
    expect(ws.calls).toEqual([])
    expect(e.defaultPrevented).toBe(false)
    expect(container.classList.contains(PANNING_CLASS)).toBe(false)
  })

  it('③ 之二：右鍵也不受影響——那是右鍵選單', () => {
    const e = down(container, 2, 500, 400)
    move(520, 430)
    expect(ws.calls).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })

  it('④ 中鍵的預設行為要擋掉——Windows 的自動捲動與 X11 的貼上都掛在它上面', () => {
    const e = down(container, 1, 500, 400)
    expect(e.defaultPrevented).toBe(true)
    const aux = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true })
    container.dispatchEvent(aux)
    expect(aux.defaultPrevented).toBe(true)
    const md = new MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true })
    container.dispatchEvent(md)
    expect(md.defaultPrevented).toBe(true)
  })

  it('🔴 工具箱的抽屜裡不接手——它是另一個工作區，而且自己會捲', () => {
    const flyout = document.createElement('div')
    flyout.className = 'blocklyFlyout'
    const inner = document.createElement('div')
    flyout.appendChild(inner)
    container.appendChild(flyout)
    inner.dispatchEvent(new PointerEvent('pointerdown', { button: 1, clientX: 500, clientY: 400, pointerId: 7, bubbles: true, cancelable: true }))
    move(520, 430)
    expect(ws.calls).toEqual([])
    expect(container.classList.contains(PANNING_CLASS)).toBe(false)
  })

  it('正在拖積木時不插隊——那是使用者的另一個手勢', () => {
    ws.dragging = true
    down(container, 1, 500, 400)
    move(520, 430)
    expect(ws.calls).toEqual([])
  })

  it('平移中容器帶著 is-middle-panning，放開就拿掉', () => {
    down(container, 1, 500, 400)
    expect(container.classList.contains(PANNING_CLASS)).toBe(true)
    up()
    expect(container.classList.contains(PANNING_CLASS)).toBe(false)
  })

  it('🔴 工作區換掉之後仍然指得到新的那一個——渲染器切換會 dispose 舊的', () => {
    const second = fakeViewport()
    off()
    let current = ws
    off = enableMiddleDragPan(container, () => current)
    current = second
    down(container, 1, 0, 0)
    move(10, 10)
    expect(second.calls).toEqual([[110, 210]])
    expect(ws.calls).toEqual([])
  })

  it('解除安裝之後一個事件都不接', () => {
    off()
    off = () => {}
    const e = down(container, 1, 500, 400)
    move(520, 430)
    expect(ws.calls).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })
})
