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
// 元件膠囊——一顆一個資料夾，`import.meta.glob` 掃出來。
// 加一顆元件不必編輯這個檔（那正是元件化要買的東西）。
import { componentConcepts, componentBlocks, componentBlocksNotIn } from '../../core/component/registry'
// ⚠️ **副作用匯入**：這兩份模組在載入時登錄自己的身分改名表（v2 → v3）。
// 掛在這個組裝點上，是因為它已經是「所有宣告的唯一入口」（spec 100）——
// 忘了匯入的話存檔會靜靜地不轉換，而 `audit-identity-namespace` 的涵蓋率檢查會指名。
import '../../blocks/id-migrations'
import './id-migrations'


export function allCppConcepts(): ConceptDefJSON[] {
  return [
    ...universalConcepts,
    ...coreConcepts,
    ...allStdModules.flatMap((m) => m.concepts),
    ...(componentConcepts() as unknown as ConceptDefJSON[]),
  ]
}

export function allCppProjections(): BlockProjectionJSON[] {
  return [
    ...universalBlocks,
    ...coreBlocks,
    // ⚠️ **元件的積木要併進它 owner 的段落，不能接在最後面。**
    //
    // 工具箱的順序就是這個陣列的順序（E 項：「把一顆積木放進 blocks.json 的
    // 正確位置，它在工具箱裡就會出現在正確的位置」）。接在最後面的話，
    // `cpp_vector_declare` 會從「陣列與列表」分類的第一個掉到最後一個——
    // **測試會抓到順序變了，但使用者感覺到的是「建立列表」不見了**。
    //
    // ⚠️ **未解**：同一個 owner 底下有兩顆以上元件時，它們之間的順序沒有來源。
    //   現在是照身分字母序，那不是教學順序。見 specs/104 的卡點 4。
    ...allStdModules.flatMap((m) => [
      ...(componentBlocks(m.header) as BlockProjectionJSON[]),
      ...m.blocks,
    ]),
    // ⚠️ **其餘的接在最後**——原本寫 `componentBlocks(null)`，只涵蓋「沒有 owner」的。
    // 而核心元件的 owner 是 `(core)`——**不是 std 模組，也不是 null**，兩邊都漏掉，
    // 症狀是「一顆剛搬好的元件看起來像被刪掉了」（第三顆膠囊實測）。
    // **列舉已知的 owner，等於保證下一個新 owner 會被漏掉。**
    ...(componentBlocksNotIn(allStdModules.map((m) => m.header)) as BlockProjectionJSON[]),
  ]
}
