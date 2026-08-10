/**
 * 積木型別的改名表（v9 → v10，spec 116）
 *
 * ## 為什麼是**凍結的明表**，不是一條規則
 *
 * 規則很單純（`conceptId` 的 `:` 換 `_`，非中性形態接 `_` ＋ `form.value`），
 * 而「**v9 那時存在哪些積木型別**」是**歷史事實**。從當下的登錄表推導的話，
 * 往後每一次增刪元件都會悄悄改變這張表——而它要處理的是幾個月前存的檔案。
 *
 * 寫成明表讓每一筆都看得見：規則若對某一顆是錯的，讀的人指得出來。
 * （與 `id-migrations.ts` 同一個理由，同一個形狀。）
 *
 * ## ⚠️ 這是這個專案的第一次**積木狀態**遷移
 *
 * 既有的八個升級步驟**每一個都只改寫語義樹**（`raw.tree`）。
 * 積木狀態（`blocklyState`）從來沒有被碰過——因為身分是真實，而積木型別是投影。
 *
 * 那為什麼這次要碰？因為 `src/ui/app.ts` 載入時：
 *
 * ```ts
 * // 1. Restore blocks FIRST (before level change triggers resync)
 * this.blocklyPanel?.setState(state.blocklyState)
 * ```
 *
 * > **一個被存起來、而且載入時當作還原來源的投影，行為上就是真實。**
 *
 * 所以它適用 P8 的例外條款（「語義詞彙本身的變更 MUST 附一次性的轉換」），
 * 而不是「投影可重建所以不用管舊檔」。
 */

/**
 * 舊積木型別 → 新積木型別。
 *
 * ⚠️ **只加不改。** 這張表描述的是過去，過去不會變。
 */
export const BLOCK_TYPE_MIGRATIONS_V9_TO_V10: Record<string, string> = {}

/**
 * 把一批對應併進表裡。
 *
 * @throws 同一個舊名被登錄兩次且指向不同新名——**靜默覆蓋的症狀是
 *   「某個舊存檔裡的積木被還原成另一種積木」**，而那不會有任何錯誤訊息。
 */
export function registerBlockTypeMigration(m: Record<string, string>): void {
  for (const [舊, 新] of Object.entries(m)) {
    const 先來的 = BLOCK_TYPE_MIGRATIONS_V9_TO_V10[舊]
    if (先來的 !== undefined && 先來的 !== 新) {
      throw new Error(
        `積木型別「${舊}」被登錄兩次且指向不同新名：${先來的} 與 ${新}。`,
      )
    }
    BLOCK_TYPE_MIGRATIONS_V9_TO_V10[舊] = 新
  }
}
