import type { Scope } from '../interpreter/scope'
import { valueToString } from '../interpreter/types'

export class VariablePanel {
  private element: HTMLElement
  private contentEl: HTMLElement
  private tableBody: HTMLElement
  private toggleEl: HTMLElement
  private previousValues = new Map<string, string>()
  private collapsed = true

  constructor(container: HTMLElement) {
    this.element = container

    // Clickable header to toggle collapse
    const header = document.createElement('div')
    header.className = 'variable-panel-header'
    header.addEventListener('click', () => this.toggle())

    this.toggleEl = document.createElement('span')
    this.toggleEl.className = 'panel-toggle'
    this.toggleEl.textContent = '▶'

    const title = document.createElement('span')
    title.className = 'variable-panel-title'
    title.textContent = '變數監看'

    header.appendChild(this.toggleEl)
    header.appendChild(title)
    this.element.appendChild(header)

    // Collapsible content
    this.contentEl = document.createElement('div')
    this.contentEl.className = 'variable-panel-content'
    this.contentEl.style.display = 'none'

    // Table header
    const tableHeader = document.createElement('div')
    tableHeader.className = 'variable-table-header'
    for (const label of ['名稱', '型別', '值']) {
      const cell = document.createElement('span')
      cell.className = 'variable-header-cell'
      cell.textContent = label
      tableHeader.appendChild(cell)
    }
    this.contentEl.appendChild(tableHeader)

    // Table body
    this.tableBody = document.createElement('div')
    this.tableBody.className = 'variable-table'
    this.contentEl.appendChild(this.tableBody)
    this.element.appendChild(this.contentEl)
  }

  private toggle(): void {
    this.collapsed = !this.collapsed
    this.contentEl.style.display = this.collapsed ? 'none' : 'block'
    this.toggleEl.textContent = this.collapsed ? '▶' : '▼'
  }

  /** Expand the panel (called automatically when variables are updated during stepping) */
  expand(): void {
    if (this.collapsed) {
      this.collapsed = false
      this.contentEl.style.display = 'block'
      this.toggleEl.textContent = '▼'
    }
  }

  update(scope: Scope): void {
    const allVars = scope.getAll()
    this.renderVariables(
      Array.from(allVars).map(([name, val]) => ({
        name,
        type: val.type,
        value: valueToString(val),
      }))
    )
  }

  updateFromSnapshot(snapshot: { name: string; type: string; value: string }[]): void {
    this.expand()
    this.renderVariables(snapshot)
  }

  private renderVariables(vars: { name: string; type: string; value: string }[]): void {
    this.tableBody.innerHTML = ''

    for (const { name, type, value } of vars) {
      const prevValue = this.previousValues.get(name)
      const changed = prevValue !== undefined && prevValue !== value

      const row = document.createElement('div')
      row.className = 'variable-row'
      if (changed) row.classList.add('value-changed')

      const nameCell = document.createElement('span')
      nameCell.className = 'variable-cell variable-name'
      nameCell.textContent = name

      const typeCell = document.createElement('span')
      typeCell.className = 'variable-cell variable-type'
      typeCell.textContent = type

      const valueCell = document.createElement('span')
      valueCell.className = 'variable-cell variable-value'
      valueCell.textContent = value

      row.appendChild(nameCell)
      row.appendChild(typeCell)
      row.appendChild(valueCell)
      this.tableBody.appendChild(row)

      this.previousValues.set(name, value)
    }
  }

  clear(): void {
    this.tableBody.innerHTML = ''
    this.previousValues.clear()
  }

  getElement(): HTMLElement {
    return this.element
  }
}
