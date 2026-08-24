/**
 * **同步的三態**——誰是來源、暫停了沒、有沒有分岔。
 *
 * ## 為什麼是三態而不是「方向」
 *
 * 使用者 2026-08-24：「同步按鈕的部分我想要重新設計，因為加入了流程面板，
 * 會更加複雜。」而複雜的來源不是面板數量，是**舊的兩顆按鈕在做兩件事**：
 *
 * ```
 * (a) 現在同步一下   → 時機   自動同步開著時不必要
 * (b) 以這一邊為準   → 來源   兩邊分岔時無可取代
 * ```
 *
 * **方向是 N²，來源只有 N。**
 *
 * ## 🔴 而「來源是導出的」在暫停之後失效
 *
 * 第一版的設計是「誰最後被編輯就是來源」。使用者追問「會不會想暫停同步？」
 * 之後才看清楚：**暫停 → 兩邊都改 → 解除**，那時「最後編輯」是**任意的**，
 * 而系統會安靜地挑一個——那是替使用者做了一個他沒做的決定。
 *
 * > **有暫停，就一定要有手動來源；而分岔之後系統該【問】，不該【推】。**
 *
 * ```
 * live      來源是導出的（誰最後編輯）
 * paused    沒有來源——兩邊各自為政
 * diverged  🔴 停下來問，不自己挑一邊
 * ```
 *
 * ## ⚠️ 「暫停」今天真正在做的事，不是它的名字
 *
 * 最硬的場景是：**你改一行程式碼，積木重新 lift ——你排好的版面沒了。**
 * 而保住排版要用 `nodeId` 當鍵，那是**階段 5b 的前置**（`generateId()` 帶時間戳）。
 * 所以「暫停」是 5b 缺席的**代償**；nodeId 穩定之後它會縮小，**但不會消失**
 * （分岔那一個永遠在）。
 *
 * ## 為什麼住在核心
 *
 * 🔴 **兩個宿主都需要它**。我一度把它範圍成「只有網頁版」，理由是
 * 「VSCode 那側真相是文件，所以沒有『誰是來源』的問題」——**理由對，結論錯**：
 *
 * | | 網頁版 | VSCode／Theia |
 * |---|---|---|
 * | 來源是誰 | N 選一 | 文件永遠是來源（**只有這一格**我說對了） |
 * | 暫停 | 需要 | **同樣需要**：收到 `document` 就重 lift，排版當場沒了 |
 * | 分岔 | 需要 | **更常見**——文件還會被 git／別人／另一個編輯器改 |
 *
 * > **「其中一個問題在那邊不存在」推不出「這個機制在那邊不必要」。**
 *
 * ⚠️ 命名避開：`vscode-code-view` 已經有一個 `divergences`
 * （樂觀更新的鏡像對帳），**與這裡的分岔不是同一件事**。
 */

/** 封閉詞彙。⚠️ 第四個值出現時先問「它是不是一個新的相位」 */
export type SyncPhase = 'live' | 'paused' | 'diverged'

export interface SyncSnapshot {
  phase: SyncPhase
  /** 誰是來源。`null` ＝ 暫停中或分岔中——**沒有來源不是一種來源** */
  source: string | null
  /** 分岔時要給使用者選的那幾個 */
  candidates: string[]
}

export class SyncCoordinator {
  private paused = false
  private lastEdited: string | null = null
  /** 暫停期間被編輯過的視圖——**不能複用 dirty 旗標**，那些同步後會被清掉 */
  private editedWhilePaused = new Set<string>()
  /** 可編輯視圖的清單**由外面注入**——核心不認識任何一個具體的面板 */
  private listEditable: () => string[]

  constructor(listEditable: () => string[]) {
    this.listEditable = listEditable
  }

  /** 某個視圖被使用者編輯了 */
  noteEdit(viewId: string): void {
    this.lastEdited = viewId
    if (this.paused) this.editedWhilePaused.add(viewId)
  }

  isPaused(): boolean {
    return this.paused
  }

  pause(): void {
    this.paused = true
    this.editedWhilePaused.clear()
  }

  /**
   * 解除暫停。
   *
   * 🔴 **不自己挑來源**——暫停期間有兩個以上被改過時進入 `diverged`，
   * 由使用者選。挑一個等於替他做了決定。
   */
  resume(): void {
    this.paused = false
  }

  /** 使用者選定了來源——分岔結束 */
  resolve(viewId: string): void {
    this.editedWhilePaused.clear()
    this.lastEdited = viewId
    this.paused = false
  }

  /** 同步真的跑完了——清掉暫停期間的帳 */
  settled(): void {
    this.editedWhilePaused.clear()
  }

  snapshot(): SyncSnapshot {
    const candidates = this.listEditable()
    if (this.paused) {
      return { phase: 'paused', source: null, candidates }
    }
    // 暫停期間有兩個以上被改過 → 解除之後仍然要問
    if (this.editedWhilePaused.size > 1) {
      return { phase: 'diverged', source: null, candidates: [...this.editedWhilePaused] }
    }
    return { phase: 'live', source: this.lastEdited, candidates }
  }
}
