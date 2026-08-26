/**
 * **流程面板**（節點圖）——第三個投影。
 *
 * ⚠️ 它叫「流程」而不是「流程圖」，而那**不是簡稱**。使用者兩次澄清：
 *
 * > 「我要的比較像是 Node 然後有 Flow 可以接線可以呈現**資料流**的那種，
 * > 不是傳統意義上的『Flow Chart』。」
 * > 「因為是 **Flow-based**，而不是傳統的 Flow Chart。」
 *
 * 🔴 所以連檔名與 CSS 前綴都從 `flowchart` 改成 `flow`——
 * **一個叫 `flowchart-panel` 的檔案，會一直教下一個讀它的人做流程圖。**
 *
 * 形式的判準記在 `core/flow/node-graph.ts` 的檔頭；這裡只管**畫**與**互動**。
 *
 * ## 它為什麼可以存在而不必改任何人
 *
 * 它只做兩件事：實作 `ViewHost`、被 `registerViewsIn` 掃到。
 * 沒有一行 `app.ts` 認識它，沒有一個語言套件知道它在。
 *
 * ## 三份資料，三個來源，**沒有一份是這裡發明的**
 *
 * | 要什麼 | 問誰 |
 * |---|---|
 * | 哪個插槽是執行、哪個是資料 | 膠囊的 `children` 宣告（`slotsOf`） |
 * | 節點的顏色 | `blockSpecRegistry` 的 `blockDef.colour`——**同一張表**，不是抄一份色票 |
 * | 節點在程式碼裡是哪一行 | `mappings` ＋ `code`（滑鼠停留時顯示） |
 *
 * 🔴 顏色那一列是使用者當面點的：「**沿用積木的顏色語彙**」。
 *
 * ## 手拖的位置住在這裡，而且只住在這裡
 *
 * `offsets` 是**面板的私有狀態**：不進語義樹、不進存檔。
 * 第五十七條護欄守著前半句：**改面板私有狀態之後，語義樹的雜湊不變**。
 *
 * > 使用者定的形式：「一開始就手拖 ＋ 記住，也可以**一鍵**自動排版」
 * > ——所以自動排版是一個**動作**，不是一個模式。
 */
import type { ViewHost, ViewConfig, SemanticUpdateEvent, ExecutionStateEvent, ExecutionAtNodeEvent, EditableSource } from '../../core/view-host'
import type { SemanticNode } from '../../core/types'
import type { CodeMapping } from '../../core/projection/code-generator'
import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import { buildNodeGraph, type NodeGraph, type GraphNode, type GraphPort } from '../../core/flow/node-graph'
import { labelSourceFromSpecs, collapseBlockMessage, type FlowLabelSource } from '../../core/flow/vocabulary'
import { bodySlotsOf } from '../../core/component/traits'
import { msg } from '../../core/messages'

/** ⚠️ 面板上的字走既有的訊息表——**沒有第二份文案** */

const SVG_NS = 'http://www.w3.org/2000/svg'
const PAD = 24
const HEADER_H = 26
const ROW_H = 20

interface Offset { dx: number; dy: number }

export class FlowPanel implements ViewHost {
  readonly viewId = 'flow'
  readonly viewType = 'node-graph'
  readonly capabilities = {
    // 🔴 **2026-08-26 起可以編輯**（路線圖「流程可編輯」(b) 改欄位）。
    //    ⚠️ 這一格不只是「能不能打字」——它讓這個視圖進得了
    //    `viewsWith('editable')`，也就是「以此為準」那份清單與同步協調器。
    editable: true,
    needsLanguageProjection: true,
    /** 🔴 `control_flow` 的第一個真正消費者——節點圖用它替執行接點分色 */
    consumedAnnotations: ['control_flow'],
    /** 流程（節點圖）＝**誰跟誰有關**——`concepts/理解的層次.md` */
    layer: 'relation' as const,
  }

  private container: HTMLElement
  private specs?: BlockSpecRegistry

  private tree: SemanticNode | null = null
  private code = ''
  private mappings: CodeMapping[] = []
  /** 使用者手拖的位移——**面板私有**，不回寫真實 */
  private offsets = new Map<string, Offset>()
  private graph: NodeGraph | null = null
  /** 粒度：`null` ＝ 整份程式；否則是某顆節點的 id */
  private scopeId: string | null = null
  private highlighted: string | null = null

  private svg!: SVGSVGElement
  private scopeSelect!: HTMLSelectElement
  private empty!: HTMLElement
  private autoBtn!: HTMLButtonElement

  constructor(container: HTMLElement, specs?: BlockSpecRegistry) {
    this.container = container
    this.specs = specs
    this.buildChrome()
  }

  async initialize(_config: ViewConfig): Promise<void> {}

  dispose(): void {
    this.container.innerHTML = ''
  }

  /**
   * **契約那一支**（`ViewHost.readSource`）——流程這一側交的是**樹**（與積木同側）。
   *
   * ⚠️ 交的是**這個面板手上那一棵**（`onSemanticUpdate` 收到、`editField` 改過的）。
   * 沒有樹時回 `null`——**而不是一棵空的**：一棵空樹會把使用者的程式清掉。
   */
  readSource(): EditableSource | null {
    return this.tree ? { kind: 'tree', tree: this.tree } : null
  }

  /** 有人在這個面板上改了一格。宿主把它接到匯流排（面板不認識同步）。 */
  onEdit(cb: ((tree: SemanticNode) => void) | null): void {
    this.editCb = cb
  }

  private editCb: ((tree: SemanticNode) => void) | null = null

  /**
   * **改一格的值**——(b) 改欄位。
   *
   * 🔴 **就地改那棵樹，然後整棵送出去**。不做「差異」，理由是
   * `concepts/投影.md` 的那條：**真實只有一個，投影各自重畫**
   * ——送一棵完整的樹，收件端不必知道流程面板改了哪裡。
   *
   * ⚠️ 值是**原始值**不是顯示文字：畫面上顯示「到（不含）」而樹裡存 `FALSE`。
   * 這一支收的是**顯示文字對應回去的那個原始值**（呼叫端負責換回來）。
   */
  private editField(nodeId: string, key: string, rawValue: string): void {
    if (!this.tree) return
    const target = this.findNode(this.tree, nodeId)
    if (!target) return
    ;(target.properties as Record<string, unknown>)[key] = rawValue
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /**
   * **問一個新值**——頁內的輸入框，疊在那一格上。
   *
   * ⚠️ 不走 `window.prompt`：第七十七條護欄（原生對話框會凍住整個頁面，
   * 而自動化工具也一起凍住）。
   *
   * 🔴 **顯示文字要換回原始值**：畫面上是「到（不含）」而樹裡存 `FALSE`。
   * 沒有這一步的話，改一次欄位就會把 `FALSE` 換成「到（不含）」寫進真實，
   * 而**下一次投影就壞了**。
   */
  private promptField(nodeId: string, componentId: string, key: string, shownValue: string): void {
    const box = document.createElement('input')
    box.className = 'flow-field-input'
    box.value = shownValue
    const rect = this.container.getBoundingClientRect()
    const at = (this.svg.querySelector(`[data-node="${nodeId}"]`) as SVGGElement | null)?.getBoundingClientRect()
    box.style.left = `${(at?.left ?? rect.left) - rect.left + 8}px`
    box.style.top = `${(at?.top ?? rect.top) - rect.top + 8}px`
    const done = (commit: boolean): void => {
      const next = box.value
      box.remove()
      if (!commit || next === shownValue) return
      this.editField(nodeId, key, this.rawValueOf(componentId, key, next))
    }
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { done(true); e.preventDefault() }
      if (e.key === 'Escape') { done(false); e.preventDefault() }
    })
    box.addEventListener('blur', () => done(true))
    this.container.appendChild(box)
    box.focus()
    box.select()
  }

  /**
   * **顯示文字 → 原始值**。不是下拉的話原樣（使用者打什麼就是什麼）。
   *
   * 🔴 **選項的顯示文字本身可能是 `%{BKY_X}`**，所以比對之前要先展開
   * ——第一版直接比 `opt[0] === shown`，於是「到」比不到任何選項，
   * **把顯示文字原封不動寫進了真實**。抓到它的是這一支的第三個斷言。
   *
   * > **一個做「顯示 → 真實」的轉換，要與做「真實 → 顯示」的那一個走同一份表。**
   */
  private rawValueOf(componentId: string, key: string, shown: string): string {
    const spec = this.specs?.getByComponentId(componentId)
    const map = spec?.renderMapping?.fields ?? {}
    const fields = Object.entries(map).filter(([, prop]) => prop === key).map(([f]) => f)
    const args = spec?.blockDef?.args0
    if (Array.isArray(args)) {
      for (const a of args as Array<Record<string, unknown>>) {
        if (!(fields.length ? fields : [key]).includes(String(a.name)) || !Array.isArray(a.options)) continue
        for (const opt of a.options as Array<[string, string]>) {
          const label = /^%\{BKY_/.test(opt[0]) ? collapseBlockMessage(opt[0]) : opt[0]
          if (label === shown) return opt[1]
        }
      }
    }
    return shown
  }

  private findNode(n: SemanticNode, id: string): SemanticNode | null {
    if (n.id === id) return n
    for (const bucket of Object.values(n.children ?? {})) {
      for (const c of bucket ?? []) {
        const hit = this.findNode(c, id)
        if (hit) return hit
      }
    }
    return null
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    this.tree = event.tree
    if (typeof event.code === 'string') this.code = event.code
    if (event.mappings) this.mappings = event.mappings
    this.rebuild()
  }

  /** 明確地不接——執行狀態（Running／Paused）不改變圖長什麼樣 */
  onExecutionState(_event: ExecutionStateEvent): void {}

  /**
   * 執行走到某個節點。⚠️ 這裡**不移動鏡頭**——`follow` 的處理是「把鏡頭移過去」，
   * 而鏡頭這一刀還沒有。先亮起來：那是這個事件對這個視圖最小而誠實的投影。
   */
  onExecutionAtNode(event: ExecutionAtNodeEvent): void {
    this.highlighted = event.nodeId
    this.paint()
  }

  // ─── 私有 ──────────────────────────────────────────────────────────────

  private buildChrome(): void {
    this.container.classList.add('flow-panel')
    const bar = document.createElement('div')
    bar.className = 'flow-toolbar'

    this.scopeSelect = document.createElement('select')
    this.scopeSelect.className = 'flow-scope'
    this.scopeSelect.title = '要畫哪一段'
    this.scopeSelect.addEventListener('change', () => {
      this.scopeId = this.scopeSelect.value === '' ? null : this.scopeSelect.value
      this.rebuild()
    })

    const auto = document.createElement('button')
    this.autoBtn = auto
    auto.className = 'flow-btn'
    auto.title = '把手拖過的位置清掉，重新排一次'
    auto.addEventListener('click', () => {
      this.offsets.clear()
      this.paint()
    })

    bar.append(this.scopeSelect, auto)

    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.classList.add('flow-svg')

    this.empty = document.createElement('div')
    this.empty.className = 'flow-empty'

    this.container.append(bar, this.empty, this.svg)
  }

  /** 這顆節點對應程式碼的哪一行——滑鼠停留時顯示（找不到就不編一句話出來） */
  private codeLineOf(id: string): string | null {
    const m = this.mappings.find((x) => x.nodeId === id)
    if (!m) return null
    const line = this.code.split('\n')[m.startLine]
    return line && line.trim() ? line.trim() : null
  }

  private scopedRoot(): SemanticNode | null {
    if (!this.tree) return null
    return (this.scopeId ? findNode(this.tree, this.scopeId) : this.tree) ?? this.tree
  }

  private rootBody(): SemanticNode[] {
    const target = this.scopedRoot()
    if (!target) return []
    return bodySlotsOf(target.componentId).flatMap((s) => target.children[s] ?? [])
  }

  private rebuild(): void {
    this.syncLabels()
    this.syncScopeOptions()
    this.graph = buildNodeGraph(this.rootBody(), this.labelSource())
    // 拖曳位移只留給還在的節點——刪掉的節點不該留著一個看不見的位移
    const alive = new Set(this.graph.nodes.map((n) => n.id))
    for (const id of [...this.offsets.keys()]) if (!alive.has(id)) this.offsets.delete(id)
    this.paint()
  }

  /**
   * 🔴 **面板上的固定文字要跟著每次更新重設，不能只在建構時設一次。**
   *
   * 2026-08-26 開瀏覽器實測抓到的：切成 English 之後粒度選單變成 `Whole program`，
   * **而「⤢ 自動排版」還是中文**——因為 `<option>` 每次 `rebuild()` 都重建，
   * 而那顆按鈕的文字只在 `buildDom()` 設過一次。
   *
   * ⚠️ `git stash` 確認過**不是迴歸**：換訊息埠之前就是這樣。
   *
   * > **一段「只設一次」的介面文字，會在語言換掉的那天安靜地留在原地。**
   */
  private syncLabels(): void {
    this.autoBtn.textContent = `⤢ ${msg('FLOW_AUTOLAYOUT', '自動排版')}`
    this.empty.textContent = msg('FLOW_EMPTY', '還沒有可以畫的流程。')
  }

  /** 粒度選單：整份 ＋ 每一顆最外層有身體的節點（函式、類別、迴圈……） */
  private syncScopeOptions(): void {
    const opts: { value: string; text: string }[] = [{ value: '', text: msg('FLOW_SCOPE_ALL', '整份程式') }]
    if (this.tree) {
      for (const s of bodySlotsOf(this.tree.componentId)) {
        for (const child of this.tree.children[s] ?? []) {
          if (bodySlotsOf(child.componentId).length === 0) continue
          opts.push({ value: child.id, text: truncate(this.codeLineOf(child.id) ?? child.componentId, 28) })
        }
      }
    }
    const keep = this.scopeId
    this.scopeSelect.innerHTML = ''
    for (const o of opts) {
      const el = document.createElement('option')
      el.value = o.value
      el.textContent = o.text
      this.scopeSelect.appendChild(el)
    }
    // 選過的那一段不見了 → 退回整份（而不是留著一個指不到東西的選擇）
    this.scopeId = keep && opts.some((o) => o.value === keep) ? keep : null
    this.scopeSelect.value = this.scopeId ?? ''
  }

  private posOf(n: GraphNode): { x: number; y: number } {
    const o = this.offsets.get(n.id)
    return { x: n.x + PAD + (o?.dx ?? 0), y: n.y + PAD + (o?.dy ?? 0) }
  }

  private portAt(nodeId: string, portKey: string): { x: number; y: number; port: GraphPort } | null {
    const n = this.graph?.nodes.find((x) => x.id === nodeId)
    const p = n?.ports.find((x) => x.key === portKey)
    if (!n || !p) return null
    const at = this.posOf(n)
    return { x: at.x + p.dx, y: at.y + p.dy, port: p }
  }

  private paint(): void {
    const g = this.graph
    this.svg.innerHTML = ''
    const has = !!g && g.nodes.length > 0
    this.empty.style.display = has ? 'none' : ''
    this.svg.style.display = has ? '' : 'none'
    if (!g || !has) return

    let maxX = 0
    let maxY = 0
    for (const n of g.nodes) {
      const p = this.posOf(n)
      maxX = Math.max(maxX, p.x + n.w)
      maxY = Math.max(maxY, p.y + n.h)
    }
    this.svg.setAttribute('viewBox', `0 0 ${maxX + PAD} ${maxY + PAD}`)
    this.svg.setAttribute('width', String(maxX + PAD))
    this.svg.setAttribute('height', String(maxY + PAD))

    for (const w of g.wires) {
      const a = this.portAt(w.from.node, w.from.port)
      const b = this.portAt(w.to.node, w.to.port)
      if (!a || !b) continue
      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('class', `fc-wire fc-wire-${w.kind}`)
      // 貝茲：從出口往右、從入口往左——線的**方向**因此看得出來
      const dx = Math.max(36, Math.abs(b.x - a.x) * 0.5)
      path.setAttribute('d', `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`)
      this.svg.appendChild(path)
    }
    for (const n of g.nodes) this.svg.appendChild(this.renderNode(n))
  }

  private renderNode(n: GraphNode): SVGGElement {
    const at = this.posOf(n)
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', `fc-node${n.id === this.highlighted ? ' fc-on' : ''}`)
    g.setAttribute('transform', `translate(${at.x},${at.y})`)
    // 🔴 編輯框要疊在這一顆上面，所以它要找得到（2026-08-26）
    g.setAttribute('data-node', n.id)

    const body = document.createElementNS(SVG_NS, 'rect')
    body.setAttribute('class', 'fc-node-body')
    body.setAttribute('width', String(n.w))
    body.setAttribute('height', String(n.h))
    body.setAttribute('rx', '6')
    g.appendChild(body)

    const header = document.createElementNS(SVG_NS, 'path')
    header.setAttribute('class', 'fc-node-header')
    header.setAttribute('d', `M 0 6 A 6 6 0 0 1 6 0 H ${n.w - 6} A 6 6 0 0 1 ${n.w} 6 V ${HEADER_H} H 0 Z`)
    const colour = this.colourOf(n.componentId)
    if (colour) header.setAttribute('fill', colour)
    g.appendChild(header)

    // 🔴 **沒有標題就不畫標題**——而不是把身分印上去（第七十八條護欄）。
    if (n.title) g.appendChild(text('fc-node-title', n.w / 2, HEADER_H - 8, truncate(n.title, 20), 'middle'))

    let row = 0
    for (const p of n.ports) {
      if (p.kind === 'data' && p.side === 'in') {
        // ⚠️ 位置名沒設計過就**不顯示名字**——而那一列仍然佔位（接點還在那裡）。
        if (p.label) g.appendChild(text('fc-port-label', 10, p.dy + 4, truncate(p.label, 12), 'start'))
        row++
      }
    }
    for (const f of n.fields) {
      // 沒有位置名 → **只顯示值**（`FALSE` 那類已經在 core 換成顯示文字了）
      const shown = f.label ? `${f.label}：${f.value}` : f.value
      const y = HEADER_H + row * ROW_H + ROW_H / 2 + 4
      const el = text('fc-field fc-field-editable', 10, y, truncate(shown, 20), 'start')
      // 🔴 **(b) 改欄位**（2026-08-26）——雙擊那一格開一個輸入框。
      //    ⚠️ 用**雙擊**不是單擊：單擊與拖曳節點衝突（`attachDrag` 掛在同一個 `g` 上），
      //    而那個衝突的症狀是「想拖節點卻開了編輯框」。
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation()
        this.promptField(n.id, n.componentId, f.key, f.value)
      })
      g.appendChild(el)
      row++
    }
    for (const p of n.ports) {
      if (p.kind === 'exec' && p.side === 'out' && p.key !== '__next__') {
        if (p.label) g.appendChild(text('fc-port-label fc-port-exec-label', n.w - 10, p.dy + 4, truncate(p.label, 12), 'end'))
      }
      g.appendChild(this.renderPort(p))
    }

    const line = this.codeLineOf(n.id)
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent = line ? `${n.title}\n${line}` : n.title
    g.appendChild(title)

    this.attachDrag(g, n.id)
    return g
  }

  private renderPort(p: GraphPort): SVGElement {
    if (p.kind === 'exec') {
      // 執行接點畫成箭頭——**與資料接點的圓形一眼分得出來**
      const tri = document.createElementNS(SVG_NS, 'path')
      // 🔴 `control_flow` 在這裡被**真的消費**：迴圈的身體出口與分支的臂不同色。
      //    ⚠️ 只宣告 `consumedAnnotations` 而不讀，第十一條護欄會抓到
      //    ——而它抓到過一次，就是這一刀改寫時我把讀取拿掉的那次。
      tri.setAttribute('class', `fc-port fc-port-exec fc-port-${p.side}${p.flow ? ` fc-flow-${p.flow}` : ''}`)
      tri.setAttribute('d', `M ${p.dx - 5} ${p.dy - 6} L ${p.dx + 5} ${p.dy} L ${p.dx - 5} ${p.dy + 6} Z`)
      return tri
    }
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('class', `fc-port fc-port-data fc-port-${p.side}`)
    c.setAttribute('cx', String(p.dx))
    c.setAttribute('cy', String(p.dy))
    c.setAttribute('r', '4.5')
    return c
  }

  /**
   * **問積木那張表**的埠（`core/flow/vocabulary.ts` 的 `FlowLabelSource`）。
   *
   * 🔴 `core/flow` 不認識 `BlockSpecRegistry`——它只知道「有人回得出那句話」。
   * 這正是路線圖那條「面板只 import 協定」的 `appearance` 那一格：
   * ⚠️ 而查證發現**它本來就已經是注入的**（`import type` ＋ 建構子參數），
   * 這一刀只是把它**具名**成一個埠。
   */
  private labelSource(): FlowLabelSource {
    return labelSourceFromSpecs((id) => this.specs?.getByComponentId(id))
  }

  /** 顏色問**積木那張表**——不是這裡的一份色票 */
  private colourOf(componentId: string): string | null {
    const raw = this.specs?.getByComponentId(componentId)?.blockDef?.colour
    if (typeof raw === 'string' && raw.startsWith('#')) return raw
    const hue = Number(raw)
    return Number.isFinite(hue) ? `hsl(${hue}, 45%, 65%)` : null
  }

  private attachDrag(g: SVGGElement, id: string): void {
    g.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault()
      const start = { x: ev.clientX, y: ev.clientY }
      const base = this.offsets.get(id) ?? { dx: 0, dy: 0 }
      const move = (e: PointerEvent): void => {
        this.offsets.set(id, { dx: base.dx + (e.clientX - start.x), dy: base.dy + (e.clientY - start.y) })
        this.paint()
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }

  /** 測試用：面板私有狀態的**唯一**寫入口（護欄靠它證明「真的動過」） */
  moveNode(id: string, dx: number, dy: number): void {
    const base = this.offsets.get(id) ?? { dx: 0, dy: 0 }
    this.offsets.set(id, { dx: base.dx + dx, dy: base.dy + dy })
    this.paint()
  }

  /** 測試／驗收用：目前畫出來的節點（含手拖的位移） */
  boxPositions(): { id: string; x: number; y: number }[] {
    return (this.graph?.nodes ?? []).map((n) => ({ id: n.id, ...this.posOf(n) }))
  }
}

function text(cls: string, x: number, y: number, content: string, anchor: string): SVGTextElement {
  const t = document.createElementNS(SVG_NS, 'text')
  t.setAttribute('class', cls)
  t.setAttribute('x', String(x))
  t.setAttribute('y', String(y))
  t.setAttribute('text-anchor', anchor)
  t.textContent = content
  return t
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

function findNode(root: SemanticNode, id: string): SemanticNode | null {
  if (root.id === id) return root
  for (const kids of Object.values(root.children)) {
    for (const k of kids) {
      const hit = findNode(k, id)
      if (hit) return hit
    }
  }
  return null
}
