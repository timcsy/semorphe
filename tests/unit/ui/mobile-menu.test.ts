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

  it('should add selector mount', () => {
    const sel = document.createElement('select')
    menu.addSelectorMount('語言', sel)
    const items = menu.getElement().querySelectorAll('.mobile-menu-item')
    expect(items.length).toBe(1)
    expect(items[0].querySelector('label')?.textContent).toBe('語言')
    expect(items[0].contains(sel)).toBe(true)
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
