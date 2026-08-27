/**
 * **流程視圖的 palette**——而它**不自己決定有哪些東西**。
 *
 * ## 路線圖那條驗收的原話
 *
 * > 驗收：流程的 palette 與積木的工具箱**讀同一份登錄表**（不得各寫一份）
 *
 * 而「讀同一份登錄表」有兩種做法，只有一種真的擋得住分岔：
 *
 * ```
 * 🔴 各自從登錄表算一次   同一份來源，兩份【篩選與排序的邏輯】
 *                        ——而分岔的症狀是「工具箱有而 palette 沒有」，
 *                          沒有人會發現，因為兩邊都「看起來對」
 * 🟢 讀工具箱【產出的那個東西】  同一份來源、同一份邏輯、同一個順序
 * ```
 *
 * 所以這一支收的是 `buildToolbox()` 的**輸出**，把它攤平成
 * 「這個層級拿得到哪些元件」。
 *
 * > **「用同一份資料」擋不住分岔，「用同一份結果」才擋得住。**
 *
 * ⚠️ 代價說得出來：palette 因此**繼承工具箱的分類與順序**，
 * 而流程視圖將來若需要不同的分組，那是一次**明確的**分道，不是悄悄長出來的。
 */

/** palette 上的一項。 */
export interface PaletteItem {
  /** 這一項屬於哪一類（工具箱的分類名，已經是介面文字）。 */
  category: string
  /** 積木型別——⚠️ 它是**工具箱的詞彙**，這裡只用來查身分。 */
  blockType: string
  /**
   * 這一項的**預設狀態**（工具箱的 `extraTypes` 帶的那個）。
   *
   * 🔴 **它是積木的形狀，不是樹的形狀**——2026-08-27 實測：
   *
   * ```
   * cpp_if {}                          接點 CONDITION/THEN/TAIL
   * cpp_if {hasElse:true}              接點 …＋ ELSE
   * cpp_if {elseifCount:1,hasElse:true} 接點 …＋ ELSEIF_CONDITION_0/ELSEIF_THEN_0
   *
   * 而三者抽出來的【語義樹完全相同】：{condition:1, then_body:0, else_body:0}
   * ```
   *
   * > **`extraState` 決定積木長出哪些插槽，而樹只記錄插槽裡【有什麼】。
   * > 空的插槽在樹裡不存在。**
   *
   * ⚠️ 所以流程視圖**不能照抄它**——流程的接點是宣告出來的（永遠都在），
   * 所以「有沒有 else」在那裡不是一個選項。真正有差別的是
   * **預先接好的骨架**（例如 else-if 是一顆巢狀的 `cpp:if`），
   * 而那由 `flow/presets.ts` 從這裡的 `extraState` 翻譯出來。
   */
  extraState?: Record<string, unknown>
}

interface ToolboxLike {
  contents?: Array<{
    kind?: string
    name?: string
    type?: string
    contents?: Array<{ kind?: string; type?: string; extraState?: Record<string, unknown> }>
  }>
}

/**
 * 把工具箱的輸出攤平成 palette 的內容。
 *
 * ⚠️ **認不得的項目原樣跳過**——工具箱裡有 `sep`、有分類、有帶 `extraState`
 * 的入口，而這裡只要 `kind: 'block'`。
 * 🔴 **不猜**：一個「看起來像積木」的東西如果沒有 `type`，它就不進 palette
 * （寧可少一項，不要多一項假的）。
 */
export function paletteFromToolbox(toolbox: unknown): PaletteItem[] {
  const out: PaletteItem[] = []
  const root = toolbox as ToolboxLike
  for (const cat of root?.contents ?? []) {
    if (cat.kind !== 'category') continue
    const category = String(cat.name ?? '')
    for (const item of cat.contents ?? []) {
      if (item.kind !== 'block' || typeof item.type !== 'string') continue
      out.push({
        category,
        blockType: item.type,
        ...(item.extraState ? { extraState: item.extraState } : {}),
      })
    }
  }
  return out
}
