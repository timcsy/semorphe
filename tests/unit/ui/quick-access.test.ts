/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
import { describe, it, expect, beforeEach } from 'vitest'

import { QuickAccessBar } from '../../../src/ui/toolbar/quick-access-bar'

describe('QuickAccessBar (block toolbar)', () => {
  let parent: HTMLElement
  let bar: QuickAccessBar

  beforeEach(() => {
    parent = document.createElement('div')
    bar = new QuickAccessBar(parent, { fileButtons: true })
  })

  it('should create bar element', () => {
    expect(parent.querySelector('.quick-access-bar')).toBeTruthy()
  })

  it('同步是**一顆**入口，而不是每個方向一顆（2026-08-25）', () => {
    const el = bar.getElement()
    expect(el.querySelector('#sync-menu-btn'), '同步的入口不見了').toBeTruthy()
    // 🔴 方向按鈕退場：方向是 N²、來源只有 N（第六十二條護欄守著這條）
    expect(el.querySelector('#sync-blocks-btn'), '方向按鈕該退場了').toBeNull()
    expect(el.querySelector('#sync-code-btn')).toBeNull()
    expect(el.querySelector('#auto-sync-btn'), '暫停改由同步選單提供').toBeNull()
  })

  it('should contain level selector mount', () => {
    expect(bar.getElement().querySelector('#level-selector-mount')).toBeTruthy()
  })

  it('should contain block style selector mount', () => {
    expect(bar.getElement().querySelector('#block-style-selector-mount')).toBeTruthy()
  })

  it('should contain undo/redo/clear buttons', () => {
    const el = bar.getElement()
    expect(el.querySelector('#undo-btn')).toBeTruthy()
    expect(el.querySelector('#redo-btn')).toBeTruthy()
    expect(el.querySelector('#clear-btn')).toBeTruthy()
  })

  it('should contain file dropdown with export/import/upload', () => {
    const el = bar.getElement()
    expect(el.querySelector('#file-menu-btn')).toBeTruthy()
    expect(el.querySelector('#file-menu')).toBeTruthy()
    expect(el.querySelector('#export-btn')).toBeTruthy()
    expect(el.querySelector('#import-btn')).toBeTruthy()
    expect(el.querySelector('#upload-blocks-btn')).toBeTruthy()
  })

  it('should not contain style or locale selectors', () => {
    const el = bar.getElement()
    expect(el.querySelector('#style-selector-mount')).toBeNull()
    expect(el.querySelector('#locale-selector-mount')).toBeNull()
  })

  it('🔴 `fileButtons: false` → 檔案選單的 DOM【不存在】，不是藏起來', () => {
    // ⚠️ FR-006：在這個宿主裡沒有意義的控制項**不該出現**，
    //    而不是出現了按下去沒反應。
    //
    // > **一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟
    // > ——因為它讓「像」變成一個謊。**
    const el = document.createElement('div')
    new QuickAccessBar(el, { fileButtons: false })
    expect(el.querySelector('#file-menu-btn'), '🔴 不該建出來').toBeNull()
    expect(el.querySelector('#export-btn')).toBeNull()
    // 正向錨點：其餘的按鈕還在（否則這條可能是「整個都沒建」而空過）
    expect(el.querySelector('#undo-btn')).not.toBeNull()
  })
})
