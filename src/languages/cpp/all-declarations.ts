/**
 * 全部宣告的**唯一組裝點**——通用 ＋ 核心 ＋ std 模組
 *
 * ## 為什麼這個檔存在
 *
 * 在此之前，`app.ts`、`module.ts` 與測試 helper **各自組裝一次**同一份清單。
 * 三份看起來一樣，而其中兩份載入的是**沒有蓋 `owner` 章的原始 JSON**——
 * 於是工具箱的每個 `(universal)` 段落在正式路徑上回傳零筆，
 * **通用積木整批從工具箱消失，而全套測試是綠的**（測試走的是蓋過章的那份）。
 *
 * 那正是這個專案的頭號病，在同一輪裡又發生一次：
 * **一支測著另一條路徑的測試，綠燈與測著正式路徑的長得一模一樣。**
 *
 * → 組裝只留一份。測試與 production 用同一個函式，**就不可能分歧**
 *   （「與其偵測錯誤，不如換一個讓錯誤無法被表達的形式」）。
 */
import type { ConceptDefJSON, BlockProjectionJSON } from '../../core/types'
import { universalConcepts, universalBlocks } from '../../blocks/universal'
import { coreConcepts, coreBlocks } from './core'
import { allStdModules } from './std'

export function allCppConcepts(): ConceptDefJSON[] {
  return [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap((m) => m.concepts)]
}

export function allCppProjections(): BlockProjectionJSON[] {
  return [...universalBlocks, ...coreBlocks, ...allStdModules.flatMap((m) => m.blocks)]
}
