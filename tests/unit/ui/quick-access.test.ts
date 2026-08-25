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
    // ⚠️ `inPanel` ＝ 這個宿主自己畫哪幾顆——網頁版是全部（2026-08-25 起）
    bar = new QuickAccessBar(parent, { inPanel: () => true })
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

  it('🪦 檔案選單**不在這條列上**——它搬到標題右邊了（2026-08-25）', () => {
    // 使用者：「應該放在 Semorphe 右邊，像是一般視窗軟體那樣」。
    // ⚠️ 判準與「picker 移出去」同一條：**開檔存檔跟積木沒有關係**，
    //    而這條列是操作積木的地方。
    const el = bar.getElement()
    expect(el.querySelector('#file-menu-btn'), '🔴 又跑回來了').toBeNull()
    expect(el.querySelector('#export-btn')).toBeNull()
    // 正向錨點：而這條列真的建出來了（否則這一條會空過）
    expect(el.querySelector('#undo-btn')).not.toBeNull()
  })
})
