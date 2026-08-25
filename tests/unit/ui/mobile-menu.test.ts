/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MobileMenu } from '../../../src/ui/toolbar/mobile-menu'

describe('MobileMenu', () => {
  let toolbar: HTMLElement
  let menu: MobileMenu

  beforeEach(() => {
    toolbar = document.createElement('div')
    menu = new MobileMenu(toolbar)
  })

  it('should create overlay element', () => {
    const overlay = toolbar.querySelector('.mobile-menu-overlay')
    expect(overlay).toBeTruthy()
  })

  it('should start closed', () => {
    expect(menu.isMenuOpen()).toBe(false)
    const overlay = menu.getElement()
    expect(overlay.style.display).toBe('none')
  })

  it('should open on toggle', () => {
    menu.toggle()
    expect(menu.isMenuOpen()).toBe(true)
    expect(menu.getElement().style.display).toBe('')
  })

  it('should close on second toggle', () => {
    menu.toggle()
    menu.toggle()
    expect(menu.isMenuOpen()).toBe(false)
    expect(menu.getElement().style.display).toBe('none')
  })

  it('should close explicitly', () => {
    menu.open()
    expect(menu.isMenuOpen()).toBe(true)
    menu.close()
    expect(menu.isMenuOpen()).toBe(false)
  })

  it('🪦 不再自己裝控制項——它只提供一格容器（2026-08-25）', () => {
    // > 行動版不是「桌機版縮小」，是同一份宣告的第三個渲染器。
    //
    // 內容由 `layout/status-bar-controls.ts` 的 `renderSheetControls`
    // 依 `ControlState` 畫——與狀態列讀同一份。
    const box = menu.getControlsContainer()
    expect(box.className).toBe('mobile-menu-controls')
    // 正向錨點：同一顆容器，不是每次都新建一個
    expect(menu.getControlsContainer()).toBe(box)
  })

  it('should set summary text', () => {
    menu.setSummary('C++ | cout | zelos')
    const summary = menu.getElement().querySelector('.mobile-menu-summary')
    expect(summary?.textContent).toBe('C++ | cout | zelos')
  })

  it('should update summary text', () => {
    menu.setSummary('first')
    menu.setSummary('second')
    const summaries = menu.getElement().querySelectorAll('.mobile-menu-summary')
    expect(summaries.length).toBe(1)
    expect(summaries[0].textContent).toBe('second')
  })

  it('should close on outside click', () => {
    menu.open()
    // Simulate click outside
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(menu.isMenuOpen()).toBe(false)
  })

  it('should clean up on destroy', () => {
    menu.destroy()
    expect(toolbar.querySelector('.mobile-menu-overlay')).toBeNull()
  })
})
