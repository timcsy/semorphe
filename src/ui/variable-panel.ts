import type { Scope } from '../interpreter/scope'
import { valueToString } from '../interpreter/types'

export class VariablePanel {
  private element: HTMLElement
  private tableBody: HTMLElement
  private previousValues = new Map<string, string>()

  constructor(container: HTMLElement) {
    this.element = container

    const header = document.createElement('div')
    header.className = 'variable-panel-header'
    const title = document.createElement('span')
    title.className = 'variable-panel-title'
    title.textContent = 'Variables'
    header.appendChild(title)
    this.element.appendChild(header)

    // Table header
    const tableHeader = document.createElement('div')
    tableHeader.className = 'variable-table-header'
    for (const label of ['名稱', '型別', '值']) {
      const cell = document.createElement('span')
      cell.className = 'variable-header-cell'
      cell.textContent = label
      tableHeader.appendChild(cell)
    }
    this.element.appendChild(tableHeader)

    // Table body
    this.tableBody = document.createElement('div')
    this.tableBody.className = 'variable-table'
    this.element.appendChild(this.tableBody)
  }

  update(scope: Scope): void {
    const allVars = scope.getAll()
    this.tableBody.innerHTML = ''

    for (const [name, val] of allVars) {
      const valueStr = valueToString(val)
      const prevValue = this.previousValues.get(name)
      const changed = prevValue !== undefined && prevValue !== valueStr

      const row = document.createElement('div')
      row.className = 'variable-row'
      if (changed) row.classList.add('value-changed')

      const nameCell = document.createElement('span')
      nameCell.className = 'variable-cell'
      nameCell.textContent = name

      const typeCell = document.createElement('span')
      typeCell.className = 'variable-cell'
      typeCell.textContent = val.type

      const valueCell = document.createElement('span')
      valueCell.className = 'variable-cell variable-value'
      valueCell.textContent = valueStr

      row.appendChild(nameCell)
      row.appendChild(typeCell)
      row.appendChild(valueCell)
      this.tableBody.appendChild(row)

      this.previousValues.set(name, valueStr)
    }
  }

  updateFromSnapshot(snapshot: { name: string; type: string; value: string }[]): void {
    this.tableBody.innerHTML = ''

    for (const { name, type, value } of snapshot) {
      const prevValue = this.previousValues.get(name)
      const changed = prevValue !== undefined && prevValue !== value

      const row = document.createElement('div')
      row.className = 'variable-row'
      if (changed) row.classList.add('value-changed')

      const nameCell = document.createElement('span')
      nameCell.className = 'variable-cell'
      nameCell.textContent = name

      const typeCell = document.createElement('span')
      typeCell.className = 'variable-cell'
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
