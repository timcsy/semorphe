/**
 * 積木型別的**導出規則**——一個名字，不是兩個
 *
 * ## 為什麼需要它
 *
 * 到 2026-08-11 為止，一顆元件要取**兩個**名字：概念身分（`cpp:stack_peek`）
 * 與積木型別（`cpp_stack_peek`）。186 顆積木裡 **153 顆**的積木型別不等於
 * 身分的導出名，而那不是隨機——是**兩個時間層疊在一起**：
 *
 * ```
 * 身分     停在命名整理（G 項）之後   peek 在封閉詞彙表上
 * 積木型別 停在命名整理之前           top 是被換掉的那個詞
 * ```
 *
 * > **積木型別是那次改名的化石層。**
 *
 * 而沒有任何機制擋得住第三個名字——這張表就是那個機制。
 *
 * ## 規則只有兩條
 *
 * ```
 * derive('cpp:stack_peek')                                  = 'cpp_stack_peek'
 * derive('cpp:var_declare',    {axis:'role',           value:'expression'})
 *                                                           = 'cpp_var_declare_expression'
 * derive('cpp:container_push', {axis:'container_kind', value:'stack'})
 *                                                           = 'cpp_container_push_stack'
 * ```
 *
 * ## ⚠️ `axis` 不進名字
 *
 * ~~理由原本寫「照抄——9 顆多形態裡 7 顆已經在用 `_` ＋ value」。~~
 * **護欄第一次跑就否證了它**：11 個非中性形態裡**一個都沒有**在用 `_` ＋ value。
 *
 * ```
 * form.value = 'expression'   而積木型別的後綴是  _expr    ← 縮寫，不是 value
 * form.value = 'stack'        而積木型別是  cpp_container_push_stack   ← value 塞在主體裡
 * ```
 *
 * > **「照抄已驗證的形狀」這個理由本身沒有被驗證過。**
 * > 我看到 `_expr` 就以為它是 `_` ＋ value，而 value 是 `expression`。
 *
 * 規則不變，理由換成真的那個：**加 axis 會讓名字裡出現兩份分類資訊**
 * （`cpp_var_declare_role_expression` 的 `role` 讀不出任何東西——
 * `expression` 已經說完了）。而**縮寫表是第三份會漂移的命名**，
 * 正是這個規格要消滅的東西——所以 `expression` 就是 `expression`，不縮寫。
 *
 * 代價是明確的：不同軸的 value 若撞名就會導出同名。
 * 那由 `assertDerivedNamesUnique()` 擋住——**代價要有機制接著，不能只有註解。**
 *
 * ## 這條規則管不到誰
 *
 * 使用者上傳的自訂積木（`onUploadCustomBlocks` → `defineBlocksWithJsonArray`）
 * 沒有 conceptId，導出規則對它不成立。**護欄的範圍是「專案宣告的積木」，
 * 不是「Blockly 執行期認得的積木」**——這兩者在執行期是同一個 registry。
 *
 * 不劃這條界的話，護欄會在使用者上傳一顆自訂積木時變紅，而那是正常操作。
 */

/** 一顆積木是哪個形態。不寫 = 中性形態。 */
export interface BlockForm {
  axis: string
  value: string
}

/**
 * 概念身分（＋形態）→ 積木型別。
 *
 * @param conceptId 例如 `cpp:stack_peek`
 * @param form 非中性形態才傳
 */
export function deriveBlockType(conceptId: string, form?: BlockForm | null): string {
  const 主體 = conceptId.replace(':', '_')
  return form ? `${主體}_${form.value}` : 主體
}

/** 一筆待檢查的積木宣告。 */
export interface 積木宣告 {
  conceptId: string
  form?: BlockForm | null
  blockType: string
}

/**
 * 兩個形態導出同名時丟錯——**不變式 I1**。
 *
 * ⚠️ 今天實測不撞名（11 個非中性形態的 value 只有 `expression`／`stack`／`queue`
 * 三種，同一顆身分內不重複）。**而那是今天的事實，不是保證**：
 * 加一條軸、或在既有軸上加一個與別軸同名的值，就會撞。
 *
 * 撞了之後的症狀是**安靜的**——Blockly 的 registry 以 type 為鍵，
 * 後登錄的蓋掉先登錄的，於是「一顆積木從工具箱消失」而沒有任何錯誤。
 * 這個專案已經被「後註冊的贏」咬過三次。
 */
export function assertDerivedNamesUnique(宣告們: readonly 積木宣告[]): void {
  const 見過 = new Map<string, string>()
  for (const b of 宣告們) {
    const 名 = deriveBlockType(b.conceptId, b.form)
    const existing = 見過.get(名)
    if (existing !== undefined && existing !== b.conceptId) {
      throw new Error(
        `兩顆積木導出同一個型別「${名}」：${existing} 與 ${b.conceptId}。` +
          `Blockly 的 registry 以型別為鍵，後登錄的會安靜地蓋掉先登錄的。`,
      )
    }
    if (existing !== undefined) {
      throw new Error(
        `同一顆身分「${b.conceptId}」的兩個形態導出同名「${名}」——` +
          `form.value 撞名了。導出規則不編入 axis（見本檔頭），` +
          `所以不同軸上的同名值會撞。`,
      )
    }
    見過.set(名, b.conceptId)
  }
}
