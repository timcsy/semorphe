/**
 * **桌機的佈局預設**——「這一刻要看見哪幾層」。
 *
 * ## 路線圖那條驗收的原話
 *
 * > 驗收：桌機**佈局預設**（專注／對照／三欄）＋ 可拖分隔線；**不做自由 docking**
 *
 * 而它的分界寫在同一項的標題下：
 *
 * > 🎯 **版面的分界不是「這是哪一類」，是「這東西怎麼被用」**：
 * > 取用要**相鄰**、認識要**面積**、狀態在**面板區**。
 *
 * ## 🔴 為什麼是「哪幾層」而不是「哪幾個面板」
 *
 * 2026-08-26 已經把「面板在哪裡」換成**面板宣告自己在哪一層**
 * （`concepts/理解的層次.md`：`element`／`relation`／`space`／`state`）。
 * 佈局預設如果列面板名字，**加一個面板就要改三個預設**
 * ——而那正是那一刀要消滅的形狀。
 *
 * > **預設列的是「看見哪幾層」，而哪個面板在那一層是面板自己說的。**
 *
 * ⚠️ `state`（主控台／變數）**不在這裡**：它的家是下方的面板區，
 * 三個預設都一樣。列它進來會讓「面板區」變成一個可以被佈局關掉的東西，
 * 而那與「程式在講話的地方」衝突。
 *
 * ## 為什麼不做自由 docking
 *
 * 路線圖明文排除。理由不在這一支裡而在那份 draft：自由 docking 讓
 * **每一個使用者的畫面都不一樣**，而這是一個教學工具
 * ——老師說「看左邊那一欄」時，那句話要對每個人都成立。
 */
import type { UnderstandingLayer } from '../view-host'

export type LayoutPresetId = 'focus' | 'compare' | 'three-column'

export interface LayoutPresetSpec {
  readonly id: LayoutPresetId
  /** 這個預設在**編輯區**攤開哪幾層，由左到右。 */
  readonly layers: readonly UnderstandingLayer[]
  /** 給人看的名字的 i18n 鍵——⚠️ **不得把 id 印上畫面**（第七十八條同一個原則）。 */
  readonly nameKey: string
}

/**
 * 三個預設。**由左到右就是順序**，而順序是 `LAYER_ORDER` 的子序列
 * ——不重排，因為那個順序是**理解的層次**不是偏好。
 */
export const LAYOUT_PRESETS: readonly LayoutPresetSpec[] = [
  // 專注：一次一層。⚠️ 哪一層由使用者現在看的那個分頁決定，不寫死。
  { id: 'focus', layers: [], nameKey: 'LAYOUT_PRESET_FOCUS' },
  // 對照：程式碼 ＋ 積木——**取用要相鄰**（同一段程式的兩個投影並排）
  { id: 'compare', layers: ['element', 'space'], nameKey: 'LAYOUT_PRESET_COMPARE' },
  // 三欄：再加上關係層（流程）——**認識要面積**
  { id: 'three-column', layers: ['element', 'relation', 'space'], nameKey: 'LAYOUT_PRESET_THREE' },
]

export function layoutPreset(id: LayoutPresetId): LayoutPresetSpec | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id)
}
