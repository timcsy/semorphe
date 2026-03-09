import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'
import type { SemanticBus } from '../../core/semantic-bus'

export interface VariableEntry {
  name: string
  type: string
  value: string
}

export interface ScopeGroup {
  name: string
  collapsed: boolean
  variables: VariableEntry[]
}

export class VariablePanel implements ViewHost {
  readonly viewId = 'variable-panel'
  readonly viewType = 'variable'
  readonly capabilities: ViewCapabilities = {
    editable: false,
    needsLanguageProjection: false,
    consumedAnnotations: [],
  }

  private container: HTMLElement
  private contentEl: HTMLElement
  private previousValues = new Map<string, string>()

  constructor(container: HTMLElement) {
    this.container = container
    this.container.classList.add('variable-panel')

    this.contentEl = document.createElement('div')
    this.contentEl.className = 'variable-content'
    this.container.appendChild(this.contentEl)
  }

  async initialize(_config: ViewConfig): Promise<void> {
    // ViewHost lifecycle — VariablePanel initializes in constructor
  }

  dispose(): void {
    this.clear()
  }

  onSemanticUpdate(_event: SemanticUpdateEvent): void {
    // VariablePanel doesn't handle semantic updates
  }

  onExecutionState(_event: ExecutionStateEvent): void {
    // Handled via execution:state bus event
  }

  connectBus(bus: SemanticBus): void {
    bus.on('execution:state', (data) => {
      const step = data.step
      if (step?.scopeSnapshot) {
        this.updateFromSnapshot(step.scopeSnapshot as VariableEntry[])
      }
    })
  }

  update(variables: VariableEntry[]): void {
    this.renderFlat(variables)
  }

  updateFromSnapshot(snapshot: { name: string; type: string; value: string }[]): void {
    this.renderFlat(snapshot)
  }

  updateWithScopes(groups: ScopeGroup[]): void {
    this.contentEl.innerHTML = ''

    for (const group of groups) {
      const groupEl = document.createElement('div')
      groupEl.className = `scope-group${group.collapsed ? ' collapsed' : ''}`

      const headerEl = document.createElement('div')
      headerEl.className = 'scope-group-header'
      headerEl.innerHTML = `<span class="scope-group-toggle">${group.collapsed ? '▶' : '▼'}</span> ${this.escapeHtml(group.name)}`
      headerEl.addEventListener('click', () => {
        groupEl.classList.toggle('collapsed')
        const toggle = headerEl.querySelector('.scope-group-toggle')
        if (toggle) toggle.textContent = groupEl.classList.contains('collapsed') ? '▶' : '▼'
      })
      groupEl.appendChild(headerEl)

      const bodyEl = document.createElement('div')
      bodyEl.className = 'scope-group-body'
      bodyEl.appendChild(this.buildTable(group.variables))
      groupEl.appendChild(bodyEl)

      this.contentEl.appendChild(groupEl)
    }

    this.updatePreviousValues(groups.flatMap(g => g.variables))
  }

  clear(): void {
    this.previousValues.clear()
    this.contentEl.innerHTML = ''
    this.renderEmpty()
  }

  getVariables(): VariableEntry[] {
    return []
  }

  getElement(): HTMLElement {
    return this.container
  }

  private renderFlat(variables: VariableEntry[]): void {
    this.contentEl.innerHTML = ''
    if (variables.length === 0) {
      this.renderEmpty()
      return
    }
    this.contentEl.appendChild(this.buildTable(variables))
    this.updatePreviousValues(variables)
  }

  private buildTable(variables: VariableEntry[]): HTMLElement {
    const table = document.createElement('table')
    table.className = 'variable-table'
    table.innerHTML = `
      <thead>
        <tr><th>Name</th><th>Type</th><th>Value</th></tr>
      </thead>
    `
    const tbody = document.createElement('tbody')
    for (const v of variables) {
      const changed = this.previousValues.has(v.name) && this.previousValues.get(v.name) !== v.value
      const row = document.createElement('tr')
      if (changed) row.className = 'var-changed'
      row.innerHTML = `
        <td class="var-name">${this.escapeHtml(v.name)}</td>
        <td class="var-type">${this.escapeHtml(v.type)}</td>
        <td class="var-value">${this.escapeHtml(v.value)}</td>
      `
      tbody.appendChild(row)
    }
    table.appendChild(tbody)
    return table
  }

  private renderEmpty(): void {
    const table = document.createElement('table')
    table.className = 'variable-table'
    table.innerHTML = `
      <thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead>
      <tbody><tr><td colspan="3" class="var-empty">No variables</td></tr></tbody>
    `
    this.contentEl.appendChild(table)
  }

  private updatePreviousValues(variables: VariableEntry[]): void {
    this.previousValues.clear()
    for (const v of variables) {
      this.previousValues.set(v.name, v.value)
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}
