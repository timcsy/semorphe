/**
 * @vitest-environment happy-dom
 *
 * 🔴 一格的頭，只有一支產生器（spec 170 · T008）。
 *
 * 2026-09-01 那天先把**樣式**收成一份，而**產生器仍然有五個**
 * ——長得一樣不等於是同一種東西。
 */
import { describe, it, expect } from 'vitest'
import { createPanelHead } from '../../../src/ui/layout/cell-head'

describe('createPanelHead', () => {
  it('框架住在 `.panel-head` 一個 class 上', () => {
    expect(createPanelHead().el.className).toBe('panel-head')
  })

  it('🔴 舊的 class 留著當【掛鉤】——而它排在框架之後', () => {
    // e2e 的選擇器、mountSlotPickers 的 `bar`、行動版的搬移都用它認人。
    const { el } = createPanelHead('flow-toolbar')
    expect(el.classList.contains('panel-head')).toBe(true)
    expect(el.classList.contains('flow-toolbar')).toBe(true)
  })

  it('🔴 名字的位子先留出來——動作接在它【後面】', () => {
    // 不留的話名字會被面板自己的東西擠到後面，而「名字在最左」是
    // 四格一致的那一項（SC-003）。
    const { el, actions } = createPanelHead()
    const name = document.createElement('button')
    el.insertBefore(name, el.firstChild)
    actions.appendChild(document.createElement('button'))
    expect(el.firstElementChild).toBe(name)
    expect(el.lastElementChild).toBe(actions)
  })

  it('動作的順序 ＝ 接上去的順序', () => {
    const { actions } = createPanelHead()
    for (const t of ['一', '二', '三']) {
      const b = document.createElement('button')
      b.textContent = t
      actions.appendChild(b)
    }
    expect([...actions.children].map((c) => c.textContent)).toEqual(['一', '二', '三'])
  })

  it('⚠️ 每一次都是新的一條——共用一個 DOM 節點會讓兩格互相搶', () => {
    expect(createPanelHead().el).not.toBe(createPanelHead().el)
  })
})
