/**
 * `cpp:map_declare` 的 **lift** 路——**兩筆資料：「`map` 與 `unordered_map` 這兩個型別名屬於我」**
 *
 * 原本住在 `pending-containers.ts` 的過渡表裡。那張表的檔頭寫著
 * 「每搬一顆進膠囊，就從這裡刪掉一列。這張表歸零的那天就刪掉這個檔」
 * ——**這一批就是那一天。**
 *
 * ## 🔴 `unordered_map` 一度不在這張表上（2026-09-17 補，語料 5 支）
 *
 * 沒登錄的症狀**不是**「少一顆積木」：它掉到一般變數宣告那條路，
 * 於是 `m[3] = 7` 被當成陣列的第 3 格 ⟹ `INDEX_OUT_OF_RANGE`。
 * 學生看到的是一個指著他沒寫錯的那一行的索引錯誤。
 *
 * ⚠️ 走訪順序：真的 `unordered_map` **順序是未指定的**，所以這個直譯器
 * 挑一個確定的（與 `map` 同樣有序）。🔴 **那一項不得進判準**——
 * 拿參照編譯器比走訪順序，量到的會是「我們有沒有跟 g++ 做出同一個未指定的選擇」。
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('map', 'cpp:map_declare', 'cpp/map_declare', { ordered: 'true' })
  registerContainerTemplate('unordered_map', 'cpp:map_declare', 'cpp/map_declare', { ordered: 'false' })
  /**
   * 🔴 **`multimap` 是第三個名字**（2026-09-18，盲測抓到）——一個鍵可以有多個值。
   *
   * 沒登錄的症狀與 `unordered_map` 那次一模一樣：它掉到一般變數宣告，
   * 於是 `mm.emplace(k, v)` 說「`mm` 不是集合或對照表」。
   *
   * ⚠️ 「一個鍵可以有幾個值」是**容器的性質**，所以它跟著宣告走
   * （與同族集合那顆的重複性同一個做法）。
   */
  registerContainerTemplate('multimap', 'cpp:map_declare', 'cpp/map_declare',
    { ordered: 'true', unique: 'false' })
}
