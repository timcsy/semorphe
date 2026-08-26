import type { ViewHost, ViewCapabilities, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent } from '../../core/view-host'

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
    /** 變數＝**現在裡面裝了什麼**（與主控台同一層）——`concepts/理解的層次.md` */
    layer: 'state' as const,
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

  /**
   * ⚠️ 這裡原本是一個空樁，註解寫著「Handled via execution:state bus event」
   * ——真正的工作在 `connectBus` 裡。**契約在，而實作繞過它。**
   *
   * > **一個契約如果沒有人透過它呼叫，那些方法就只是註解。**
   *
   * 現在由視圖登錄表統一派送（`core/view-registry.ts` 的 `connectViews`）。
   */
  onExecutionState(event: ExecutionStateEvent): void {
    // 🔴 只有**暫停中**才改得動——而它要在畫快照【之前】更新，
    //    否則這一次的列還是照舊唯讀，使用者要等下一個事件才點得動。
    this.paused = event.status === 'paused'
    this.container.classList.toggle('paused', this.paused)
    const step = event.step
    if (step?.scopeSnapshot) {
      this.updateFromSnapshot(step.scopeSnapshot as VariableEntry[])
    }
  }

  /**
   * 有新的變數快照時通知——🔴 **給「變數在宿主那邊」的宿主用**。
   *
   * ⚠️ 它是**鏡射**不是搬家：面板那一格仍然自己畫，
   * 而建不建由 `controlSurfaces.inspector` 決定。
   */
  onSnapshot(cb: ((groups: ScopeGroup[]) => void) | null): void {
    this.snapshotCb = cb
  }

  private snapshotCb: ((groups: ScopeGroup[]) => void) | null = null

  /** ⚠️ 一律轉成分組的形狀送出去——**兩種形狀會讓收件端長出兩條路徑**。 */
  private emit(groups: ScopeGroup[]): void {
    this.snapshotCb?.(groups)
  }

  update(variables: VariableEntry[]): void {
    this.renderFlat(variables)
    this.emit([{ name: '', collapsed: false, variables }])
  }

  updateFromSnapshot(snapshot: { name: string; type: string; value: string }[]): void {
    this.renderFlat(snapshot)
    this.emit([{ name: '', collapsed: false, variables: snapshot }])
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
    this.emit(groups)
  }

  clear(): void {
    this.emit([])
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
      // 🔴 **暫停中才改得動**（2026-08-26）——「調整完狀態才能繼續」的那個「調整」。
      //    ⚠️ 跑到一半改變數會讓同一支程式跑兩次結果不同，
      //    而那正是 `concepts/模擬的誠實.md:23` 在擋的事。
      if (this.paused) this.makeValueEditable(row, v)
      tbody.appendChild(row)
    }
    table.appendChild(tbody)
    return table
  }

  /**
   * **把一列的「值」變成可以打字的**——只在暫停中。
   *
   * ⚠️ 它**不是** `capabilities.editable`。那一格問的是「這個視圖能不能當**真相來源**」
   * （`viewsWith('editable')` 就是「以此為準」那份清單），
   * 而改一個執行期變數**不動語義樹一個字**。
   *
   * > **兩件事叫同一個名字，第一個誤會會出現在那份清單上。**
   */
  private makeValueEditable(row: HTMLElement, v: VariableEntry): void {
    const cell = row.querySelector('.var-value') as HTMLElement | null
    if (!cell) return
    cell.classList.add('var-editable')
    cell.title = '暫停中——可以改這個值'
    cell.addEventListener('click', () => {
      if (cell.querySelector('input')) return
      const input = document.createElement('input')
      input.className = 'var-value-input'
      input.value = v.value
      const commit = (): void => {
        const next = input.value
        cell.textContent = next
        if (next !== v.value) this.editCb?.(v.name, next)
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { commit(); e.preventDefault() }
        if (e.key === 'Escape') { cell.textContent = v.value; e.preventDefault() }
      })
      input.addEventListener('blur', commit)
      cell.textContent = ''
      cell.appendChild(input)
      input.focus()
      input.select()
    })
  }

  /** 有人改了一個變數。**宿主把它接到匯流排上**——面板自己不認識執行器。 */
  onEditValue(cb: ((name: string, value: string) => void) | null): void {
    this.editCb = cb
  }

  private editCb: ((name: string, value: string) => void) | null = null
  private paused = false

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
