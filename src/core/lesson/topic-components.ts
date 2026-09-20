/**
 * **這個主題有哪些積木**——一張平的清單。
 *
 * ## 🪦 它取代了 `level-tree.ts`（2026-09-20）
 *
 * 舊的那個檔有六支匯出（`getVisibleComponents`／`flattenLevelTree`／
 * `levelNodesWithDepth`／`resolveEnabledBranches`／`validateDoublingGuideline`／
 * `isComponentVisible`），而它們全部在服務**同一件事**：
 * 「把一棵層級樹 ＋ 一個已啟用分支的集合，算成一個可見集合」。
 *
 * 使用者（2026-09-20）：「我們現在已經有課程了，應該就沒有需要再用 levelTree 了吧」
 *
 * 🔴 **而那句話是對的，理由在資料裡**：工具箱的內容本來是
 * `levelTree ∩ 已啟用分支 ∩ 當前那一課`，而中間那一項與第三項**是同一件事做兩次**。
 * 做兩次的那一次會靜默吃掉另一次說要的東西——實測 `arduino/13-溫濕度`
 * 宣告了 `cpp:container_iter` 而 levelTree 沒有，於是那一課的學生拿不到它。
 *
 * > **兩個機制回答同一個問題的時候，答案不一致是遲早的；
 * > 而先出聲的那一個，通常不是對的那一個。**
 *
 * ## ⚠️ 為什麼清單本身留著
 *
 * 「這個主題有哪些積木」**不是**分層——C 與 Arduino 是不同的世界。
 * 而它今天是唯一擋住「C 目標拿得到 `vector`／`class`／`cout`」的東西
 *（`Target.provides` 逐字「本輪沒做」）。見 `core/types.ts` 的 `Topic.components`。
 */
import type { Topic } from '../types'

/** 這個主題的全部積木。**自由模式就是這一份**。 */
export function topicComponents(topic: Topic): Set<string> {
  return new Set(topic.components)
}

/** 這顆元件屬於這個主題嗎。 */
export function isComponentInTopic(componentId: string, topic: Topic): boolean {
  return topic.components.includes(componentId)
}
