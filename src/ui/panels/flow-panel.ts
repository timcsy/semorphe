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
import {
  walkWithPath, matchNodes, matchByKeys, keysOfNodes, type KeyedNode,
} from '../../core/flow/layout-key'
import type { PlacedEntry } from '../../core/flow/layout-key'
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
  private highlighted: string | null = null

  private svg!: SVGSVGElement
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

  /**
   * 🪦 `onHistory`／`sayNothingToUndo` 已於 2026-08-30 退場。
   *
   * 它們是這個面板自己那一對 ↶↷ 的接線，而那一對已經拿掉了
   * ——畫面上只留快速列那一對，由組裝點依「上一步在哪裡做的」轉送。
   *
   * ⚠️ 而**樹的歷史本身沒有動**：它住在 `SyncController`，
   * 由 `app.ts` 的 `doUndo`／`doRedo` 呼叫。
   */
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
  /**
   * **縮放倍率**——1 ＝ 原寸。
   *
   * 🔴 做法是**只縮 `width`／`height`，`viewBox` 不動**：
   * SVG 內部的座標因此完全不變（節點位置、連線、排版一個都不用改），
   * 而**捲動仍然是原生的**（`.flow-canvas` 的 `overflow: auto`）。
   *
   * > **一個把「畫多大」與「座標系」分開的縮放，
   * > 不會讓其餘每一段程式都要學會除以一個倍率。**
   *
   * ⚠️ 而**有三處非除不可**：那三處拿的是**螢幕像素**
   * （拖曳的位移、拖進來的落點、連線預覽的端點）——見 `toSvgLen`。
   */
  private zoom = 1
  private static readonly ZOOM_MIN = 0.2
  private static readonly ZOOM_MAX = 3

  /**
   * **鏡頭的位移**——與 `zoom` 合起來就是那個 `<g>` 的 `transform`。
   *
   * ## 🔴 為什麼不用原生捲動了（2026-08-30）
   *
   * 在此之前是 `.flow-canvas { overflow: auto }`。而**原生捲動只在
   * 內容比視窗大的時候存在**，實測（400×780 的手機）：
   *
   * ```
   * 100%    縱向可捲 = 0            直的完全推不動
   * 縮小後  橫向也 = 0              整張圖完全推不動
   * ```
   *
   * 流程圖通常**比手機畫面小**，所以那個「捲動」根本不存在。
   *
   * 🟢 Blockly 的做法：內容放在一個 `<g>` 上用 `transform` 推，
   * **畫布是無限的**——你永遠拖得動它。
   *
   * > **「能不能移動畫面」不該取決於「內容夠不夠大」。**
   */
  private pan = { x: 0, y: 0 }

  /** 內容的 `<g>`——`transform` 掛在它身上。 */
  private viewport!: SVGGElement

  /** 螢幕像素的**長度** → 內容單位。 */
  private toSvgLen(px: number): number {
    return px / this.zoom
  }

  /** 螢幕座標 → 內容座標。⚠️ 位移與縮放都要扣掉。 */
  private clientToContent(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect()
    return {
      x: (x - r.left - this.pan.x) / this.zoom,
      y: (y - r.top - this.pan.y) / this.zoom,
    }
  }

  private applyViewport(): void {
    this.viewport?.setAttribute(
      'transform', `translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`)
  }

  /** 內容的尺寸（SVG 單位）——`適配` 要用它算倍率。 */
  private contentSize = { w: 0, h: 0 }

  /** 目前壓著的指標。⚠️ **兩根就是捏合**，而那時不准拖節點。 */
  private pointers = new Map<number, { x: number; y: number }>()

  /**
   * **設定縮放倍率**，並讓 `anchor`（螢幕座標）底下那一點**留在原地**。
   *
   * 🔴 少了 anchor 的話，縮放會把畫面「往左上角吸」——使用者捏在畫面中間，
   * 而他要看的東西跑掉了。
   *
   * > **一個不固定錨點的縮放，等於縮放加上一次沒有人要求的捲動。**
   */
  private setZoom(next: number, anchor?: { x: number; y: number }): void {
    const z = Math.min(FlowPanel.ZOOM_MAX, Math.max(FlowPanel.ZOOM_MIN, next))
    if (Math.abs(z - this.zoom) < 0.001) return
    const box = this.canvas.getBoundingClientRect()
    const at = anchor ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    // 錨點相對於畫布左上角
    const ax = at.x - box.left
    const ay = at.y - box.top
    // 🔴 讓錨點底下那一點**留在原地**：`t' = a - (a - t) · (z'/z)`
    const k = z / this.zoom
    this.pan = { x: ax - (ax - this.pan.x) * k, y: ay - (ay - this.pan.y) * k }
    this.zoom = z
    this.applyViewport()
    this.syncZoomLabel()
  }

  /** 把鏡頭推到某個位置。 */
  private panBy(dx: number, dy: number): void {
    this.pan = { x: this.pan.x + dx, y: this.pan.y + dy }
    this.applyViewport()
  }

  /** 把整張圖塞進畫布——⚠️ **只縮不放**：小圖放大到 2.5 倍只是變模糊。 */
  private zoomToFit(): void {
    const box = this.canvas.getBoundingClientRect()
    if (!this.contentSize.w || !this.contentSize.h || !box.width) return
    // ⚠️ **只縮不放**：小圖放大到三倍只是變模糊。而留 16px 的邊。
    const fit = Math.min(
      (box.width - 32) / this.contentSize.w,
      (box.height - 32) / this.contentSize.h, 1)
    this.zoom = Math.min(FlowPanel.ZOOM_MAX, Math.max(FlowPanel.ZOOM_MIN, fit))
    // 置中——`適配` 之後圖該在畫面中間，不是擠在左上角
    this.pan = {
      x: (box.width - this.contentSize.w * this.zoom) / 2,
      y: (box.height - this.contentSize.h * this.zoom) / 2,
    }
    this.applyViewport()
    this.syncZoomLabel()
  }

  /**
   * **兩根手指捏合 ＋ ⌘／Ctrl 滾輪**。
   *
   * ## 🔴 一根手指仍然是捲動
   *
   * `.flow-canvas` 的 CSS 是 `touch-action: pan-x pan-y`：
   *
   * ```
   * 一根手指   瀏覽器自己捲（原生的，最順）
   * 兩根手指   瀏覽器【不做事】（pan-* 已經排除了 pinch-zoom）→ 這裡接手
   * ```
   *
   * ⚠️ 而如果寫成 `touch-action: none`，**捲動也會一起沒了**
   * ——那時就得自己實作慣性捲動，而那永遠比不上原生的。
   *
   * > **先讓瀏覽器做它做得比你好的那一半，再接手它不做的那一半。**
   *
   * ## ⚠️ 滾輪要分兩種
   *
   * 觸控板的捏合在瀏覽器裡就是 `wheel` ＋ `ctrlKey`——所以**帶修飾鍵才縮放**，
   * 而**光滾滾輪仍然是捲動**（原生）。搞混的話使用者會發現「我想往下捲，
   * 而畫面在放大」。
   */
  private attachZoomGestures(): void {
    const el = this.canvas

    // ── 一根手指／滑鼠拖空白處 ＝ 推畫面 ────────────────────────────
    //
    // 🔴 **Blockly 就是這樣**：畫布是無限的，你永遠拖得動它。
    //    在此之前這裡靠原生捲動，而實測手機上**縱向可捲 = 0**
    //    ——流程圖比畫面小，於是「捲動」根本不存在。
    let panFrom: { x: number; y: number; pan: { x: number; y: number } } | null = null
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return
      if (e.pointerType === 'touch') this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // ⚠️ 只在**空白處**才推畫面：按在節點或線上的話它們已經 `stopPropagation`
      if (this.pointers.size > 1) { panFrom = null; return }
      panFrom = { x: e.clientX, y: e.clientY, pan: { ...this.pan } }
      el.classList.add('fc-panning')
    })

    const endPan = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId)
      panFrom = null
      el.classList.remove('fc-panning')
    }
    el.addEventListener('pointerup', endPan)
    el.addEventListener('pointercancel', endPan)
    el.addEventListener('pointerleave', endPan)

    // ── 兩根手指 ＝ 捏合縮放 ──────────────────────────────────────
    //
    // ⚠️ `.flow-canvas` 現在是 `touch-action: none`——**每一種手勢都由我們接**。
    //    這與 Blockly 一致：它也把整塊注入區設成 `none` 再自己分派。
    let pinchFrom: { dist: number; zoom: number } | null = null
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && this.pointers.has(e.pointerId)) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      }
      const pts = [...this.pointers.values()]
      if (pts.length === 2) {
        panFrom = null
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        if (!pinchFrom) { pinchFrom = { dist, zoom: this.zoom }; return }
        if (pinchFrom.dist < 1) return
        this.setZoom(pinchFrom.zoom * (dist / pinchFrom.dist), {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        })
        return
      }
      pinchFrom = null
      if (!panFrom) return
      this.pan = {
        x: panFrom.pan.x + (e.clientX - panFrom.x),
        y: panFrom.pan.y + (e.clientY - panFrom.y),
      }
      this.applyViewport()
    })

    // ── 滾輪 ─────────────────────────────────────────────────────
    //
    // 🔴 **帶修飾鍵＝縮放，光滾＝推畫面**。在此之前光滾是原生捲動，
    //    而原生捲動已經沒有了（畫布不再 `overflow: auto`），所以這裡要接手。
    el.addEventListener('wheel', (e) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX, y: e.clientY })
        return
      }
      this.panBy(-e.deltaX, -e.deltaY)
    }, { passive: false })
  }

  private syncZoomLabel(): void {
    if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`
  }

  private zoomLabel: HTMLButtonElement | null = null

  /**
   * **選取**——一次一個，可以是一顆節點或一條線。
   *
   * ## 🔴 它從哪來
   *
   * 「選取 ＋ Delete 鍵」在節點編輯器裡幾乎是共識
   * （Blender · Unreal Blueprint · Houdini · Node-RED · n8n · React Flow · Blockly），
   * 而我們在 2026-08-30 之前**沒有選取模型、也沒有鍵盤刪除**。
   *
   * ⚠️ 而它同時解掉**觸控**那一半：觸控上根本沒有 Delete 鍵，
   * 也沒有 hover——所以「選起來」就是行動裝置上讓 ✕ 現身的方式。
   *
   * > **hover 是滑鼠才有的東西。一個只在 hover 時出現的操作，
   * > 在觸控上等於不存在。**
   */
  private selection: { kind: 'node' | 'wire'; id: string } | null = null

  /**
   * **長按／右鍵選單**——使用者 2026-08-30：
   * 「刪除的部分或許可以考慮**長按（右鍵）選單刪除**或是**選取 Delete**」。
   *
   * ## 🔴 為什麼那兩顆 ✕ 退場了
   *
   * 實測（400×780 的手機）：**刪除鈕 9×15 px，縮小之後 6×9**
   * ——遠低於觸控目標的建議值，而且它**跟著縮放一起變小**，方向是反的。
   *
   * > **一個會隨著畫面縮小而一起縮小的觸控目標，
   * > 在最需要它的時候最小。**
   *
   * 🟢 而 Blockly 沒有 ✕：它用**右鍵／長按選單**。這一顆選單是 DOM，
   * 不在 SVG 裡，所以**它的大小與縮放無關**。
   */
  private menu: HTMLElement | null = null

  private closeMenu(): void {
    this.menu?.remove()
    this.menu = null
  }

  private openMenu(at: { x: number; y: number }, kind: 'node' | 'wire', id: string): void {
    this.closeMenu()
    this.select(kind, id)
    const box = this.container.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'flow-menu'
    el.style.left = `${at.x - box.left}px`
    el.style.top = `${at.y - box.top}px`
    const item = (label: string, run: () => void): void => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'flow-menu-item'
      b.textContent = label
      // ⚠️ `pointerdown` 不是 `click`——見這個檔案裡那條反覆出現的教訓
      b.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); this.closeMenu(); run() })
      el.appendChild(b)
    }
    item(kind === 'wire'
      ? msg('FLOW_MENU_DELETE_WIRE', '刪掉這一端')
      : msg('FLOW_MENU_DELETE', '刪掉這一塊'), () => this.deleteNode(id))
    // 🔴 **記住它**（2026-08-30 實測抓到）：第一版建了選單卻沒有指派，
    //    於是 `closeMenu()` 什麼都沒關——**選單會一直疊上去**。
    //    症狀是第二次右鍵之後畫面上有兩個選單。
    //
    // > **一個「關閉」函式如果關的是一個從來沒有被記住的東西，
    // > 它每一次都成功，而每一次都沒有作用。**
    this.menu = el
    this.container.appendChild(el)
    // 點別處就收起來
    setTimeout(() => {
      const off = (): void => { this.closeMenu(); window.removeEventListener('pointerdown', off) }
      window.addEventListener('pointerdown', off)
    }, 0)
  }

  private isSelected(kind: 'node' | 'wire', id: string): boolean {
    return this.selection?.kind === kind && this.selection.id === id
  }

  private select(kind: 'node' | 'wire', id: string | null): void {
    this.selection = id === null ? null : { kind, id }
    this.paint()
    // 🔴 **對外說一聲**——這個 app 早就有一條以 `nodeId` 為鍵的跨視圖反白
    //    （積木選一塊 → 程式碼那一行也亮）。流程視圖在 2026-08-30 之前
    //    **沒有加入**，於是它的選取只有自己看得到。
    //
    // > **一個只有自己看得到的選取，在多視圖的編輯器裡等於沒有選。**
    this.selectCb?.(id)
  }

  /** 組裝點接上「我選了哪一顆」。 */
  onNodeSelect(cb: ((nodeId: string | null) => void) | null): void { this.selectCb = cb }
  private selectCb: ((nodeId: string | null) => void) | null = null

  /**
   * **別的視圖選了那一顆** → 這裡也亮起來。
   *
   * ⚠️ 它**不回叫** `selectCb`——不然兩個視圖會互相通知到天亮。
   */
  highlightNode(nodeId: string | null): void {
    this.selection = nodeId === null ? null : { kind: 'node', id: nodeId }
    this.paint()
  }

  /**
   * **鍵盤刪除**——`Delete`／`Backspace` 刪掉選取的那一個，`Escape` 取消選取。
   *
   * ⚠️ 要收得到鍵盤事件，畫布得**進得了焦點**（`tabindex`）——
   * 而那同時讓它進得了 Tab 鍵的順序，那是無障礙本來就該有的。
   */
  private attachKeys(): void {
    this.canvas.tabIndex = 0
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.select('node', null); return }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const sel = this.selection
      if (!sel) return
      e.preventDefault()
      this.deleteNode(sel.id)
    })
    // 點空白處＝取消選取（而它不能蓋掉「點線」「點節點」——那兩個都 stopPropagation）
    this.canvas.addEventListener('click', () => { if (this.selection) this.select('node', null) })
  }

  private paletteOpen = false
  private openCategory: string | null = null

  /** 收合**整條分類**。⚠️ 關著的時候完全不佔版面（`display: none`）。 */
  private setPaletteOpen(open: boolean): void {
    this.paletteOpen = open
    this.toolboxEl.style.display = open ? '' : 'none'
    // 🔴 **收合鈕要站在「目前展開到哪裡」的最外緣**——見 `syncPaletteEdge`
    this.container.classList.toggle('flow-palette-closed', !open)
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
    // 🔴 **第二層開著時，收合鈕要移到它的外緣**（2026-08-30，使用者：
    //    「流程視圖 palette 行動版多階層收合位置有問題」）。
    //
    // 量出來的：分類條 x=0..84、**收合鈕 x=84..106**、彈出格 x=106..256。
    // 那顆鈕收的是**整個** palette（兩層一起），而它站在**第一層**的邊緣上
    // ——第二層一打開，它就被夾在兩層中間，看起來不屬於任何一邊。
    //
    // > **一顆按鈕的位置在說「我管的是這一塊」。
    // > 它管兩層而站在第一層的邊上，那句話就是錯的。**
    this.container.classList.toggle('flow-flyout-open', Boolean(this.openCategory))
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
    // ⚠️ `moveNode` 吃的是 **SVG 單位**，而這裡兩個都是螢幕像素
    this.moveNode(
      drop.id,
      this.toSvgLen(drop.at.x - (r.left + r.width / 2)),
      this.toSvgLen(drop.at.y - (r.top + r.height / 2)),
    )
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

  /**
   * **骨架告示**——哪幾顆是骨架、使用者想看到多少（`SemanticUpdateEvent.scaffold`）。
   *
   * 🔴 2026-08-30 之前這個面板**完全不認得它**：實測三個模式的節點集合逐字相同，
   * 連 `hidden` 都照樣把整組骨架畫出來。而 console 零筆錯誤
   * ——**不是壞掉，是從來沒做過**。
   *
   * > **一個模式如果在某個視圖上與另一個模式長得一樣，
   * > 那個視圖就沒有實作它——而選單仍然讓人選得到。**
   */
  private scaffoldIds = new Set<string>()
  private scaffoldMode: 'hidden' | 'ghost' | 'editable' = 'editable'

  private isGhostNode(id: string): boolean {
    return this.scaffoldMode === 'ghost' && this.scaffoldIds.has(id)
  }

  onSemanticUpdate(event: SemanticUpdateEvent): void {
    // 🔴 **收下的是一份拷貝**（2026-08-30）。
    //
    // 在此之前這裡存的是 `event.tree` 的**參考**——與 `SyncController`
    // 手上那一棵是**同一個物件**。而這個面板會就地改它
    // （`moveInto` 的 `splice`、`deleteNode`、`editField`）。
    //
    // ⚠️ 症狀不是「畫錯」，是**歷史拍不到照**：`handleEditTree` 想在套用前
    // 拍一張「改動前」，而那時 `currentTree` **早就已經被改過了**
    // ——實測：刪一句話，按還原，程式碼一個字都沒退回去。
    //
    // > **一個視圖如果就地改真相，那個真相就沒有「之前」。**
    this.tree = structuredClone(event.tree)
    if (event.scaffold) {
      this.scaffoldIds = new Set(event.scaffold.nodeIds)
      this.scaffoldMode = event.scaffold.mode
    }
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

    // 🪦 **「整份程式 ▾」那顆下拉已於 2026-08-30 刪除**（使用者：
    //    「這選單能不能先刪掉？現在好像還看不出有什麼用」）。
    //
    // 它列的是「整份程式」＋**每一顆有本體的頂層節點**（也就是函式），
    // 讓你把圖收窄到單一函式。而**今天多數程式只有 `main`**，
    // 於是兩個選項看到的東西幾乎一樣——而它在行動版佔掉工具列最寬的一格。
    //
    // > **一個要等到「東西變多」才有價值的控制項，
    // > 在那之前是純粹的成本。**
    //
    // 🔴 **重開條件**：一支程式真的有好幾個函式，而使用者說出
    //    「我只想看其中一個」——**不是「又想到它了」**。
    //    （那時它該長成什麼樣也要重想：一個下拉、還是點函式節點就聚焦。）

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
    /**
     * **縮放的三顆**（2026-08-30，使用者：「流程視圖行動版做得更好用，
     * 包含拖曳、放大縮小、畫面捲動等等」）。
     *
     * 🔴 中間那顆**同時是顯示處與入口**：它印著目前的倍率，按下去是「適配」。
     * ⚠️ 而那正是這個 repo 的既有判準（狀態列那顆同步）：
     *
     * > **同一件事在同一個畫面上有兩個開關，是一個必然會不一致的東西。**
     */
    const zoomOut = document.createElement('button')
    zoomOut.className = 'flow-btn flow-zoom-btn'
    zoomOut.type = 'button'
    zoomOut.textContent = '−'
    zoomOut.title = msg('FLOW_ZOOM_OUT', '縮小')
    zoomOut.addEventListener('click', () => this.setZoom(this.zoom / 1.25))

    const zoomFit = document.createElement('button')
    zoomFit.className = 'flow-btn flow-zoom-label'
    zoomFit.type = 'button'
    zoomFit.title = msg('FLOW_ZOOM_FIT', '整張圖塞進畫面')
    zoomFit.addEventListener('click', () => this.zoomToFit())
    this.zoomLabel = zoomFit

    const zoomIn = document.createElement('button')
    zoomIn.className = 'flow-btn flow-zoom-btn'
    zoomIn.type = 'button'
    zoomIn.textContent = '＋'
    zoomIn.title = msg('FLOW_ZOOM_IN', '放大')
    zoomIn.addEventListener('click', () => this.setZoom(this.zoom * 1.25))

    // 🪦 **這裡曾經有一對 ↶ ↷**（2026-08-30 退場）。畫面上因此有【三對】
    //    「還原」：程式碼工具列、快速列的 ↩↪、以及這一對。
    //
    // > **同一件事在同一個畫面上有兩個開關，是一個必然會不一致的東西。**
    //
    // 🟢 只留快速列那一對，而它依「上一步在哪裡做的」轉送到這裡的樹歷史。
    //    ⚠️ `onHistory` 的埠**留著**——它是組裝點接進來的那條線。
    bar.append(auto, zoomOut, zoomFit, zoomIn)
    this.syncZoomLabel()

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
    this.attachZoomGestures()
    this.attachKeys()
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

  /**
   * 要畫哪一段——🪦 **今天永遠是整棵樹**（見上面那個下拉的墓碑）。
   *
   * ⚠️ 這一層**留著**：它是「收窄範圍」這件事的接縫，
   * 重開的時候不必再把它挖回來。
   */
  private scopedRoot(): SemanticNode | null {
    if (!this.tree) return null
    return this.tree
  }

  private rootBody(): SemanticNode[] {
    const target = this.scopedRoot()
    if (!target) return []
    const body = bodySlotsOf(target.componentId).flatMap((s) => target.children[s] ?? [])
    if (this.scaffoldMode !== 'hidden') return body
    // 🔴 **`hidden` ＝「只留你自己的邏輯」，而那句話要跨視圖同一個意思。**
    //
    // ⚠️ 這裡**不問語言**——它只用告示給的 `nodeIds`：骨架的那一顆讓位，
    //    由它身上的（非骨架）語句遞補。`int main(){ … }` 於是被攤開，
    //    而 `#include`／`return 0` 直接不見（它們沒有本體）。
    //
    // 🟢 這條規則語言無關：Arduino 的 `setup`／`loop` 各攤出自己的本體。
    const unwrap = (nodes: SemanticNode[]): SemanticNode[] =>
      nodes.flatMap((n) => this.scaffoldIds.has(n.id)
        ? unwrap(bodySlotsOf(n.componentId).flatMap((s) => n.children[s] ?? []))
        : [n])
    return unwrap(body)
  }

  private rebuild(): void {
    this.syncLabels()
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
    // 存檔還原的那一份——**等到有節點了才套得起來**（見 `restoreLayout`）。
    this.applyPendingLayout()
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
    /**
     * **這次到底是「編輯」還是「換了一份程式」**（2026-08-27 實測補）。
     *
     * 第一版只擋「一顆都沒配上」，而**換掉整份程式時通常還是配得上幾顆**
     * （`cpp:program` 一定在，字面量也常撞），於是它跳出
     * 「有 4 顆節點對不回原本的位置」——**而使用者剛剛貼了一份新程式**。
     *
     * > **一條在正常操作下也會響的警告，會被訓練成沒有人看
     * > ——而那時它報的真問題也一起被忽略了。**
     *
     * ⚠️ 判準是**整棵樹的配對率**，而它是一個門檻值（沒有更好的辦法）：
     * 大半配得上 ＝ 一次編輯（掉了位置值得說）；大半配不上 ＝ 換了一份程式。
     * **代價說得出來**：改動幅度極大的一次「編輯」會被當成換程式而不出聲。
     */
    const matchRate = pairs.size / Math.max(this.prevKeyed.length, now.length)
    const replaced = matchRate < 0.5
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
    if (unexplained > 0 && !replaced) {
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
  // 🪦 `syncScopeOptions` 隨那顆下拉一起刪除（2026-08-30）。

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
    // 🔴 **內容全部住在這個 `<g>` 裡**——鏡頭（位移＋縮放）掛在它身上。
    //    SVG 本身佔滿視窗、不隨內容變大（Blockly 的做法）。
    this.viewport = document.createElementNS(SVG_NS, 'g')
    this.viewport.setAttribute('class', 'fc-viewport')
    this.svg.appendChild(this.viewport)
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
    // ⚠️ 內容尺寸只留給「適配」用——**SVG 自己不再隨它變大**。
    this.contentSize = { w: maxX + PAD, h: maxY + PAD }
    this.applyViewport()

    // 🪦 這裡曾經有一層 `fc-wire-tools`——線上那顆 ✕ 的家（為了畫在節點之上）。
    //    ✕ 退場之後它就空了，2026-08-30 一起刪掉。
    for (const w of g.wires) {
      const a = this.portAt(w.from.node, w.from.port)
      const b = this.portAt(w.to.node, w.to.port)
      if (!a || !b) continue
      // 貝茲：從出口往右、從入口往左——線的**方向**因此看得出來
      const dx = Math.max(36, Math.abs(b.x - a.x) * 0.5)
      const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`

      const wire = document.createElementNS(SVG_NS, 'g')
      const childEnd = this.childEndOf(w.from.node, w.to.node) ?? w.to.node
      wire.setAttribute('class', `fc-wire-g${this.isSelected('wire', childEnd) ? ' fc-sel' : ''}`)
      wire.setAttribute('data-wire', childEnd)

      const path = document.createElementNS(SVG_NS, 'path')
      path.setAttribute('class', `fc-wire fc-wire-${w.kind}`)
      path.setAttribute('d', d)
      wire.appendChild(path)

      if (this.capabilities.editable) {
        // 🔴 **一條看不見的粗線當命中區**——每一個認真的節點編輯器都這樣做。
        //    我們原本是 2px 的可視線本身可點：滑鼠已經難點，觸控幾乎不可能。
        //
        // > **一條線的【看起來多寬】與【按得到多寬】是兩件事，
        // > 而使用者按的是後者。**
        const hit = document.createElementNS(SVG_NS, 'path')
        hit.setAttribute('class', 'fc-wire-hit')
        hit.setAttribute('d', d)
        // 🔴 **用 `pointerdown`，不是 `click`**——這個檔案在 664 行早就記過
        //    同一個坑：「拖節點時 `click` 不會發生」。2026-08-30 實測，
        //    線上的 ✕ 用 `click` 掛的話**真實滑鼠按下去毫無反應**
        //    （而用 JS 直接派送 `click` 卻成功刪掉——處理器是好的，事件沒送到）。
        //
        // > **一個「用 JS 派送有效、用滑鼠按沒效」的處理器，
        // > 說的不是它壞了，是它掛在一個不會發生的事件上。**
        hit.addEventListener('pointerdown', (ev) => {
        // 🔴 **右鍵不進來**（2026-08-30 實測抓到）：右鍵的 `pointerdown` 若
        //    觸發選取，就會**重畫**，於是接下來要收 `contextmenu` 的那個元素
        //    **已經被換掉了**——選單因此永遠開不出來。
        //
        // > **在一個會重畫的畫布上，`pointerdown` 做的事會把 `contextmenu`
        // > 的收件人換掉。**
        if (ev.button === 2) return
          ev.stopPropagation()
          this.select('wire', this.childEndOf(w.from.node, w.to.node) ?? w.to.node)
        })
        // ⚠️ ✕ 已經不是這條線的後代了（它在最上面那一層），
        //    所以 hover 要**明說**要點亮哪一顆。
        hit.addEventListener('pointerenter', () => {
          this.svg.querySelector(`[data-wire-del="${childEnd}"]`)?.classList.add('fc-shown')
        })
        hit.addEventListener('pointerleave', () => {
          if (!this.isSelected('wire', childEnd)) {
            this.svg.querySelector(`[data-wire-del="${childEnd}"]`)?.classList.remove('fc-shown')
          }
        })
        const wt = document.createElementNS(SVG_NS, 'title')
        wt.textContent = msg('FLOW_SELECT_WIRE', '點一下選它，再按 ✕ 或 Delete 拿掉這一端')
        hit.appendChild(wt)
        wire.appendChild(hit)

        // 🪦 **線上的 ✕ 也退場了**（2026-08-30，與節點那顆同一個理由）：
        //    它在手機上只有 18px 直徑而且跟著縮放變小；而為了不讓它彈在
        //    游標底下還得抬高 16px——那是一個**在補一個不該存在的東西**。
        //
        // 🟢 改成長按／右鍵選單：選單是 DOM，**大小與縮放無關**。
        this.attachMenu(hit, 'wire', childEnd)
      }
      this.viewport.appendChild(wire)
    }
    for (const n of g.nodes) this.viewport.appendChild(this.renderNode(n))
  }

  private renderNode(n: GraphNode): SVGGElement {
    const at = this.posOf(n)
    const g = document.createElementNS(SVG_NS, 'g')
    const ghost = this.isGhostNode(n.id)
    g.setAttribute('class',
      `fc-node${n.id === this.highlighted ? ' fc-on' : ''}${ghost ? ' fc-ghost' : ''}` +
      `${this.isSelected('node', n.id) ? ' fc-sel' : ''}`)
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
      // 🔴 **骨架的欄位改不動**——「看得到、拆不壞」。
      //    ⚠️ 而它仍然**停在原地攔下 pointerdown**：少了這一句，
      //    點在欄位上會變成「拖整顆節點」，而那正是下面要擋掉的事。
      for (const target of [hit, el]) {
        target.addEventListener('pointerdown', (ev) => ev.stopPropagation())
        if (ghost) continue
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

    // 🪦 **節點上的 ✕ 退場了**（2026-08-30）——實測它在手機上只有 9×15 px，
    //    而且**跟著縮放一起變小**（縮到 80% 就剩 6×9）。改用長按／右鍵選單。
    const line = this.codeLineOf(n.id)
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent = line ? `${n.title}\n${line}` : n.title
    g.appendChild(title)

    // 🔴 **骨架照樣拖得動**——使用者 2026-08-30：
    //    「我是希望**淡的還是能移動**，只不過**彼此關係不能變**」。
    //
    // ⚠️ 這一格我第一版做錯了，因為把積木那一課直接套過來：
    //
    // ```
    // 積木視圖   位置【就是】結構——拖一塊積木會改變程式
    // 流程視圖   位置只是【排版】——拖一顆節點程式一個字都不會變（存進 flowLayout）
    // ```
    //
    // > **同一句「不能動」，在兩個視圖上禁的不是同一件事。**
    //
    // 🟢 所以這裡不擋拖曳，改在 `commitWire` 擋**關係的改變**。
    this.attachDrag(g, n.id)
    // 🔴 **長按（觸控）／右鍵（桌機）→ 選單**——那兩顆 ✕ 已經退場
    if (this.capabilities.editable && !ghost) this.attachMenu(g, 'node', n.id)
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
    // 🔴 **骨架不會被搬走**——`ghost` 模式下鎖的是【關係】，不是位置。
    //    ⚠️ 判的是「**被搬的那一顆**是不是骨架」，不是「有沒有碰到骨架」：
    //    學生把自己的節點接**進** `main` 仍然合法，那正是這個模式的用處。
    if (seq && this.isGhostNode(seq.moved.nodeId)) { this.refuse('scaffold-locked'); return }
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
    // 🔴 同上：被搬的是骨架就擋，而接**進**骨架合法
    if (this.isGhostNode(source.nodeId)) { this.refuse('scaffold-locked'); return }
    const verdict = tryConnect(this.tree, source.nodeId, target.nodeId, target.port.key)
    if (!verdict.ok) { this.refuse(verdict.reason); return }
    this.moveInto(source.nodeId, target.nodeId, verdict.slot)
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /**
   * **刪掉一顆節點與它的子樹。**
   *
   * ## 🔴 什麼可以刪、什麼不行
   *
   * ```
   * 住在【語句】插槽（body）   ✅ 拿掉一句話永遠合法——body 可以是空的 `{ }`
   * 住在【值】插槽             🔴 拒絕：那一格會變成空的，而 `if ()` 不是程式
   * 是骨架                     🔴 拒絕：ghost 鎖的就是「關係不能變」
   * ```
   *
   * ⚠️ 「值插槽可不可以空」**沒有人宣告過**——見 `slot-would-empty` 的說明。
   *
   * ## 而它敢做得這麼直接，是因為【還原】同一天做好了
   *
   * > **一個不能還原的刪除，使用者按下去之前要想三秒；
   * > 一個能還原的刪除，他敢試。**
   */
  private deleteNode(nodeId: string): void {
    if (!this.tree) return
    if (this.isGhostNode(nodeId)) { this.refuse('scaffold-locked'); return }
    const holder = this.slotOf(nodeId)
    if (!holder) return
    const bucket0 = (holder.parent.children[holder.slot] ?? []) as SemanticNode[]
    // 🔴 **判準是「那一格會不會變成空的」**，不是「它是不是語句」（2026-08-30 放寬）。
    //
    // 使用者要刪 `cout << "Hello!" << endl` 裡的 `endl`——它住在 `values` 這個
    // **列表**插槽，拿掉之後剩下 `cout << "Hello!";`，**完全合法**。
    // 第一版一律擋掉非語句插槽，於是那個合法的動作也被擋了。
    //
    // ```
    // 語句插槽（body）        ✅ 刪——body 可以是空的 `{ }`
    // 其他插槽而還剩 > 0 個   ✅ 刪——那一格不會變空
    // 其他插槽而會變空        🔴 拒絕——`if ()` 不是程式
    // ```
    const isBody = bodySlotsOf(holder.parent.componentId).includes(holder.slot)
    if (!isBody && bucket0.length <= 1) {
      this.refuse('slot-would-empty')
      return
    }
    const bucket = holder.parent.children[holder.slot] as SemanticNode[]
    bucket.splice(holder.index, 1)
    this.rebuild()
    this.editCb?.(this.tree)
  }

  /**
   * 這條線的**哪一端是孩子**——問樹，**不看線的方向**。
   *
   * 🔴 2026-08-30 使用者：「為何我只是把換行節點刪掉，就整個不見？」
   *
   * ```
   * 語句的線   from = 父（main）    to = 子（那一句）    → 子是 to
   * 資料的線   from = 值（換行）    to = 消費者（輸出）  → 子是 from ⚠️
   * ```
   *
   * 第一版一律刪 `w.to.node`，於是點「換行 → 輸出」那條線的 ✕，
   * **刪掉的是整句 `cout`**。
   *
   * > **線的方向講的是「資料往哪裡流」，
   * > 而包含關係講的是「誰住在誰裡面」——兩者在資料線上是相反的。**
   */
  private childEndOf(from: string, to: string): string | null {
    if (this.slotOf(to)?.parent.id === from) return to
    if (this.slotOf(from)?.parent.id === to) return from
    return null
  }

  /** 這顆節點住在誰的哪一格、第幾個。 */
  private slotOf(nodeId: string): { parent: SemanticNode; slot: string; index: number } | null {
    const walk = (n: SemanticNode): { parent: SemanticNode; slot: string; index: number } | null => {
      for (const [slot, bucket] of Object.entries(n.children ?? {})) {
        const i = (bucket ?? []).findIndex((c) => c.id === nodeId)
        if (i >= 0) return { parent: n, slot, index: i }
        for (const c of bucket ?? []) { const hit = walk(c); if (hit) return hit }
      }
      return null
    }
    return walk(this.tree!)
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
    const start = origin ?? this.wireFromPoint()
    if (!start) return
    const s0 = this.clientToContent(start.x, start.y)
    const s1 = this.clientToContent(e.clientX, e.clientY)
    const l = document.createElementNS(SVG_NS, 'line')
    l.setAttribute('class', 'fc-wire-preview')
    // ⚠️ 螢幕座標 → 內容座標（位移與縮放都要扣掉）
    l.setAttribute('x1', String(s0.x))
    l.setAttribute('y1', String(s0.y))
    l.setAttribute('x2', String(s1.x))
    l.setAttribute('y2', String(s1.y))
    this.viewport.appendChild(l)
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

  /**
   * **長按（觸控）／右鍵（桌機）→ 選單。**
   *
   * ## 🔴 取消一個「還沒燒完」的計時器，擋不住已經燒完的那一個
   *
   * 第一版只做了「移動超過門檻 → `clearTimeout`」，而註解寫著
   * 「⚠️ 長按要在移動超過門檻時取消，不然拖曳到一半會被判成長按」
   * ——那句話是對的，**而它只涵蓋一半的情況**。
   *
   * 使用者 2026-08-31：「手機的流程節點拖曳**常常**會誤認為右鍵」。
   * 用真的觸控事件量（`e2e/flow-touch-drag.spec.ts`）：
   *
   * ```
   * 按住 200ms 再拖  →  選單沒開，節點移動 120px   ✅
   * 按住 700ms 再拖  →  🔴 選單開了，而節點也移動了 120px
   * ```
   *
   * 手指按下去先停一下再走，是**手機上最自然的起手式**——而那 500ms
   * 在移動發生之前就燒完了。`clearTimeout` 這時已經無事可做。
   *
   * > **一個「取消待辦」的機制，對「已經發生的事」沒有任何效力
   * > ——而這兩種情況在程式碼裡長得一模一樣。**
   *
   * ## 判準：**移動贏**
   *
   * 手指開始走 ⟹ 這是一次拖曳，不管選單開了沒有。所以除了取消計時器，
   * 還要**把已經開出來的選單關掉**，讓拖曳接手。
   *
   * ⚠️ 反過來做（開了選單就不准拖）會更糟：節點那時已經跟著手指走了，
   * 而使用者要的是繼續走，不是回到原位。
   */
  private attachMenu(el: SVGElement, kind: 'node' | 'wire', id: string): void {
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      this.openMenu({ x: ev.clientX, y: ev.clientY }, kind, id)
    })
    el.addEventListener('pointerdown', (ev: PointerEvent) => {
      if (ev.pointerType !== 'touch') return
      const from = { x: ev.clientX, y: ev.clientY }
      let opened = false
      const timer = setTimeout(() => { opened = true; this.openMenu(from, kind, id) }, 500)
      // 🔴 **這一組必須掛在 `window` 上，不能掛在 `el` 上。**
      //
      // 拖曳的每一次移動都會 `paint()`，而 `paint()` **把整個 SVG 重建**
      // ——收到 `pointerdown` 的那顆元素當場被換掉，掛在它身上的監聽器
      // 跟著消失。實測（`e2e/flow-touch-drag.spec.ts` 的探針版）：
      //
      // ```
      // 節點收到 pointerdown=0  pointermove=0     ← 而節點確實移動了 120px
      // ```
      //
      // 第一版把取消掛在 `el` 上，於是**只有第一次移動來得及**：
      // 200ms 就開始走的手勢剛好被它擋掉，而先停 500ms 再走的
      // ——選單已經開了，而那時 `el` 早就不是原來那一顆。
      //
      // > **一個把狀態放在「會被重畫掉的元素」上的手勢處理器，
      // > 只在第一幀裡是對的。**
      //
      // ⚠️ `attachDrag` 的移動監聽掛在 `window` 上正是為了同一件事
      //    ——它的註解記著「手指一離開那顆節點就可能改發 `pointercancel`」。
      //    **同一個陷阱的兩個形狀。**
      const done = (): void => {
        clearTimeout(timer)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', done)
        window.removeEventListener('pointercancel', done)
      }
      const move = (e: PointerEvent): void => {
        if (e.pointerId !== ev.pointerId) return
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) <= 8) return
        // 🔴 **移動贏**：手指開始走 ⟹ 這是拖曳，不管選單開了沒有。
        //    ⚠️ 反過來（開了選單就不准拖）更糟——節點那時已經跟著手指走了。
        if (opened) { opened = false; this.closeMenu() }
        done()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', done)
      window.addEventListener('pointercancel', done)
    })
  }

  private attachDrag(g: SVGGElement, id: string): void {
    g.addEventListener('pointerdown', (ev: PointerEvent) => {
      // 🔴 **兩根手指是縮放，不是拖曳**——放手給畫布上的捏合處理
      if (this.pointers.size >= 1 && ev.pointerType === 'touch') return
      // 🔴 右鍵不拖曳——同上：它會把 `contextmenu` 的收件人換掉
      if (ev.button === 2) return
      ev.preventDefault()
      // 🔴 **擋住冒泡，不然畫布也會開始推**（2026-08-30 實測）：
      //    手指走 100px 而節點在畫面上走了 **200px**——節點自己走了 100，
      //    畫面又被推了 100。
      //
      // > **兩個手勢處理器掛在同一條冒泡路徑上，
      // > 使用者的一次動作會被算兩次。**
      ev.stopPropagation()
      // 🔴 **抓住這根指標**（2026-08-30）：在此之前是掛在 `window` 上聽，
      //    而觸控時手指一離開那顆節點，瀏覽器就可能改發 `pointercancel`
      //    ——症狀是「拖到一半節點自己停住」。
      try { g.setPointerCapture(ev.pointerId) } catch { /* 舊瀏覽器沒有就算了 */ }
      const start = { x: ev.clientX, y: ev.clientY }
      const node = this.graph?.nodes.find((n) => n.id === id)
      const base = node ? this.posOf(node) : { x: 0, y: 0 }
      let moved = false
      const move = (e: PointerEvent): void => {
        if (e.pointerId !== ev.pointerId) return
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) moved = true
        // ⚠️ **除以倍率**：縮到 0.5 時，手指走 100px 只該讓節點走 200 個 SVG 單位……
        //    不，是 200——而**不除的話它只走 100，看起來像「拖不動」**。
        this.offsets.set(id, {
          x: base.x + this.toSvgLen(e.clientX - start.x),
          y: base.y + this.toSvgLen(e.clientY - start.y),
        })
        this.paint()
      }
      const up = (): void => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        // 🔴 **按下去沒有移動 ＝ 選取**（2026-08-30）。
        //
        // 在此之前選取掛在 `click` 上，而**它永遠不會發**：
        // 上面那一行 `ev.preventDefault()` 會把相容的滑鼠事件
        // （`mousedown`／`mouseup`／`click`）一起壓掉。
        //
        // > **`preventDefault()` 在 `pointerdown` 上不只擋掉預設行為，
        // > 它把整條相容事件鏈都關掉了——包括你正要用的那一個。**
        if (!moved) this.select('node', id)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      // ⚠️ **`pointercancel` 也要收尾**——少了它，被瀏覽器取消的那一次
      //    會留下一組永遠不移除的監聽器。
      window.addEventListener('pointercancel', up)
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

  /**
   * **把手放過的位置存起來**——存的是**鑰匙**，不是 `nodeId`。
   *
   * 🔴 `nodeId` 重開之後**一個都不會留**（`generateId()` 帶著計數器與時戳），
   * 所以存 id 等於存一份下次讀不懂的東西。存下來的是那顆節點的三把鑰匙
   * （內容／行號／路徑），還原時用同一支配對器對回去。
   *
   * ⚠️ 只存**手放過的**。沒放過的節點由自動排版決定，存了只是雜訊
   * ——而且會讓 side-car 隨程式長度膨脹。
   */
  saveLayout(): PlacedEntry[] {
    if (this.offsets.size === 0) return []
    const nodes = this.keyedNodes()
    const keys = keysOfNodes(nodes)
    const out: PlacedEntry[] = []
    nodes.forEach((k, i) => {
      const at = this.offsets.get(k.node.id)
      if (at) out.push({ keys: keys[i], x: at.x, y: at.y })
    })
    return out
  }

  /**
   * **把存下來的位置放回去**。
   *
   * ⚠️ 對不回去的**就不放**——回自動排版。那是 `vision.md` 的驗收條款
   * 「**side-car 刪掉 ＝ 自動排版（不是壞掉）**」的同一條線：
   * 一份對不上的佈局與一份不存在的佈局，**結果必須一樣**。
   *
   * 🟢 而它**不需要 `codeHash` 那種失效條件**（`blocklyState` 需要）：
   * 這裡的鑰匙是內容比對，對不上自己就退回自動排版——**失效條件內建在配對裡**。
   */
  restoreLayout(entries: PlacedEntry[]): void {
    if (!Array.isArray(entries) || entries.length === 0) return
    // ⚠️ **掛起來，不要當場套**：還原時樹通常還沒到（它在 `syncCodeToBlocks`
    //    之後才進來）。當場套的話節點是空的，這一份就白丟了。
    //    🔴 而**時機不該由呼叫端猜**——呼叫端要知道「同步什麼時候完成」，
    //    那是一個它不該知道的東西。所以由面板自己在下一次有節點時套。
    this.pendingLayout = entries
    if (this.graph && this.graph.nodes.length > 0) this.applyPendingLayout()
  }

  private pendingLayout: PlacedEntry[] | null = null

  private applyPendingLayout(): void {
    const entries = this.pendingLayout
    if (!entries) return
    const nodes = this.keyedNodes()
    if (nodes.length === 0) return
    this.pendingLayout = null
    const pairs = matchByKeys(entries.map((e) => e.keys), nodes)
    for (const [i, nodeId] of pairs) {
      const e = entries[i]
      if (typeof e?.x === 'number' && typeof e?.y === 'number') {
        this.offsets.set(nodeId, { x: e.x, y: e.y })
      }
    }
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

// 🪦 `findNode` 隨那顆「整份程式」下拉一起退場（2026-08-30）——它唯一的
//    消費者是 `scopedRoot` 的收窄那一半，而收窄已經永遠是「整棵樹」了。

