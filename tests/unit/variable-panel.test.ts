/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { VariablePanel } from '../../src/panels/variables/view'
import type { VariableEntry } from '../../src/panels/variables/view'

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

/**
 * 暫停中改變數（2026-11-03 瀏覽器驗收抓到）：改一個值、按 Enter，執行結束時卻說「有 2 筆是你手動填進去的」。
 * 根因：Enter 送出之後把輸入框換掉，而輸入框離開畫面會觸發 blur → 同一筆再送一次。
 * 同一個機制讓 Esc（取消）也被 blur 送出去——取消變成了確認。
 */
describe('VariablePanel：暫停中改值，一次改動只送一次', () => {
  let container: HTMLElement
  let panel: VariablePanel
  let edits: [string, string][]
  const openEditor = (): HTMLInputElement => {
    document.body.appendChild(container)
    panel.onExecutionState({ status: 'paused', step: { scopeSnapshot: [{ name: 'total', type: 'int', value: '6' }] } } as never)
    ;(container.querySelector('.var-value') as HTMLElement).click()
    return container.querySelector('.var-value-input') as HTMLInputElement
  }
  beforeEach(() => {
    container = document.createElement('div')
    panel = new VariablePanel(container)
    edits = []
    panel.onEditValue((n, v) => edits.push([n, v]))
  })

  it('🔴 Enter：送一次（不因為輸入框被移走觸發的 blur 再送一次）', () => {
    const input = openEditor()
    input.value = '100'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    input.dispatchEvent(new FocusEvent('blur'))   // happy-dom 不會因為移除而自動觸發——模擬瀏覽器的行為
    expect(edits).toEqual([['total', '100']])
  })

  it('🔴 Esc：取消就是取消——之後的 blur 不得把新值送出去', () => {
    const input = openEditor()
    input.value = '100'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    input.dispatchEvent(new FocusEvent('blur'))
    expect(edits).toEqual([])
    expect(container.querySelector('.var-value')?.textContent).toBe('6')
  })

  it('★ 點別處（blur）：照舊送出', () => {
    const input = openEditor()
    input.value = '7'
    input.dispatchEvent(new FocusEvent('blur'))
    expect(edits).toEqual([['total', '7']])
  })
})

/** 新的一次執行開始時清掉上一支程式的變數（2026-11-03 瀏覽器驗收：在停下之前就出錯時，面板留著上一支的 total）。 */
describe('VariablePanel：新的一次執行清掉上一支的變數', () => {
  const snap = { status: 'paused', step: { scopeSnapshot: [{ name: 'total', type: 'int', value: '6' }] } }
  it('🔴 完成之後再開一次 → 清空', () => {
    const c = document.createElement('div'); const p = new VariablePanel(c)
    p.onExecutionState(snap as never)
    p.onExecutionState({ status: 'completed' } as never)
    expect(c.querySelectorAll('.var-name').length, '正向錨點：跑完之後上一次的變數還看得到').toBe(1)
    p.onExecutionState({ status: 'running' } as never)
    expect(c.querySelectorAll('.var-name').length).toBe(0)
  })
  it('★ 停著按繼續（running 緊接在 paused 之後）不清——那是同一次執行', () => {
    const c = document.createElement('div'); const p = new VariablePanel(c)
    p.onExecutionState(snap as never)
    p.onExecutionState({ status: 'running' } as never)
    expect(c.querySelectorAll('.var-name').length).toBe(1)
  })
  it('★ 等輸入、準備中（帶原因的 running）不清', () => {
    const c = document.createElement('div'); const p = new VariablePanel(c)
    p.onExecutionState(snap as never)
    p.onExecutionState({ status: 'completed' } as never)
    p.onExecutionState({ status: 'running', reason: 'awaiting-input' } as never)
    expect(c.querySelectorAll('.var-name').length).toBe(1)
  })
})
