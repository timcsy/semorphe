import { describe, it, expect, beforeEach } from 'vitest'
import { ConsolePanel } from '../../../src/ui/panels/console-panel'

describe('ConsolePanel', () => {
  let container: HTMLElement
  let panel: ConsolePanel

  beforeEach(() => {
    container = document.createElement('div')
    panel = new ConsolePanel(container)
  })

  it('should create panel structure', () => {
    expect(container.querySelector('.console-output')).toBeTruthy()
    expect(container.querySelector('.console-status')).toBeTruthy()
  })

  it('should log text and add console-line element', () => {
    panel.log('Hello')
    const lines = container.querySelectorAll('.console-line')
    expect(lines.length).toBe(1)
    expect(lines[0].textContent).toBe('Hello')
  })

  it('should log error with error class', () => {
    panel.error('Something failed')
    const lines = container.querySelectorAll('.console-error')
    expect(lines.length).toBe(1)
    expect(lines[0].textContent).toBe('Something failed')
  })

  it('should clear all output', () => {
    panel.log('Line 1')
    panel.log('Line 2')
    panel.clear()
    const lines = container.querySelectorAll('.console-line')
    expect(lines.length).toBe(0)
    expect(panel.getLines().length).toBe(0)
  })

  it('should set status text and class', () => {
    panel.setStatus('Running', 'running')
    const status = container.querySelector('.console-status') as HTMLElement
    expect(status.textContent).toBe('Running')
    expect(status.classList.contains('running')).toBe(true)
  })

  it('should track lines via getLines()', () => {
    panel.log('A')
    panel.log('B')
    panel.error('C')
    const lines = panel.getLines()
    expect(lines).toEqual(['A', 'B', '[ERROR] C'])
  })

  it('should show output up to a count', () => {
    panel.log('Line 1')
    panel.log('Line 2')
    panel.log('Line 3')
    panel.showOutputUpTo(2)
    const children = container.querySelectorAll('.console-line')
    expect((children[0] as HTMLElement).style.display).toBe('')
    expect((children[1] as HTMLElement).style.display).toBe('')
    expect((children[2] as HTMLElement).style.display).toBe('none')
  })

  it('should prompt input and resolve on submit', async () => {
    const promise = panel.promptInput('Enter value:')
    const input = container.querySelector('.console-inline-input') as HTMLInputElement
    expect(input).toBeTruthy()

    input.value = '42'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))

    const result = await promise
    expect(result).toBe('42')
    // Inline input line should be replaced with echo text
    expect(container.querySelector('.console-inline-input')).toBeNull()
  })

  it('should fire signal on Ctrl+C', () => {
    let signal = ''
    panel.onSignal((s) => { signal = s })
    // Ctrl+C on the output area (when no input is active)
    const outputEl = container.querySelector('.console-output') as HTMLElement
    outputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    expect(signal).toBe('SIGINT')
  })

  it('should fire SIGINT on Ctrl+C during input prompt', async () => {
    let signal = ''
    panel.onSignal((s) => { signal = s })
    panel.promptInput()
    const input = container.querySelector('.console-inline-input') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    expect(signal).toBe('SIGINT')
  })

  it('should submit EOF on Ctrl+D during input prompt', async () => {
    panel.onSignal(() => {})
    const promise = panel.promptInput()
    const input = container.querySelector('.console-inline-input') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }))
    const result = await promise
    expect(result).toBe('\x04')
  })

  it('should display ^C in console on Ctrl+C', () => {
    panel.onSignal(() => {})
    const outputEl = container.querySelector('.console-output') as HTMLElement
    outputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    const lines = container.querySelectorAll('.console-line')
    const lastLine = lines[lines.length - 1]
    expect(lastLine?.textContent).toBe('^C')
  })
})
