import { describe, it, expect, beforeEach } from 'vitest'
import { VariablePanel } from '../../src/ui/panels/variable-panel'
import type { VariableEntry } from '../../src/ui/panels/variable-panel'

describe('VariablePanel', () => {
  let container: HTMLElement
  let panel: VariablePanel

  beforeEach(() => {
    container = document.createElement('div')
    panel = new VariablePanel(container)
  })

  it('should create panel element', () => {
    expect(container.classList.contains('variable-panel')).toBe(true)
    expect(container.querySelector('.variable-content')).toBeTruthy()
  })

  it('should display variables', () => {
    const vars: VariableEntry[] = [
      { name: 'x', type: 'int', value: '42' },
      { name: 'name', type: 'string', value: 'hello' },
    ]
    panel.update(vars)

    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
  })

  it('should show variable name, type, and value', () => {
    panel.update([{ name: 'x', type: 'int', value: '10' }])

    expect(container.querySelector('.var-name')?.textContent).toBe('x')
    expect(container.querySelector('.var-type')?.textContent).toBe('int')
    expect(container.querySelector('.var-value')?.textContent).toBe('10')
  })

  it('should detect value changes and add class', () => {
    panel.update([{ name: 'x', type: 'int', value: '1' }])
    panel.update([{ name: 'x', type: 'int', value: '2' }])

    const rows = container.querySelectorAll('tbody tr')
    expect(rows[0].classList.contains('var-changed')).toBe(true)
  })

  it('should clear all variables', () => {
    panel.update([{ name: 'x', type: 'int', value: '1' }])
    expect(container.querySelectorAll('tbody tr').length).toBe(1)

    panel.clear()
    // After clear, shows empty state with "No variables" row
    expect(container.querySelector('.var-empty')).toBeTruthy()
  })
})
