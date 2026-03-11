import { describe, it, expect, beforeEach } from 'vitest'
import { MobileTabBar } from '../../../src/ui/layout/mobile-tab-bar'

describe('MobileTabBar', () => {
  let container: HTMLElement
  let tabBar: MobileTabBar

  beforeEach(() => {
    container = document.createElement('div')
    tabBar = new MobileTabBar(container)
  })

  it('should render 3 tabs', () => {
    const tabs = container.querySelectorAll('.mobile-tab-item')
    expect(tabs.length).toBe(3)
  })

  it('should have blocks tab active by default', () => {
    expect(tabBar.getActiveTab()).toBe('blocks')
    const activeTab = container.querySelector('.mobile-tab-item.active')
    expect(activeTab).toBeTruthy()
    expect(activeTab?.getAttribute('data-tab')).toBe('blocks')
  })

  it('should switch active tab on click', () => {
    const codeTab = container.querySelector('[data-tab="code"]') as HTMLElement
    codeTab.click()
    expect(tabBar.getActiveTab()).toBe('code')
    expect(codeTab.classList.contains('active')).toBe(true)

    const blocksTab = container.querySelector('[data-tab="blocks"]') as HTMLElement
    expect(blocksTab.classList.contains('active')).toBe(false)
  })

  it('should call onTabChange callback', () => {
    const calls: string[] = []
    tabBar.onTabChange((tab) => calls.push(tab))

    const consoleTab = container.querySelector('[data-tab="console"]') as HTMLElement
    consoleTab.click()
    expect(calls).toEqual(['console'])
  })

  it('should not fire callback when clicking already active tab', () => {
    const calls: string[] = []
    tabBar.onTabChange((tab) => calls.push(tab))

    const blocksTab = container.querySelector('[data-tab="blocks"]') as HTMLElement
    blocksTab.click()
    expect(calls).toEqual([])
  })

  it('should show and hide badge', () => {
    tabBar.setBadge('code', true)
    const codeBadge = container.querySelector('[data-tab="code"] .mobile-tab-badge') as HTMLElement
    expect(codeBadge.style.display).not.toBe('none')

    tabBar.setBadge('code', false)
    expect(codeBadge.style.display).toBe('none')
  })

  it('should clear badge when switching to that tab', () => {
    tabBar.setBadge('code', true)
    const codeTab = container.querySelector('[data-tab="code"]') as HTMLElement
    codeTab.click()
    const badge = container.querySelector('[data-tab="code"] .mobile-tab-badge') as HTMLElement
    expect(badge.style.display).toBe('none')
  })

  it('should have touch targets ≥44px height', () => {
    const el = tabBar.getElement()
    // The tab bar height is set to 48px in CSS; check the inline style
    expect(el.style.height).toBe('48px')
  })

  it('should set active tab programmatically', () => {
    tabBar.setActiveTab('console')
    expect(tabBar.getActiveTab()).toBe('console')
  })

  it('should return the container element', () => {
    expect(tabBar.getElement()).toBe(container.querySelector('.mobile-tab-bar'))
  })
})
