/**
 * 把每一個語言套件載進來——**加一個語言＝加一個資料夾**。
 *
 * ## 🔴 為什麼它不能住在 `language-packs.ts` 裡
 *
 * `import.meta.glob(..., { eager: true })` 被 Vite **提升成靜態 import**。
 * 把它寫在登記表那個檔裡的話，`pack.ts` 會在
 *
 * ```ts
 * const PACKS = new Map()     // ← 還沒跑到這一行
 * ```
 *
 * **之前**就執行，於是 `declareLanguagePack` 撞上
 * `ReferenceError: Cannot access 'PACKS' before initialization`。
 *
 * > **一個登記表不能自己 glob 自己的宣告者——那是循環初始化，不是設定問題。**
 *
 * 🟢 分成兩個檔之後順序就對了：登記表先完成初始化，載入器才去 glob。
 *
 * ⚠️ 樣式必須是**字面常數**（Vite 的限制），與膠囊登錄表同一個形狀。
 */
const PACK_MODULES = import.meta.glob('/src/languages/*/pack.ts', { eager: true })

/**
 * 觸發全部語言套件的自我登錄。
 *
 * ⚠️ **這裡管不了順序**——eager glob 在這個函式被呼叫**之前**就 import 完了。
 * 第一版在這裡寫 `void Object.keys(mods).sort()`，而**那一行一個效果都沒有**
 * （排序的是一份副本，登錄早就發生了）。症狀是預設目標變成 Python。
 *
 * 🟢 順序由各套件的 `order` 宣告，`allLanguagePacks()` 依它排。
 */
export function loadAllLanguagePacks(): void {
  void PACK_MODULES
}
