import type { SemanticNode } from './types'
import type { Diagnostic } from './diagnostics'
import type { ExecutionStatus, StepInfo } from '../interpreter/types'
import type { CodeMapping } from './projection/code-generator'
import type { ScaffoldResult } from './program-scaffold'

// ─── View Configuration ───

export interface ViewConfig {
  language: string
  style?: Record<string, unknown>
}

// ─── View Capabilities ───

/**
 * **理解的四個層次**——`concepts/理解的層次.md`。
 *
 * 🔴 **這不是「偏好」，也不是名次。** 使用者 2026-08-24 逐字：
 *
 * > 「程式碼、流程、積木、主控台這個順序是我用**元素、關係、空間、動力**
 * >  來思考，**代表理解的不同層次**……**不是誰比較重要**」
 *
 * ```
 * 元素  有哪些東西        程式碼        token／嵌入
 * 關係  誰跟誰有關        流程          attention
 * 空間  怎麼被擺在一起    積木          表示空間
 * 狀態  現在裡面裝了什麼  主控台／變數  殘差流
 * ```
 *
 * ⚠️ **為什麼宣告的是「層」而不是「位置」**：位置是宿主的詞彙
 * （VSCode 有 `activityBar`／`panel`，網頁版有分頁與分割線，第三個宿主又不一樣）。
 * 而**層次是這個系統自己的語義**，兩個宿主都翻譯得出來。
 *
 * > **一個宣告如果用了宿主的詞彙，那它就只對那一個宿主成立。**
 *
 * 🔴 而它**有序**——那個順序不能由各個面板各說各話決定，
 * 所以這裡是一個**封閉的列舉**，不是一個字串。
 */
export type UnderstandingLayer = 'element' | 'relation' | 'space' | 'state'

/** 四層的正規順序——`layer` 的宣告值就是它的位置，宿主不必自己排。 */
export const LAYER_ORDER: readonly UnderstandingLayer[] = ['element', 'relation', 'space', 'state']

export interface ViewCapabilities {
  editable: boolean
  needsLanguageProjection: boolean
  consumedAnnotations: string[]
  /**
   * **這個視圖在哪一層**（2026-08-26）。
   *
   * 在此之前「哪個面板放哪裡」寫死在**兩個宿主各一份**
   * （`ui/layout/mobile-tab-bar.ts` 的 `TABS`、`ui/app-shell.ts` 的容器 id）
   * ——加第三個宿主就是第三份。
   *
   * ⚠️ **選用**：一個不屬於任何理解層次的視圖（例如將來的設定面板）
   * 不必假裝有——**而那正是 `undefined` 該說的話**。
   */
  layer?: UnderstandingLayer
}

// ─── Events: Core → View ───

/**
 * ⚠️ **這個型別在 2026-08-12 之前只有 `tree` 一個欄位**，而匯流排上的
 * `'semantic:update'` 有六個。同一個事件，兩份宣告。
 *
 * 症狀不是型別錯誤——是**每個面板在自己的方法簽名上手動補回缺的欄位**：
 *
 * ```ts
 * onSemanticUpdate(event: SemanticUpdateEvent & { source?: string; code?: string; … })
 * ```
 *
 * > **一份不完整的契約不會擋住任何人，它只會讓每個實作者各自補一次
 * > ——而他們補的不一樣。**
 *
 * （`monaco-panel` 補了 `source`／`code`／`scaffoldResult`，
 * 沒補 `mappings`，於是它**看不到那個欄位存在**。而 `mappings` 正是它
 * 把「執行到哪個節點」翻成行號所需要的東西。）
 *
 * 現在契約是唯一定義，`semantic-bus` 引用它。
 */
export interface SemanticUpdateEvent {
  tree: SemanticNode
  code?: string
  blockState?: unknown
  source: 'blocks' | 'code' | 'resync'
  /**
   * **這次更新是誰改出來的**（那個視圖的 `viewId`）。
   *
   * ## 🔴 為什麼 `source` 不夠（2026-08-27，使用者：「流程和積木好像沒有同步到」）
   *
   * `source` 只有三個值，而其中的 `'blocks'` 一直被當成「樹被某個視圖改了」用。
   * 積木面板據此**跳過**那種更新（那是它自己的編輯，重畫會打斷拖曳）：
   *
   * ```ts
   * if ((event.source === 'code' || event.source === 'resync') && event.blockState) …
   * ```
   *
   * 而流程面板 2026-08-26 也開始送 `edit:tree` 之後，`handleEditTree` 仍然
   * 寫死 `source: 'blocks'`——**於是積木把流程的編輯當成自己的，跳過了**。
   * 實測：在流程改一個變數名，程式碼與流程都變了，**而積木上還寫著舊名字**。
   *
   * > **一個用「哪一類視圖」當來源的欄位，在第二個同類視圖出現的那天
   * > 會把別人的編輯認成自己的。**
   *
   * ⚠️ 修法**不是**讓核心去認某一顆面板的名字（那會踩到 P9 視圖獨立性），
   * 而是把「誰改的」如實傳下去，**由每個視圖自己判斷那是不是它自己**。
   */
  originViewId?: string
  mappings?: CodeMapping[]
  scaffoldResult?: ScaffoldResult
}

/**
 * ⚠️ **`reason` 存在的理由：讓「顯示什麼字」留在視圖裡。**
 *
 * 在此之前執行器直接呼叫 `consolePanel.setStatus(Blockly.Msg['EXEC_STATUS_RUNNING'] || 'Running', 'running')`
 * ——**24 處**，而那 24 處只有 8 種狀態。執行器在替視圖決定文案、決定 CSS class、
 * 甚至決定要查哪一個 i18n 鍵。
 *
 * > **一個知道對方要顯示什麼字的發送端，換不掉那個接收端。**
 *
 * 拆法是「真實／為什麼」兩層：`status` 是直譯器**真的處在哪個狀態**
 * （它本來就有這個型別），`reason` 是**為什麼**。8 種 UI 狀態落在 5×reason 上：
 *
 * | 今天顯示 | status | reason |
 * |---|---|---|
 * | Ready | `idle` | — |
 * | Running | `running` | — |
 * | Waiting for input... | `running` | `awaiting-input` |
 * | Paused | `paused` | — |
 * | Paused (breakpoint) | `paused` | `breakpoint` |
 * | Completed | `completed` | — |
 * | Interrupted | `idle` | `aborted` |
 * | Error | `error` | — |
 *
 * ⚠️ **詞彙是封閉的**——三個值。第四個值出現時要先問「它是不是一個新的 `status`」，
 * 而不是順手加進來（`components/執行機構.md:263` 的同一條：
 * 「宣告需要門檻……第三個值就是在替『還沒做』找一個體面的名字」）。
 */
/**
 * 執行為什麼停下來。
 *
 * ⚠️ `refused` 與其他三個**性質不同**：那三個是「跑到一半停下來」，
 * 而 `refused` 是**根本沒有開始**——語法錯誤的程式被攔在執行之前
 * （2026-08-14，spec `120`）。視圖若把它們一視同仁，
 * 使用者會看到「程式中止」而不是「程式還不能執行」。
 */
/**
 * ⚠️ 這是一份**封閉詞彙**——加值的門檻見 `concepts/執行機構.md:279`。
 *
 * 🔴 `'unknown-component'`（2026-08-26）：**跑到一個我們看不懂的東西，停在那裡**。
 * 使用者逐字：「跑到那邊要有斷點，讓使用者調整完狀態才能繼續跑下去，或是直接停止」。
 * 它與 `'breakpoint'` **走同一條暫停路，而理由不同**——前者是使用者放的，
 * 這一個是系統自己撞到的，而畫面上要說得出差別。
 */
export type ExecutionReason =
  | 'awaiting-input'
  | 'breakpoint'
  | 'unknown-component'
  | 'aborted'
  | 'refused'

export interface ExecutionStateEvent {
  status: ExecutionStatus
  step?: StepInfo
  reason?: ExecutionReason
}

/**
 * **執行走到了某個語義節點。**
 *
 * ⚠️ 這個事件存在的理由，是它取代的那段程式碼：
 *
 * ```ts
 * const mapping = syncController.getMappingForNode(nodeId)   // { blockId, startLine, endLine }
 * if (mapping.blockId)   blocklyPanel.highlightBlock(mapping.blockId, 'execution')
 * if (mapping.startLine) monacoPanel.revealLine(mapping.startLine + 1)
 * ```
 *
 * 執行器同時說了兩遍，**因為它知道有兩個視圖**。而那張中央對映表
 * 回傳的是兩個視圖的座標——加第三個視圖要改它的型別。
 *
 * > **一張「什麼都查得到」的中央對映表，就是視圖清單的另一種寫法。**
 *
 * 唯一真實是「執行到哪個節點」；積木高亮一顆積木、程式碼捲到一行、
 * 2D 接線圖讓一顆元件發光——**那是三個投影，不是三個命令**。
 *
 * - `nodeId: null` ＝ **清除**（執行結束／等待輸入前的清場）。
 * - `follow` ＝ 這一步使用者要不要跟著看。⚠️ 它**不是**「你要捲動」——
 *   對 2D 視圖它可以是「把鏡頭移過去」。開關長在除錯工具列上，
 *   而**開關在哪裡就說明了它屬於誰**：那是對「執行」的指令，不是視圖設定。
 */
export interface ExecutionAtNodeEvent {
  nodeId: string | null
  follow: boolean
}

// ─── ViewHost Interface ───

/**
 * **一個可編輯視圖這一側的真相**——形狀由視圖自己宣告。
 *
 * 🔴 兩種形狀不是實作細節，是**真的不一樣**：積木手上就是結構，
 * 程式碼手上是文字而樹要靠解析。見 `ViewHost.readSource` 的說明。
 */
export type EditableSource =
  | { kind: 'tree'; tree: SemanticNode }
  | { kind: 'code'; code: string }

export interface ViewHost {
  readonly viewId: string
  readonly viewType: string
  readonly capabilities: ViewCapabilities

  initialize(config: ViewConfig): Promise<void>
  dispose(): void

  onSemanticUpdate(event: SemanticUpdateEvent): void
  onExecutionState(event: ExecutionStateEvent): void

  /**
   * 執行走到了某個節點。**可選**——不是每個視圖都在意。
   *
   * ⚠️ 它是可選的而不是「必要但可以空實作」，理由是這個專案的頭號病：
   * **一個空樁與一個「我不接這個事件」的宣告，在程式碼裡長得一樣，
   * 而在意圖上完全相反。** 沒有這個方法 ＝ 明確地不接。
   */
  onExecutionAtNode?(event: ExecutionAtNodeEvent): void

  /**
   * **交出這個視圖這一側的真相**——`capabilities.editable` 的另一半。
   *
   * ## 為什麼它非得是契約不可
   *
   * `editable` 這個旗標宣告了「這個視圖可以當**真相來源**」，而它有九個消費者
   * （同步協調器、`以此為準` 的 QuickPick、狀態列、VSCode 主行程…），
   * 還有第六十二條護欄盯著「同步的入口不得硬編視圖的名字」。
   *
   * 🔴 **而在此之前「拿東西出來」那一步靠叫一個具體面板的名字**：
   * `app.ts` 三處逐字 `this.blocklyPanel?.extractSemanticTree()`。
   *
   * > **一個能力旗標宣告了「這個視圖可以當真相來源」，
   * > 而拿東西出來那一步靠叫一個具體面板的名字
   * > ——那個旗標在替一個不存在的契約背書。**
   *
   * ## 🔴 為什麼回的是一個【判別聯集】，而不是一棵樹
   *
   * 第一版寫成 `extractSemanticTree(): SemanticNode`，而護欄第一次跑就抓到：
   * **`monaco-panel` 宣告 `editable: true` 而它交不出樹**。
   *
   * ```
   * 積木     手上就是結構      → 交【樹】     syncBlocksToCode(tree, …)
   * 程式碼   手上是文字         → 交【文字】   syncCodeToBlocks(code) ——樹由管線解析
   * ```
   *
   * > **「可以當真相來源」與「手上有一棵樹」是兩件事，
   * > 而把它們合成一個方法，會逼其中一種視圖說謊。**
   *
   * ⚠️ 流程面板將來是**樹形**的那一種（與積木同側）。
   *
   * ## ⚠️ 可選，而它的可選有一個【硬性】的意思
   *
   * 與 `onExecutionAtNode` 那種「我不接這個事件」不同：
   * **宣告 `editable: true` 就必須有這個方法**（第七十九條護欄的硬性零）。
   * 可選是給 `editable: false` 的視圖（主控台、變數）用的。
   */
  readSource?(): EditableSource | null

  /**
   * 診斷變了。**可選**——理由與 `onExecutionAtNode` 同一條：
   * 沒有這個方法 ＝ 明確地不接（主控台、變數面板不需要）。
   *
   * ⚠️ 它是**廣播**不是命令：狀態變了，誰想知道誰聽。
   * 所以**不該**是 `monacoPanel.showSquiggle(...)`——那會讓執行端知道
   * 每個視圖該畫什麼，而那正是 `execution:at-node` 那次收攏掉的東西。
   */
  onDiagnostics?(event: DiagnosticsEvent): void
}

/**
 * 一次診斷的結果。空陣列 ＝ 沒有問題（**不是**「沒有跑」）。
 *
 * ⚠️ **不帶組好的訊息**（2026-08-14 起）：帶的是規則身分與參數，
 * 由各視圖自己組裝。一個組好的字串等於把投影的結果當真實傳下去，
 * 而那讓兩個視圖只能說同一句話。
 */
export interface DiagnosticsEvent {
  /**
   * 🔴 **直接用 `Diagnostic`，不再內嵌一份結構型別。**
   *
   * ⚠️ 這裡原本手寫了一份**逐欄相同**的內嵌型別，而它的註解自己記著那個病：
   *
   * > 「判定來源。⚠️ **這一格 2026-08-14 加上時 tsc 一聲不吭**——
   * > 這個內嵌型別是**另一份宣告**，結構上寬鬆地接受了多出來的欄位。
   * > 少了它視圖就讀不到來源，而編譯器不會說。」
   *
   * 2026-08-19（spec 143）加 `at` 時**撞到同一件事**：`diagnostics.ts` 加了，
   * 而視圖讀不到——**tsc 這次出聲了，因為讀的那一端型別對不上**。
   *
   * > **一份「逐欄抄過來」的型別，它的第一個症狀不是型別錯誤，
   * > 是【加一格的人以為自己加完了】。**
   *
   * 引用而不是抄一份之後，下一次加欄位就只有一個地方。
   */
  diagnostics: readonly Diagnostic[]
}
