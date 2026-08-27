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
import { labelSourceFromSpecs, collapseBlockMessage, flowTitle, type FlowLabelSource } from '../../core/flow/vocabulary'
import { paletteFromToolbox, type PaletteItem } from '../../core/flow/palette'
import { presetTree, presetKey, presetSuffixKey } from '../../core/flow/presets'
import { walkWithPath, matchNodes, type KeyedNode } from '../../core/flow/layout-key'
import { tryConnect, tryReorder, refusalKeyOf, type RefusalReason } from '../../core/flow/connect'
import { bodySlotsOf } from '../../core/component/traits'
import { msg } from '../../core/messages'

/** ⚠️ 面板上的字走既有的訊息表——**沒有第二份文案** */

const SVG_NS = 'http://www.w3.org/2000/svg'
const PAD = 24
const HEADER_H = 26
const ROW_H = 20

/**
 * 一顆手放過的節點在哪裡——**絕對座標，不是相對自動排版的位移**。
 *
 * 🔴 它 2026-08-27 從 `{dx, dy}` 換過來，而換的理由是一次量測：
 * 手拖九顆、在程式碼末尾加一行之後，**只有七顆留在原地**——
 * 位移都被正確搬到新 id 上了，而**自動排版把其中兩顆的底座挪了**，
 * 於是「底座 ＋ 位移」算出來的位置跟著變。
 *
 * > **一個相對於「會自己動的東西」的座標，不是位置，是一個關係。
 * > 而使用者拖的時候心裡想的是位置。**
 *
 * ⚠️ 節點編輯器的慣例也是這個（React Flow／n8n／ComfyUI）：拖過的節點
 * 有絕對座標，而「自動排版」是一個**動作**，按下去覆蓋它們（那一條
 * 2026-08-24 就寫死了：「一鍵自動排版是一個【動作】，不是一個【模式】」）。
 */
interface Placed { x: number; y: number }

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
  private offsets = new Map<string, Placed>()
  private graph: NodeGraph | null = null
  /** 粒度：`null` ＝ 整份程式；否則是某顆節點的 id */
  private scopeId: string | null = null
  private highlighted: string | null = null

  private svg!: SVGSVGElement
  private scopeSelect!: HTMLSelectElement
  private empty!: HTMLElement
  private canvas!: HTMLElement
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
  /** 左邊那條**分類**（固定的，佔版面） */
  private toolboxEl!: HTMLElement
  /** 點了分類才彈出來的那一格（覆蓋在畫布上，拖出去就收） */
  private paletteEl!: HTMLElement
  /**
   * 收合分類條的那顆側邊鈕——**行動版才看得到**（CSS 管，見 `.flow-toolbox-collapse`）。
   *
   * 🪦 在此之前工具列上有一顆「＋ 積木盤／✕ 收起積木盤」。它 2026-08-27 退場：
   *
   * > 使用者逐字：「我想也不要有收起積木盤這個，
   * >  行動版的話仿照 Blockly 那邊的收合按鈕就好」。
   *
   * ⚠️ 桌機上分類條**不需要收**——它靠邊排版、96px、不蓋任何東西。
   * 一顆桌機上沒有理由按的按鈕，佔的是工具列最貴的那塊地方。
   * 而行動版**寬度真的不夠**，所以那裡需要，形狀照抄積木那側的
   * `.toolbox-collapse-btn`（`◀`／`▶` 貼在邊上）。
   */
  private paletteToggle!: HTMLButtonElement
  private paletteOpen = false
  private openCategory: string | null = null

  /** 收合**整條分類**。⚠️ 關著的時候完全不佔版面（`display: none`）。 */
  private setPaletteOpen(open: boolean): void {
    this.paletteOpen = open
    this.toolboxEl.style.display = open ? '' : 'none'
    if (!open) this.closeFlyout()
    this.paletteToggle.textContent = open ? '◀' : '▶'
    this.paletteToggle.setAttribute(
      'aria-label',
      open ? msg('FLOW_PALETTE_CLOSE', '收起積木盤') : msg('FLOW_PALETTE_OPEN', '積木盤'),
    )
  }

  /**
   * **點一個分類，彈出那一格的積木**——與 Blockly 的工具箱同一個形狀。
   *
   * ⚠️ 再點同一個就收起來（Blockly 也是這樣），而**不是**「只能開不能關」。
   */
  private toggleCategory(category: string): void {
    if (this.openCategory === category) { this.closeFlyout(); return }
    this.openCategory = category
    this.renderFlyout()
  }

  /**
   * 收起彈出的那一格。
   *
   * 🔴 **拖曳一開始就要收**，而那不是美觀問題：
   * 彈出格覆蓋在畫布上，不收的話使用者**看不到自己要放去哪裡**
   * ——那正是 2026-08-26 那次「拖不動」的成因（一塊浮層蓋住畫布左上角）。
   *
   * > **一個浮在畫布上的東西，在使用者需要看畫布的那一刻必須讓開。**
   */
  private closeFlyout(): void {
    this.openCategory = null
    this.renderFlyout()
  }

  private palette: PaletteItem[] = []

  /**
   * **宿主把工具箱的輸出交進來**——palette 照著它長。
   *
   * ⚠️ 收的是**輸出**不是登錄表：各自從登錄表算一次的話，
   * 同一份來源會長出兩份篩選與排序邏輯，而分岔的症狀是
   * 「工具箱有而 palette 沒有」——**沒有人會發現，因為兩邊都看起來對**。
   */
  setPalette(toolbox: unknown): void {
    this.palette = paletteFromToolbox(toolbox)
    this.renderPalette()
  }

  /**
   * 分類 → 那一格有哪些積木。⚠️ **保持工具箱的順序**，不重新排。
   *
   * ## 🔴 一個分類裡同一個身分只出現一次
   *
   * 工具箱是**積木**的清單，而流程視圖處理的是**元件身分**
   * （`createLoose` 只吃 `componentId`）。量出來的落差：
   *
   * ```
   * cpp:if            cpp_if ×3          工具箱用 extraState 列了三種變體
   * cpp:var_declare   語句形 ＋ 運算式形   同一個身分的兩個形態
   * cpp:input         語句形 ＋ 運算式形
   * ```
   *
   * 三顆「如果」擺在一起，而**按下去做的事一模一樣**。
   *
   * > **兩個看起來不同、做起來相同的選項，比一個選項更難用
   * > ——使用者會停下來想「差別在哪」，而答案是「沒有」。**
   *
   * ⚠️ **已知的損失**：`cpp_if` 那三種變體（有沒有 else／幾個 else if）
   * 因此**選不到**，只生得出最基本的那一顆。那是 `extraState` 的事，
   * 而流程視圖還沒有表達它的方式——**這是一個缺口，不是一個決定**。
   *
   * ## ⚠️ 而查不到身分的積木**不列**
   *
   * 拖它的第一行就是 `if (!cid) return`——**列出來只會是一顆按了沒反應的按鈕**。
   */
  private byCategory(): Map<string, PaletteItem[]> {
    const m = new Map<string, PaletteItem[]>()
    const seen = new Set<string>()
    for (const item of this.palette) {
      const cid = this.componentOf(item.blockType)
      if (!cid) continue
      // 🔴 **去重的鍵是「按下去會發生什麼」，不是「它是誰」**（2026-08-27 修正）。
      //    08-27 第一版用 `componentId`，於是三顆「如果」收成一顆
      //    ——而其中**一顆是真的不同**（else-if 的骨架）。見 `flow/presets.ts`。
      const key = `${item.category}\u0000${presetKey(item, cid)}`
      if (seen.has(key)) continue
      seen.add(key)
      const a = m.get(item.category) ?? []
      a.push(item)
      m.set(item.category, a)
    }
    return m
  }

  /**
   * **左邊那條分類**——一顆分類一個按鈕，前面一格它自己的顏色。
   *
   * 🔴 顏色問**那一格第一顆積木的定義**，不是這裡一份色票——
   * 與節點的顏色同一條路（`colourOf`）。
   */
  private renderPalette(): void {
    if (!this.toolboxEl) return
    this.toolboxEl.innerHTML = ''
    if (!this.capabilities.editable || this.palette.length === 0) {
      this.closeFlyout()
      return
    }
    // ⚠️ 重畫之後那顆開關的字要跟著現在的狀態——不然它會說「收起」而盤是關的。
    this.setPaletteOpen(this.paletteOpen)
    for (const [category, items] of this.byCategory()) {
      const btn = document.createElement('button')
      btn.className = 'flow-cat'
      btn.type = 'button'
      btn.dataset.category = category
      const swatch = document.createElement('span')
      swatch.className = 'flow-cat-swatch'
      const firstCid = this.componentOf(items[0].blockType)
      const colour = firstCid ? this.colourOf(firstCid) : null
      if (colour) swatch.style.background = colour
      btn.append(swatch, document.createTextNode(category))
      btn.addEventListener('click', () => this.toggleCategory(category))
      this.toolboxEl.appendChild(btn)
    }
    this.renderFlyout()
  }

  private componentOf(blockType: string): string | undefined {
    return this.specs?.getByBlockType?.(blockType)?.componentMapping?.componentId
  }

  /** 彈出的那一格：現在開著的分類裡有哪些積木。沒有開就是空的。 */
  private renderFlyout(): void {
    if (!this.paletteEl) return
    this.paletteEl.innerHTML = ''
    for (const btn of this.toolboxEl?.querySelectorAll('.flow-cat') ?? []) {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.category === this.openCategory)
    }
    if (!this.openCategory) { this.paletteEl.style.display = 'none'; return }
    this.paletteEl.style.display = ''
    for (const item of this.byCategory().get(this.openCategory) ?? []) {
      const chip = document.createElement('button')
      chip.className = 'flow-chip'
      chip.type = 'button'
      const cid = this.componentOf(item.blockType)
      const base = (cid ? flowTitle(cid, this.labelSource()) : null) ?? item.blockType
      const suffix = presetSuffixKey(item.extraState)
      chip.textContent = suffix ? `${base}${msg(suffix, '／否則如果')}` : base
      chip.title = item.category
      // 從 palette 拖到一個接點上——**與拉線同一條路**
      chip.addEventListener('pointerdown', (ev) => {
        ev.preventDefault()
        if (!cid) return
        // ⚠️ palette 壓在圖上是必然的（它是拖曳的起點）——
        //    而**繞過它的方法在 `portUnder` 裡**，不在這裡改它的狀態。
        //
        // 🔴 **這個手勢原本是隱形的**（2026-08-27，使用者：「節點從積木盤中拖不出來」）。
        //
        // ```
        // 拖的時候   沒有 pointermove → 【沒有線、沒有高亮】，畫面完全不動
        // 放開時     if (to) …        → 沒接到就【什麼都不說】
        // ```
        //
        // 而接點是半徑 6 的圓：多數人第一次都會放偏，然後看到**零反應**。
        //
        // > **一個沒有回饋的拖曳，與一個壞掉的拖曳，在使用者眼裡是同一件事。**
        //
        // 🟢 修法是兩半，缺一不可：拖的時候**看得見**（預覽線 ＋ 把能放的接點點亮），
        //    放偏的時候**說得出話**（`history/017`：會拒絕的東西要回答「被拒絕的去哪了」）。
        const from = { x: ev.clientX, y: ev.clientY }
        // 🔴 **拖曳一開始就把彈出格收起來**——不收的話它蓋著畫布，
        //    使用者看不到自己要放去哪裡（見 `closeFlyout` 的檔頭）。
        this.closeFlyout()
        this.setDropTargetsVisible(true)
        const move = (e: PointerEvent): void => this.paintWirePreview(e, from)
        const up = (e: PointerEvent): void => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          this.setDropTargetsVisible(false)
          this.clearWirePreview()
          const to = this.portUnder(e)
          // 🔴 **放在接點上＝直接接進去；放在空白處＝拉出來先不接**（2026-08-27）。
          //    在此之前空白處是「什麼都不生」，而那把手勢倒了過來——見 `createInto` 的墓碑。
          if (to) this.createInto(cid, to, item.extraState)
          else if (this.overCanvas(e)) {
            this.createLoose(cid, { x: e.clientX, y: e.clientY }, item.extraState)
          }
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      })
      this.paletteEl.appendChild(chip)
    }
  }

  /**
   * **從 palette 生一顆新節點，放進那一格**。
   *
   * 🪦 這裡本來寫著：
   *
   * > 「🔴 **沒有「浮在外面的節點」這種東西**：這張圖是一棵樹的投影，
   * >  而樹裡沒有無主的節點。所以新節點一定要落在某一格上
   * >  ——放不進去就**不生**（而不是生出來再說）。」
   *
   * **那句話是錯的**（2026-08-27，使用者：「一般我們都是先拉出節點，
   * 然後才去接邊，我現在連拉節點都不行」）。去查積木那側就知道：
   *
   * ```ts
   * // blockly-panel.ts extractSemanticTree()
   * const topBlocks = this.workspace.getTopBlocks(true)
   * for (const block of topBlocks) body.push(...this.extractBlockChain(block))
   * ```
   *
   * **一顆浮在工作區上的積木【本來就在樹裡】**——它是根的一個頂層子節點。
   * 所以「無主的節點」一直都存在，只是它的家叫 `body` 而不是叫「浮著」。
   *
   * > **我用「模型不允許」擋掉了一個互動，而模型從來沒有不允許
   * > ——不允許的是我腦中那張模型的圖。**
   *
   * ⚠️ 而它造成的損失不是「少一個便利功能」：**它把整個手勢倒過來了**。
   * 節點圖的常規是「先拉出來、再接邊」，而這條規則要求使用者
   * **在還沒看到節點之前就先命中一個半徑 6 的接點**。
   *
   * → `createInto` 保留（放在接點上是一條有用的捷徑），
   *   而放在空白處走 `createLoose`。
   */
  private createInto(
    componentId: string,
    target: { nodeId: string; port: GraphPort },
    extraState?: Record<string, unknown>,
  ): void {
    if (!this.tree) return
    if (target.port.key.startsWith('__')) { this.refuse('no-such-slot'); return }
    const node = presetTree(componentId, extraState)
    // ⚠️ 先掛進去才判得了——`tryConnect` 要在樹裡找得到它。
    //    判不過就**原樣拿掉**，樹回到原狀。
    const parent = this.findNode(this.tree, target.nodeId)
    if (!parent) return
    const bucket = (parent.children[target.port.key] ??= [])
    bucket.push(node)
    const verdict = tryConnect(this.tree, node.id, target.nodeId, target.port.key)
    if (!verdict.ok) {
      bucket.pop()
      this.refuse(verdict.reason)
      return
    }
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /**
   * **拉一顆節點出來，先不接**——2026-08-27。
   *
   * 它與積木那側是**同一件事**：新節點掛在根的 `body` 尾端，
   * 就像一顆放在工作區上還沒接的積木。接不接是下一步的事。
   *
   * ⚠️ 落點要是**手放開的地方**，不是自動排版算出來的位置——
   * 不然使用者會覺得「它跳走了」。用 `offsets`（面板的私有狀態，
   * 不進語義樹、不進存檔），所以按「自動排版」就會回到隊伍裡。
   */
  private createLoose(
    componentId: string,
    at: { x: number; y: number },
    extraState?: Record<string, unknown>,
  ): void {
    if (!this.tree) return
    const node = presetTree(componentId, extraState)
    const body = (this.tree.children.body ??= [])
    body.push(node)
    this.pendingDrop = { id: node.id, at }
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /**
   * 剛放下的那一顆要落在手放開的位置。
   *
   * ⚠️ **算得出偏移的時機在 `rebuild()` 之後**——在那之前它還沒有被畫出來，
   * 量不到「自動排版把它放在哪」，也就算不出要補多少。
   */
  private pendingDrop: { id: string; at: { x: number; y: number } } | null = null

  private applyPendingDrop(): void {
    const drop = this.pendingDrop
    if (!drop) return
    this.pendingDrop = null
    const el = this.svg.querySelector(`[data-node="${drop.id}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    // ⚠️ 走 `moveNode`——它是面板私有狀態的**唯一**寫入口（護欄靠它證明「真的動過」）。
    this.moveNode(drop.id, drop.at.x - (r.left + r.width / 2), drop.at.y - (r.top + r.height / 2))
  }

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
    // 🔴 **只收一次**（2026-08-27，瀏覽器實測的例外）
    //
    // 按 Enter → `done(true)` → `box.remove()` → **移除本身觸發 `blur`**
    // → `done(true)` 又跑一次 → `remove()` 拋 `NotFoundError`。
    //
    // ⚠️ 而拋例外只是**看得見的那一半**：另一半是**同一次編輯被送出兩次**，
    //    那一半安靜。
    //
    // > **一個「關掉自己」的收尾動作，會被自己觸發的事件再呼叫一次。**
    let closed = false
    const done = (commit: boolean): void => {
      if (closed) return
      closed = true
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

    // 🔴 **palette**（2026-08-26，(d)）——它**不自己決定有哪些東西**：
    //    內容是 `buildToolbox()` 的輸出攤平來的（`core/flow/palette.ts`）。
    //    「用同一份資料」擋不住分岔，「用同一份結果」才擋得住。
    //
    // ⚠️ **而它 2026-08-26 從「浮在圖上」改成「預設收起來」**，
    //    因為使用者回報「根本無法拖曳與編輯還有接線」——
    //    量出來的根因是這一塊：它佔 240×181，**正好蓋在圖的左上角**，
    //    而節點就從那裡開始排。點到的一直是它的按鈕。
    //
    //    > **一個浮在畫布上的工具盤，會把畫布最常用的那個角落變成不能點。**
    //
    //    🔴 它不是「調 z-index」或「移到右邊」能修的：**任何一塊浮層都會蓋住
    //    某一塊畫布**。所以它預設收起來，要用的時候才打開。
    this.paletteToggle = document.createElement('button')
    this.paletteToggle.className = 'flow-palette-toggle'
    this.paletteToggle.type = 'button'
    this.paletteToggle.addEventListener('click', () => this.setPaletteOpen(!this.paletteOpen))
    // 🔴 **分類條靠邊排版，彈出格才覆蓋**（2026-08-27，使用者：「積木盤能不能像 Blockly 那樣？」）
    //
    // 在此之前是一整面 22 顆積木浮在畫布上。那有兩個問題，而第二個比較深：
    //
    // ```
    // ① 它蓋住畫布           → 2026-08-26 的「拖不動」就是這個
    // ② 它把【分類】攤平了     → 22 顆看起來一樣重，而使用者要找的是「控制那一類」
    // ```
    //
    // > **把一份有結構的清單攤平成一面按鈕，省下的是一次點擊，
    // > 付出的是「我要找的東西在哪」。**
    //
    // Blockly 的形狀正好解決兩個：**分類條佔版面（不蓋任何東西）**，
    // 而彈出格是暫時的、拖曳一開始就收。
    this.toolboxEl = document.createElement('div')
    this.toolboxEl.className = 'flow-toolbox'
    this.paletteEl = document.createElement('div')
    this.paletteEl.className = 'flow-palette'
    bar.append(this.scopeSelect, auto)

    this.svg = document.createElementNS(SVG_NS, 'svg')
    this.svg.classList.add('flow-svg')

    this.empty = document.createElement('div')
    this.empty.className = 'flow-empty'

    // 🔴 **畫布自己一格，而它會捲動**（2026-08-27，瀏覽器實測的根因）
    //
    // 量出來的：SVG 是 **724** 寬、面板只有 **362**，而面板 `overflow: hidden`
    // ——**13 顆節點有 7 顆落在看不到的地方，而看不到的東西也點不到**。
    //
    // > **一張比容器大的圖，配上 `overflow: hidden`，
    // > 不是「畫面比較乾淨」——是「一半的功能不存在」。**
    //
    // ⚠️ 而**不能直接讓 `#flow-panel` 捲動**：工具列與積木盤住在它裡面，
    //    橫向捲的時候它們會跟著滑出去。所以捲的是**只裝圖的那一層**。
    this.canvas = document.createElement('div')
    this.canvas.className = 'flow-canvas'
    this.canvas.append(this.empty, this.svg)
    // 工具區與畫布並排——⚠️ 分類條在**這一列**裡面，所以它是排版的一部分，
    //    而不是浮在畫布上的一塊。彈出格 `position: absolute`，定位錨在這一列。
    // 🔴 **點畫布的空白處要把彈出格收起來**（2026-08-27，使用者回報）。
    //
    // ⚠️ 掛在**畫布**上而不是 `document`：掛在 document 的話，
    //    工具列上任何一次點擊都會順手收掉它，而那不是使用者的意思。
    //
    // ⚠️ 用 `pointerdown` 而不是 `click`：拖節點時 `click` 不會發生，
    //    而那一刻正是最需要它讓開的時候。
    this.canvas.addEventListener('pointerdown', () => this.closeFlyout())

    const workRow = document.createElement('div')
    workRow.className = 'flow-work'
    workRow.append(this.toolboxEl, this.paletteToggle, this.paletteEl, this.canvas)
    this.container.append(bar, workRow)
    this.setPaletteOpen(true)
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
    this.graph = buildNodeGraph(this.rootBody(), this.labelSource(), { emptySlots: this.capabilities.editable })
    // 拖曳位移只留給還在的節點——刪掉的節點不該留著一個看不見的位移
    const alive = new Set(this.graph.nodes.map((n) => n.id))
    // 🔴 **把手拖的位置搬到新的 id 上**——2026-08-27。
    //
    // 在此之前這裡只有下面那一行「不在新樹裡就刪掉」，而
    // **重新解析之後【沒有一顆】節點的 id 還在**（`generateId()` 是
    // `node_${++counter}_${Date.now()}`，兩個都會變）。實測 9→11 顆、id 相同 0。
    //
    // > **使用者手拖十顆節點，在程式碼裡打一個字，十顆全部跳回自動排版的位置。**
    //
    // 🟢 換的鑰匙是**三把一起**（`core/flow/layout-key.ts`），因為量出來
    // 三者掉的是不同的那幾顆：路徑掉「索引位移的兄弟」、行號掉「行號變了的」、
    // 內容掉「值被改的那一顆」——**失效條件互斥，所以聯集是 100%**。
    this.remapOffsets()
    for (const id of [...this.offsets.keys()]) if (!alive.has(id)) this.offsets.delete(id)
    this.paint()
    // 剛從 palette 放下的那一顆要落在手放開的地方——**要等它畫出來才算得出偏移**。
    this.applyPendingDrop()
    // ⚠️ **快照要在最後拍**：下一次重建要拿「這一次的樹 ＋ 這一次的行號對映」去配對。
    this.prevKeyed = this.keyedNodes()
  }

  /** 上一次重建時那棵樹長什麼樣——配對用。 */
  private prevKeyed: KeyedNode[] | null = null

  private keyedNodes(): KeyedNode[] {
    const root = this.scopedRoot()
    if (!root) return []
    return walkWithPath(root, (id) => {
      const m = this.mappings.find((x) => x.nodeId === id)
      return typeof m?.startLine === 'number' ? m.startLine : null
    })
  }

  /**
   * 把位移從舊 id 搬到新 id。
   *
   * ⚠️ **對不回去的要看得見**（P6：`principles.md:135`「降級必須……必須可見」）
   * ——安靜地掉回自動排版，症狀是「我拖的東西自己跑掉了」，而使用者找不到原因。
   *
   * 🔴 只在**使用者真的拖過**（`offsets` 非空）時才出聲：
   * 開機那一次什麼都沒拖，報「有 3 顆對不回去」只是噪音。
   */
  private remapOffsets(): void {
    if (this.offsets.size === 0 || !this.prevKeyed || this.prevKeyed.length === 0) return
    const now = this.keyedNodes()
    if (now.length === 0) return
    const pairs = matchNodes(this.prevKeyed, now)
    // 沒有任何一顆配得上 → 這是換了一份程式，不是一次編輯。不出聲，讓它重排。
    if (pairs.size === 0) return
    const next = new Map<string, Placed>()
    let lost = 0
    for (const [oldId, off] of this.offsets) {
      const newId = pairs.get(oldId)
      if (newId) next.set(newId, off)
      else lost += 1
    }
    this.offsets = next
    // 🔴 **被刪掉的不算「掉了位置」**（2026-08-27 實測抓到的誤報）。
    //
    // 使用者刪掉一行 → 那顆節點配不到 → 第一版報「2 顆對不回原本的位置」。
    // **而它們是被刪掉的，不是掉了。**
    //
    // > **一條在正常操作下也會響的警告，會被訓練成沒有人看
    // > ——而那時它報的真問題也一起被忽略了。**
    //
    // ⚠️ 判準是**保守的近似**：樹縮小了幾顆，就先假設那幾顆是被刪的。
    //    它會漏報「同時刪一顆又掉一顆」那種情況——而那個代價換到的是
    //    「刪除不再誤報」，而刪除是每天都在做的事。
    const deleted = Math.max(0, this.prevKeyed.length - now.length)
    const unexplained = lost - deleted
    if (unexplained > 0) {
      this.showNotice(
        msg('FLOW_LAYOUT_LOST', '有 {n} 顆節點在這次編輯之後對不回原本的位置，它們回到自動排版。')
          .replace('{n}', String(unexplained)),
      )
    }
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
    // 手放過的用它自己的絕對座標；沒放過的才問自動排版。
    return this.offsets.get(n.id) ?? { x: n.x + PAD, y: n.y + PAD }
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
      // 🔴 **命中區是一塊矩形，不是那幾個字**（2026-08-27，實測）
      //
      // SVG `<text>` 只有**字身**接得到指標事件——點在字距上會穿過去
      // 落到底板。量出來的症狀是「單擊欄位沒反應」，而那與
      // 「沒有這個功能」在使用者眼裡一樣。
      //
      // > **一個命中區等於字形的控制項，使用者點得到的是筆畫，不是欄位。**
      //
      // ⚠️ 這與「把 `dblclick` 改成 `click`」是**兩個獨立的缺陷**——
      //    改了事件種類而命中區仍然是字身的話，它照樣沒反應。
      const hit = document.createElementNS(SVG_NS, 'rect')
      hit.setAttribute('class', 'fc-field-hit')
      hit.setAttribute('x', '6')
      hit.setAttribute('y', String(y - ROW_H / 2 - 2))
      hit.setAttribute('width', String(n.w - 12))
      hit.setAttribute('height', String(ROW_H))
      g.appendChild(hit)
      const el = text('fc-field fc-field-editable', 10, y, truncate(shown, 20), 'start')
      // 🔴 **(b) 改欄位**——**單擊**那一格開一個輸入框（2026-08-26 改）。
      //
      // ⚠️ 第一版用雙擊，理由是「單擊與拖曳節點衝突」。而使用者回報
      //    「根本無法編輯」——**一個要雙擊才有反應的東西，在使用者眼裡就是壞的**：
      //    他單擊一次、沒反應，就不會再試第二次。
      //
      //    > **一個沒有人會去發現的互動，與沒有那個互動是同一件事。**
      //
      // 🟢 而那個「衝突」用 `stopPropagation` 就解決了（拖曳掛在 `g` 上，
      //    這裡先攔下來）——第一版是**用限制去繞過一個修得掉的問題**。
      for (const target of [hit, el]) {
        target.addEventListener('pointerdown', (ev) => ev.stopPropagation())
        target.addEventListener('click', (ev) => {
          ev.stopPropagation()
          this.promptField(n.id, n.componentId, f.key, f.value)
        })
      }
      g.appendChild(el)
      row++
    }
    for (const p of n.ports) {
      if (p.kind === 'exec' && p.side === 'out' && p.key !== '__next__') {
        if (p.label) g.appendChild(text('fc-port-label fc-port-exec-label', n.w - 10, p.dy + 4, truncate(p.label, 12), 'end'))
      }
      g.appendChild(this.renderPort(p, n.id))
    }

    const line = this.codeLineOf(n.id)
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent = line ? `${n.title}\n${line}` : n.title
    g.appendChild(title)

    this.attachDrag(g, n.id)
    return g
  }

  private renderPort(p: GraphPort, nodeId: string): SVGElement {
    if (p.kind === 'exec') {
      // 執行接點畫成箭頭——**與資料接點的圓形一眼分得出來**
      const tri = document.createElementNS(SVG_NS, 'path')
      // 🔴 `control_flow` 在這裡被**真的消費**：迴圈的身體出口與分支的臂不同色。
      //    ⚠️ 只宣告 `consumedAnnotations` 而不讀，第十一條護欄會抓到
      //    ——而它抓到過一次，就是這一刀改寫時我把讀取拿掉的那次。
      tri.setAttribute('class', `fc-port fc-port-exec fc-port-${p.side}${p.flow ? ` fc-flow-${p.flow}` : ''}`)
      tri.setAttribute('d', `M ${p.dx - 5} ${p.dy - 6} L ${p.dx + 5} ${p.dy} L ${p.dx - 5} ${p.dy + 6} Z`)
      this.attachWire(tri, nodeId, p)
      return tri
    }
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('class', `fc-port fc-port-data fc-port-${p.side}`)
    c.setAttribute('cx', String(p.dx))
    c.setAttribute('cy', String(p.dy))
    // ⚠️ **接點要點得到**：4.5px 的圓對滑鼠來說太小（使用者回報「接不了線」）。
    //    放大到 6，並在下面補一個透明的加大命中區。
    c.setAttribute('r', '6')
    this.attachWire(c, nodeId, p)
    return c
  }

  /**
   * **從一個接點拉一條線到另一個接點**——(c) 改接線。
   *
   * 🔴 **能不能接由 `core/flow/connect.ts` 判**，這裡只負責手勢與畫面。
   * 那條規則先於這個功能存在，理由寫在它的檔頭：
   * 先做拉線的話，「這條線存哪」會在寫 UI 的時候被順手決定，
   * **而最順手的地方就是 `metadata`**（第八十條護欄的硬性零）。
   *
   * ⚠️ 拒絕時**說出理由並且不動樹**——`history/017`：
   * 一道會拒絕的檢查必須同時回答「被拒絕的東西去哪了」。
   */
  private attachWire(el: SVGElement, nodeId: string, port: GraphPort): void {
    // 🔴 **哪些接點可以拉**（2026-08-26 第一版判錯）：
    //
    // ```
    // 具名的鍵（initializer／body／left…）  目標——「放進這一格」
    // __out__（運算式的值出口）             來源——【第一版把它跳過了，於是一條線都接不上】
    // __in__（語句的入口）                  來源——把這一句放進某個身體
    // __next__（語句的下一個）              留給 (e) 語句重排，這一刀不接
    // ```
    //
    // > **一個「跳過內部接點」的規則，跳掉了唯一能當來源的那一個。**
    // ⚠️ `__next__` 從 2026-08-26 起也可以拉——它是 (e) 語句重排那一條。
    el.classList.add('fc-port-wirable')
    el.setAttribute('data-port', port.key)
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()   // ⚠️ 不然它會變成「拖節點」
      this.wireFrom = { nodeId, port }
      const move = (e: PointerEvent): void => this.paintWirePreview(e)
      const up = (e: PointerEvent): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        this.setDropTargetsVisible(false)
        this.clearWirePreview()
        const to = this.portUnder(e)
        const from = this.wireFrom
        this.wireFrom = null
        if (from && to) this.commitWire(from, to)
        // 🔴 **放偏了也要說話**（2026-08-27）——同上面 palette 那一段的理由。
        //    在此之前放在空白處是**完全靜默**的，而那看起來就是「接線壞了」。
        else if (from) this.showNotice(msg('FLOW_DROP_MISSED', '要放在一個接點上（那些小圓點）——這條線沒有接上。'))
      }
      this.setDropTargetsVisible(true)
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }

  /**
   * 放開的位置**在畫布上嗎**。
   *
   * ⚠️ 分得出「放在圖上」與「放到面板外面」——後者是**取消**，
   * 而把取消當成「在原點生一顆」會讓使用者以為自己手滑生了東西。
   */
  private overCanvas(e: PointerEvent): boolean {
    const r = this.canvas.getBoundingClientRect()
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  }

  private wireFrom: { nodeId: string; port: GraphPort } | null = null

  /**
   * **拖曳中把能放的地方點亮**（2026-08-27）。
   *
   * ⚠️ 接點是半徑 6 的圓，靜止時它們刻意不搶戲（P4 漸進揭露）。
   * 而**拖曳中**正好相反：那一刻使用者要找的就是它們。
   *
   * 🔴 用一個 class 掛在 `<svg>` 上，樣式住在 CSS——
   * 不逐顆改 style，因為那要在放開時逐顆還原，而**漏還原一顆就是一個永久的亮點**。
   */
  private setDropTargetsVisible(on: boolean): void {
    this.svg.classList.toggle('flow-dropping', on)
  }

  /**
   * **放開的位置底下是哪一個接點。**
   *
   * ⚠️ 名字刻意不叫 `portAt`——那個名字已經被「算某個接點的座標」用掉了。
   * 兩個「portAt」會讓下一個人在改其中一個時改到另一個。
   */
  private portUnder(e: PointerEvent): { nodeId: string; port: GraphPort } | null {
    // 🔴 **穿過去找**（2026-08-26 實測抓到）：palette 是拖曳的起點，
    //    所以它必然壓在圖上，而 `elementFromPoint`（**單數**）打到的是它。
    //
    //    ⚠️ 第一版的修法是「拖曳中把 palette 設成 `pointer-events: none`」
    //    ——而那會把**已經捕捉指標的那個元素**移出命中測試，
    //    瀏覽器於是可能發 `pointercancel` 而不是 `pointerup`，**整個手勢消失**。
    //    症狀是「拖了什麼都沒發生」，而且合成事件與真的滑鼠**一樣**沒反應。
    //
    //    > **修一個「被擋住」的問題時，不要動那個擋住的東西的狀態
    //    > ——繞過它去看底下有什麼。**
    const el = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((x) => x.classList.contains('fc-port'))
    const g = el?.closest('[data-node]') as SVGGElement | null
    if (!g) return null
    const nodeId = g.getAttribute('data-node')!
    const node = this.graph?.nodes.find((n) => n.id === nodeId)
    // 🔴 **用鍵找，不用位置找**（2026-08-26 實測抓到）。
    //    第一版拿 `.fc-port` 在 DOM 裡的**索引**去索引 `node.ports`
    //    ——那要求兩個順序永遠一致，而它悄悄地不一致了，
    //    症狀是「拖到接點上什麼都沒發生」（不是報錯）。
    //
    //    > **一個靠位置對應模型與畫面的東西，
    //    > 會在其中一邊多插一個元素的那天安靜地錯開。**
    //
    //    （同一族的教訓：`build-guardrail` §11「鍵不要用行號」。）
    const key = el?.getAttribute('data-port')
    const port = node?.ports.find((p) => p.key === key)
    return node && port ? { nodeId, port } : null
  }

  /**
   * 接上去——**而大多數的線接不上**。
   *
   * ⚠️ 方向：一條線的意思永遠是「**把來源放進目標的那一格**」，
   * 所以 `in` 的那一端是目標。兩端都是 `in`（或都是 `out`）＝ 兄弟連兄弟，
   * 而**語義樹沒有那種東西**。
   */
  private commitWire(
    a: { nodeId: string; port: GraphPort },
    b: { nodeId: string; port: GraphPort },
  ): void {
    if (!this.tree) return
    // 🔴 **(e) 語句重排先判**：`__next__ → __in__` 讀作「B 接在 A 後面」，
    //    那是**兄弟之間的順序**，不是父子關係的改變。
    //    ⚠️ 混進 `tryConnect` 的話兩邊的拒絕理由會互相污染
    //    ——「不是父子」對重排來說根本不是一個問題。
    const seq = a.port.key === '__next__' && b.port.key === '__in__' ? { after: a, moved: b }
      : b.port.key === '__next__' && a.port.key === '__in__' ? { after: b, moved: a }
      : null
    if (seq) {
      const v = tryReorder(this.tree, seq.after.nodeId, seq.moved.nodeId)
      if (!v.ok) { this.refuse(v.reason); return }
      this.moveInto(seq.moved.nodeId, v.parentId, v.slot, v.index)
      this.rebuild()
      this.editCb?.(this.tree)
      return
    }
    // ⚠️ **方向由「哪一端是具名的格子」決定，不由 `side`**：
    //    身體的接點是掛在**父節點**上的 `side: 'out'`，
    //    而它仍然是目標（「語句放進這裡」）。第一版用 `side` 判，
    //    於是「把一句話放進迴圈的身體」永遠被拒絕。
    const named = (x: { port: GraphPort }): boolean => !x.port.key.startsWith('__')
    if (named(a) === named(b)) { this.refuse('not-parent-child'); return }
    const target = named(a) ? a : b
    const source = named(a) ? b : a
    const verdict = tryConnect(this.tree, source.nodeId, target.nodeId, target.port.key)
    if (!verdict.ok) { this.refuse(verdict.reason); return }
    this.moveInto(source.nodeId, target.nodeId, verdict.slot)
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /** 說出拒絕的理由——**不動樹**。 */
  private refuse(reason: RefusalReason): void {
    this.showNotice(msg(refusalKeyOf(reason), '這條線接不上。你的程式沒有被改動。'))
  }

  /**
   * 把來源從它現在的位置搬到目標的那一格。
   *
   * ⚠️ **先摘下來再放進去**——不然它會同時出現在兩個地方，
   * 而那棵樹就不是樹了。
   */
  private moveInto(sourceId: string, targetId: string, slot: string, index?: number): void {
    if (!this.tree) return
    const detach = (n: SemanticNode): SemanticNode | null => {
      for (const [k, bucket] of Object.entries(n.children ?? {})) {
        const i = (bucket ?? []).findIndex((c) => c.id === sourceId)
        if (i >= 0) return (n.children[k] as SemanticNode[]).splice(i, 1)[0]
        for (const c of bucket ?? []) { const hit = detach(c); if (hit) return hit }
      }
      return null
    }
    const node = detach(this.tree)
    if (!node) return
    const target = this.findNode(this.tree, targetId)
    if (!target) return
    const bucket = (target.children[slot] ??= [])
    // ⚠️ **摘下來之後索引可能已經往前挪了**——所以夾在範圍內，
    //    而不是相信呼叫端算出來的那個數字。
    if (index === undefined) bucket.push(node)
    else bucket.splice(Math.max(0, Math.min(index, bucket.length)), 0, node)
  }

  /**
   * 拖曳中那條跟著手指走的線。
   *
   * 🔴 **它原本畫的是一條零長度的線**（2026-08-27 讀出來的）：
   * `x1`／`x2` 與 `y1`／`y2` 都是同一個游標座標，所以
   * **這個「預覽」從它存在的那天起就看不見**。
   *
   * > **一個起點與終點相同的預覽線，不是「很細」——它是【沒有】。**
   *
   * ⚠️ 而它不會變紅：那個元素真的被建出來、真的進了 DOM，
   * 任何「有沒有畫出預覽」的檢查都會說有。
   *
   * @param origin 線的起點（螢幕座標）。省略時從 `wireFrom` 那個接點算。
   */
  private paintWirePreview(e: PointerEvent, origin?: { x: number; y: number }): void {
    this.clearWirePreview()
    const r = this.svg.getBoundingClientRect()
    const start = origin ?? this.wireFromPoint()
    if (!start) return
    const l = document.createElementNS(SVG_NS, 'line')
    l.setAttribute('class', 'fc-wire-preview')
    l.setAttribute('x1', String(start.x - r.left))
    l.setAttribute('y1', String(start.y - r.top))
    l.setAttribute('x2', String(e.clientX - r.left))
    l.setAttribute('y2', String(e.clientY - r.top))
    this.svg.appendChild(l)
  }

  /** 正在拉的那條線是從哪一個接點出發的（螢幕座標）。 */
  private wireFromPoint(): { x: number; y: number } | null {
    const from = this.wireFrom
    if (!from) return null
    const el = this.svg.querySelector(
      `[data-node="${from.nodeId}"] .fc-port-wirable[data-port="${from.port.key}"]`,
    )
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  private clearWirePreview(): void {
    this.svg.querySelector('.fc-wire-preview')?.remove()
  }

  /** 一句話，疊在面板上。⚠️ 不用原生對話框（第七十七條護欄）。 */
  private showNotice(text: string): void {
    this.container.querySelector('.flow-notice')?.remove()
    const el = document.createElement('div')
    el.className = 'flow-notice'
    el.textContent = text
    this.container.appendChild(el)
    setTimeout(() => el.remove(), 6000)
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
      const node = this.graph?.nodes.find((n) => n.id === id)
      const base = node ? this.posOf(node) : { x: 0, y: 0 }
      const move = (e: PointerEvent): void => {
        this.offsets.set(id, { x: base.x + (e.clientX - start.x), y: base.y + (e.clientY - start.y) })
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

  /**
   * 測試用：面板私有狀態的**唯一**寫入口（護欄靠它證明「真的動過」）。
   *
   * ⚠️ 參數仍然是**位移**（呼叫端想的是「往右移 40」），而存下去的是
   * **它移完之後在哪**——見 `Placed` 的說明。
   */
  moveNode(id: string, dx: number, dy: number): void {
    const node = this.graph?.nodes.find((n) => n.id === id)
    const base = node ? this.posOf(node) : { x: 0, y: 0 }
    this.offsets.set(id, { x: base.x + dx, y: base.y + dy })
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
