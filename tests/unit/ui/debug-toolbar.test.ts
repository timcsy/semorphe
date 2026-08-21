/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DebugToolbar } from '../../../src/ui/debug-toolbar'

describe('DebugToolbar', () => {
  let toolbar: DebugToolbar

  beforeEach(() => {
    toolbar = new DebugToolbar()
  })

  afterEach(() => {
    toolbar.dispose()
  })

  it('should be hidden initially', () => {
    expect(toolbar.isVisible()).toBe(false)
  })

  it('should show in running mode', () => {
    toolbar.show('running')
    expect(toolbar.isVisible()).toBe(true)
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    expect(el).toBeTruthy()
    // In running mode: pause visible, continue hidden
    const pauseBtn = el.querySelector('.debug-pause') as HTMLElement
    const continueBtn = el.querySelector('.debug-continue') as HTMLElement
    expect(pauseBtn.style.display).toBe('flex')
    expect(continueBtn.style.display).toBe('none')
  })

  it('should show in paused mode with continue and step visible', () => {
    toolbar.show('paused')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const pauseBtn = el.querySelector('.debug-pause') as HTMLElement
    const continueBtn = el.querySelector('.debug-continue') as HTMLElement
    const stepBtn = el.querySelector('.debug-step') as HTMLElement
    expect(pauseBtn.style.display).toBe('none')
    expect(continueBtn.style.display).toBe('flex')
    expect(stepBtn.style.display).toBe('flex')
  })

  it('should show in stepping mode with continue and step visible', () => {
    toolbar.show('stepping')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const continueBtn = el.querySelector('.debug-continue') as HTMLElement
    const stepBtn = el.querySelector('.debug-step') as HTMLElement
    expect(continueBtn.style.display).toBe('flex')
    expect(stepBtn.style.display).toBe('flex')
  })

  it('should hide on hide()', () => {
    toolbar.show('running')
    expect(toolbar.isVisible()).toBe(true)
    toolbar.hide()
    expect(toolbar.isVisible()).toBe(false)
  })

  it('should switch mode with setMode()', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const pauseBtn = el.querySelector('.debug-pause') as HTMLElement
    const continueBtn = el.querySelector('.debug-continue') as HTMLElement

    toolbar.setMode('paused')
    expect(pauseBtn.style.display).toBe('none')
    expect(continueBtn.style.display).toBe('flex')

    toolbar.setMode('running')
    expect(pauseBtn.style.display).toBe('flex')
    expect(continueBtn.style.display).toBe('none')
  })

  it('should fire action on button click', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('paused')

    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const continueBtn = el.querySelector('.debug-continue') as HTMLElement
    const stepBtn = el.querySelector('.debug-step') as HTMLElement
    const stopBtn = el.querySelector('.debug-stop') as HTMLElement

    continueBtn.click()
    stepBtn.click()
    stopBtn.click()

    expect(actions).toEqual(['continue', 'step', 'stop'])
  })

  it('should fire pause action on pause button click', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('running')

    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const pauseBtn = el.querySelector('.debug-pause') as HTMLElement
    pauseBtn.click()

    expect(actions).toEqual(['pause'])
  })

  it('should have stop button always visible', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const stopBtn = el.querySelector('.debug-stop') as HTMLElement
    expect(stopBtn.style.display).not.toBe('none')

    toolbar.setMode('paused')
    expect(stopBtn.style.display).not.toBe('none')

    toolbar.setMode('stepping')
    expect(stopBtn.style.display).not.toBe('none')
  })

  // Step Out — visible when paused/stepping, hidden when running
  it('should have step-out button visible when paused/stepping, hidden when running', () => {
    toolbar.show('paused')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const stepOutBtn = el.querySelector('.debug-step-out') as HTMLElement
    expect(stepOutBtn).toBeTruthy()
    expect(stepOutBtn.style.display).toBe('flex')

    toolbar.setMode('running')
    expect(stepOutBtn.style.display).toBe('none')

    toolbar.setMode('stepping')
    expect(stepOutBtn.style.display).toBe('flex')
  })

  it('should fire step-out action on step-out button click', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('paused')

    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const stepOutBtn = el.querySelector('.debug-step-out') as HTMLElement
    stepOutBtn.click()

    expect(actions).toEqual(['step-out'])
  })

  it('should fire step-out on Shift+F10 when paused', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('paused')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }))

    expect(actions).toEqual(['step-out'])
  })

  // Accelerate (⏩) — always visible, fast-forwards past current block
  it('should have accelerate button always visible', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const accelBtn = el.querySelector('.debug-accelerate') as HTMLElement
    expect(accelBtn).toBeTruthy()
    expect(accelBtn.style.display).not.toBe('none')

    toolbar.setMode('paused')
    expect(accelBtn.style.display).not.toBe('none')

    toolbar.setMode('stepping')
    expect(accelBtn.style.display).not.toBe('none')
  })

  it('should fire accelerate action on accelerate button click', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('running')

    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const accelBtn = el.querySelector('.debug-accelerate') as HTMLElement
    accelBtn.click()

    expect(actions).toEqual(['accelerate'])
  })

  it('should fire accelerate on F11 when visible', () => {
    const actions: string[] = []
    toolbar.onAction((a) => actions.push(a))
    toolbar.show('running')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }))

    expect(actions).toEqual(['accelerate'])
  })

  // Accelerate level input
  it('should have accelerate level input defaulting to 1', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const levelInput = el.querySelector('.debug-accelerate-level') as HTMLInputElement
    expect(levelInput).toBeTruthy()
    expect(levelInput.type).toBe('number')
    expect(levelInput.value).toBe('1')
    expect(levelInput.min).toBe('1')
  })

  it('should return accelerate level from getAccelerateLevel()', () => {
    toolbar.show('running')
    expect(toolbar.getAccelerateLevel()).toBe(1)

    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const levelInput = el.querySelector('.debug-accelerate-level') as HTMLInputElement
    levelInput.value = '3'
    levelInput.dispatchEvent(new Event('input'))
    expect(toolbar.getAccelerateLevel()).toBe(3)
  })

  it('should clamp accelerate level to minimum 1', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const levelInput = el.querySelector('.debug-accelerate-level') as HTMLInputElement
    levelInput.value = '0'
    levelInput.dispatchEvent(new Event('input'))
    expect(toolbar.getAccelerateLevel()).toBe(1)
  })

  // Auto-scroll toggle
  it('should have auto-scroll toggle defaulting to off', () => {
    toolbar.show('running')
    expect(toolbar.isAutoScrollEnabled()).toBe(false)
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const toggleBtn = el.querySelector('.debug-auto-scroll') as HTMLButtonElement
    expect(toggleBtn).toBeTruthy()
  })

  it('should toggle auto-scroll on click', () => {
    toolbar.show('running')
    const el = document.querySelector('.debug-toolbar') as HTMLElement
    const toggleBtn = el.querySelector('.debug-auto-scroll') as HTMLButtonElement

    expect(toolbar.isAutoScrollEnabled()).toBe(false)
    toggleBtn.click()
    expect(toolbar.isAutoScrollEnabled()).toBe(true)
    toggleBtn.click()
    expect(toolbar.isAutoScrollEnabled()).toBe(false)
  })
})
