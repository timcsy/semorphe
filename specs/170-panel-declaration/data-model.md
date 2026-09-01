# Phase 1：資料模型

## PanelSpec —— 一種投影的宣告

```ts
interface PanelSpec {
  /** 這一種投影叫什麼。⚠️ 唯一，撞名時組裝點出聲。 */
  readonly id: string

  /** 它屬於理解的哪一層。🔴 版面只認層——這一格是宣告與版面之間的接點。 */
  readonly layer: UnderstandingLayer

  /** 名字的 i18n 鍵。⚠️ 查不到時出聲，不得印出鍵名。 */
  readonly nameKey: string

  /**
   * 這一格的頭上有哪些動作。
   * ⚠️ **名字不在這裡**——名字一律由 `nameKey` 產生並排在最左，
   *    由同一支產生器保證（SC-003）。
   */
  readonly head?: readonly PanelAction[]

  /** 這個宿主上它存不存在。⚠️ 問**能力**不問宿主的名字。 */
  readonly availableIn?: (profile: HostProfile) => boolean

  /**
   * 怎麼把它畫出來。🔴 **刻意是函式不是資料**。
   *
   * > 宣告該吃掉的是【重複的那些】，不是【真的不一樣的那個】。
   */
  readonly mount: (container: HTMLElement, ctx: PanelContext) => PanelInstance
}

interface PanelAction {
  readonly id: string
  readonly labelKey: string
  readonly run: (inst: PanelInstance) => void
  /** ⚠️ 有些動作只在某些狀態下有意義——**不成立時它不該在**（第 …條的判準）。 */
  readonly enabled?: (inst: PanelInstance) => boolean
}
```

## ⚠️ 一層可以有多份宣告

`state` 那一層今天有**兩個內容**（主控台／變數）。所以：

```
宣告 → 層    是多對一，不是一對一
版面 → 層    仍然一對一（areas 的格子是層）
一格 → 宣告  那一層的所有宣告，成為那一格的分頁
```

🟢 這剛好與今天的行為逐字相同（下方面板的兩個分頁），
而它讓「一層一格」與「主控台有兩頁」**同時成立而不互相打架**。

## 登錄表

```
build-time：import.meta.glob('/src/panels/*/panel.ts', { eager: true })
順序：       🔴 不靠 glob 的鍵順序（language-packs.ts:186 記過那個病）
             由 LAYER_ORDER 決定層的順序，層內由宣告的 order 決定
```

## 狀態遷移

沒有。宣告是**不變的資料**；會變的是「這個宿主上哪些可見」，
而那是 `availableIn` 的純函數，不是狀態。
