/**
 * **一種投影的宣告**（spec 170，2026-09-01）。
 *
 * ## 🔴 它從哪來
 *
 * 使用者：「面板可以模組化就更好了，說不定也可以像元件那樣有可擴充性」
 * 「**我的重點是要好維護管理**」。
 *
 * 而「不好維護」是量出來的：加第五種投影要動**八個既有檔**。
 *
 * > **一個東西如果要在七個地方各寫一次，那七個地方遲早會有一個沒跟上
 * > ——而它不會報錯。**
 *
 * ## 這是「宣告登記處」的第三次應用
 *
 * 元件（性狀由語言套件推進來）→ 目標（登錄表裝 cpp／arduino／板子）→ **面板**。
 * 三處的病是同一個：核心**知道它們叫什麼、也假設了它們有幾個**。
 */
import type { UnderstandingLayer } from '../view-host'
import type { HostProfile } from './host-profile'

/** 一個面板畫出來之後，外面拿得到的把手。 */
export interface PanelInstance {
  /** 銷毀。⚠️ 換版面時容器會被重建，而 Blockly 那種東西要自己收。 */
  readonly dispose?: () => void
  /** 版面變了 → 重新量。⚠️ Blockly／流程圖在 `display:none` 期間量到 0×0。 */
  readonly relayout?: () => void
  /** 這一格自己的東西——動作的 `run` 拿得到它。 */
  readonly view?: unknown
}

/** 畫這一格時，組裝點交給它的東西。 */
export interface PanelContext {
  readonly profile: HostProfile
  /** 翻譯。⚠️ 面板不自己 import i18n——那是組裝點的事。 */
  readonly msg: (key: string, fallback?: string) => string
}

/**
 * 那條頭上的一顆動作。
 *
 * ⚠️ **名字不在這裡**——名字一律由 `nameKey` 產生並排在最左，
 * 由同一支產生器保證（spec 170 的 SC-003）。
 */
export interface PanelAction {
  readonly id: string
  readonly labelKey: string
  readonly run: (inst: PanelInstance) => void
  /**
   * 這一刻它成不成立。
   *
   * 🔴 不成立時它**不該在**，而不是灰掉——
   * 「一個控制項如果在某個狀態下什麼都不做，那個狀態下它就不該在」。
   */
  readonly enabled?: (inst: PanelInstance) => boolean
}

export interface PanelSpec {
  /** ⚠️ 唯一。撞名時組裝點出聲（`panel-registry.ts`）。 */
  readonly id: string

  /**
   * 它屬於理解的哪一層。
   *
   * 🔴 **版面只認層**——這一格是宣告與版面之間的唯一接點。
   * ⚠️ 而**一層可以有多份宣告**（`state` 今天就有主控台與變數兩份）：
   *    那時它們是那一格的**分頁**，不是兩格。
   */
  readonly layer: UnderstandingLayer

  /** 層內的順序（小的在前）。⚠️ **不靠 glob 的鍵順序**——那個不保證。 */
  readonly order?: number

  /** 名字的 i18n 鍵。⚠️ 查不到時出聲，不得印出鍵名。 */
  readonly nameKey: string

  /** 這一格的頭上有哪些動作。沒有就沒有——那條頭仍然會有名字。 */
  readonly head?: readonly PanelAction[]

  /**
   * 這個宿主上它存不存在。
   *
   * 🔴 問**能力**不問宿主的名字（P9／第六十條護欄）：
   * `profile.features.codeEditorPane`，不是 `profile.id === 'vscode'`。
   */
  readonly availableIn?: (profile: HostProfile) => boolean

  /**
   * 怎麼把它畫出來。
   *
   * 🔴 **刻意是函式不是資料**。一個面板真正獨特的正是這一格。
   *
   * > **宣告該吃掉的是【重複的那些】，不是【真的不一樣的那個】。**
   */
  readonly mount: (container: HTMLElement, ctx: PanelContext) => PanelInstance
}
