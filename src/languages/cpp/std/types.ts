import type { ConceptDefJSON, BlockProjectionJSON } from '../../../core/types'

/**
 * 一個標準函式庫模組。
 *
 * ## ⚠️ **三條註冊路已經全部移除**（2026-08-11，F 完成之後的清掃）
 *
 * 原本這個介面有 `registerGenerators`／`registerLifters`／`registerExecutors`
 * 三個必填欄位，而檔頭寫著「**必填不是選填**——選填的話，忘了接上的模組會
 * 靜靜地少一條路」。那條紀律是對的，而它的前提消失了：
 *
 * **177 顆元件全部搬進膠囊之後，沒有任何模組還需要註冊任何東西**
 * ——五路都由膠囊自己帶（`component.json` 的 `paths`）。
 * 43 個註冊函式全部是空的，其中 38 個檔**除了那個空殼什麼都沒有**。
 *
 * > **一條「必填」的紀律，在它要防的東西消失之後，就只剩下 43 個殼。**
 *
 * 那三個欄位的紀律搬到了膠囊：`component.json` 的 `paths` 五路缺一不可，
 * 沒有那一路要寫 `null` ＋ `_why`（見 `core/component/paths.ts`）。
 *
 * ## 於是模組今天剩下什麼
 *
 * **一個名字，加上兩份可能是空的宣告。** 而名字**不是殘留**——
 * 它是工具箱段落的鍵（`toolbox-categories.ts` 的 `{ from: '<cstdio>' }`），
 * 而 `concepts`／`blocks` 是還沒膠囊化的元件的暫放處（今天全部是空的）。
 *
 * > **模組是搬家的中途站，不是終點——而中途站的最後一塊石頭是它的名字。**
 */
export interface StdModule {
  header: string
  /** ⚠️ 今天全部是空陣列。留著是因為第二個語言進來時它是暫放處。 */
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
}
