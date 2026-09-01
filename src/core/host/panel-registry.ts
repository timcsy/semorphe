/**
 * **面板登錄表**——核心問它「有哪些投影」（spec 170）。
 *
 * ## 🔴 核心可以問什麼、不可以問什麼
 *
 * ```
 * allPanels()          有哪些投影（照 LAYER_ORDER 排）
 * panelsOfLayer(l)     這一層有哪些 → 那一格的分頁
 * panelsFor(profile)   這個宿主上有哪些
 * layersOf(profile)    這個宿主上有哪幾層 ← layout-presets 吃它
 *
 * panelById('blocks')  ⚠️ 允許，而**組裝點以外不得用**——那正是今天的病
 * ```
 *
 * > **核心可以知道「有這種投影」，不該知道它叫什麼、也不該假設它有幾個。**
 * > （`concepts/宣告登記處.md`，第三次應用）
 *
 * ## ⚠️ 它不自己去 glob
 *
 * 收集在 `load-panels.ts`，而這裡只收「有人推進來的那些」。
 * 🔴 理由與元件登錄表同一條：**這一層要測得到，而 `import.meta.glob`
 * 在 Vitest 的 node 環境下行為不同**。
 */
import { LAYER_ORDER, type UnderstandingLayer } from '../view-host'
import type { HostProfile } from './host-profile'
import type { PanelSpec } from './panel-spec'

const panels: PanelSpec[] = []

/** 組裝點推一份宣告進來。⚠️ 撞名要出聲——見 `assertPanelsSane`。 */
export function registerPanel(spec: PanelSpec): void {
  panels.push(spec)
}

/** ⚠️ 只給測試用——真實路徑上登錄表只增不減。 */
export function resetPanelsForTest(): void {
  panels.length = 0
}

/**
 * 全部，照 `LAYER_ORDER` 排，層內照 `order`。
 *
 * 🔴 **不靠 glob 的鍵順序**——`language-packs.ts:186` 記過那個病：
 * 「`import.meta.glob` 的鍵順序不保證，而**選單順序是設計出來的**」。
 */
export function allPanels(): readonly PanelSpec[] {
  return [...panels].sort((a, b) => {
    const d = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer)
    return d !== 0 ? d : (a.order ?? 0) - (b.order ?? 0)
  })
}

/**
 * 這一層有哪些。
 *
 * ⚠️ **可能不只一個**——`state` 今天就有主控台與變數兩份。
 * 那時它們是那一格的**分頁**，不是兩格。
 */
export function panelsOfLayer(layer: UnderstandingLayer): readonly PanelSpec[] {
  return allPanels().filter((p) => p.layer === layer)
}

/** 這個宿主上有哪些。⚠️ 問**能力**不問宿主的名字。 */
export function panelsFor(profile: HostProfile): readonly PanelSpec[] {
  return allPanels().filter((p) => p.availableIn?.(profile) ?? true)
}

/** 這個宿主上有哪幾層（照 `LAYER_ORDER`，去重）。`layout-presets` 吃它。 */
export function layersOf(profile: HostProfile): readonly UnderstandingLayer[] {
  const live = new Set(panelsFor(profile).map((p) => p.layer))
  return LAYER_ORDER.filter((l) => live.has(l))
}

/** ⚠️ 組裝點以外不得用——見檔頭。 */
export function panelById(id: string): PanelSpec | undefined {
  return panels.find((p) => p.id === id)
}

/**
 * **組裝點的健檢**——四種情形都要出聲。
 *
 * 🔴 而第四種（一份宣告都沒有）是**入口條件**：沒有它的話，glob 壞掉時
 * 整個應用會安靜地變成空白。
 *
 * > **一個沒有人宣告的登記處【就是殼】，而它綠得跟真的一樣。**
 * > （`concepts/執行機構.md`）
 *
 * @param hasTranslation 這個鍵翻得出來嗎——⚠️ 注入進來，這一層不 import i18n
 * @returns 每一條問題一句話；空陣列 ＝ 健康
 */
export function assertPanelsSane(
  hasTranslation: (key: string) => boolean = () => true,
): readonly string[] {
  const problems: string[] = []
  if (panels.length === 0) {
    problems.push('🔴 一個面板都沒有登記——`import.meta.glob` 沒吃到東西，'
      + '而畫面會是空白的而不報錯。')
    return problems
  }
  const seen = new Set<string>()
  for (const p of panels) {
    if (seen.has(p.id)) problems.push(`🔴 面板 id 撞名：「${p.id}」`)
    seen.add(p.id)
    if (!LAYER_ORDER.includes(p.layer)) {
      problems.push(`🔴 面板「${p.id}」的層認不得：「${p.layer}」`
        + `——登錄的層：${LAYER_ORDER.join('、')}`)
    }
    if (!hasTranslation(p.nameKey)) {
      problems.push(`🔴 面板「${p.id}」的名字沒有翻譯：「${p.nameKey}」`)
    }
  }
  return problems
}
