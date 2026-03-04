/**
 * Contract: Locale — 國際化介面定義
 *
 * Locale 是積木投影的參數之一（P2）。
 * 影響積木的顯示文字，不影響語義。
 *
 * @see ../spec.md US1
 * @see ../data-model.md LocaleBundle
 */

// ============================================================
// LocaleBundle — 翻譯資料包
// ============================================================

/**
 * LocaleBundle — 一個語言環境的完整翻譯資料
 *
 * 包含兩個部分：
 * 1. blocks: 積木的 message、tooltip、dropdown label
 * 2. types: 型別的顯示 label
 *
 * Key 命名慣例：
 * - Message: {BLOCK_ID}_MSG 或 {BLOCK_ID}_MSG{N}
 * - Tooltip: {BLOCK_ID}_TOOLTIP
 * - Dropdown label: {BLOCK_ID}_{FIELD}_{OPTION}
 * - Type label: TYPE_{TYPE_NAME}
 */
export interface LocaleBundle {
  /** 語言環境識別碼（如 "zh-TW", "en"） */
  readonly localeId: string
  /** 積木翻譯：key → 文字 */
  readonly blocks: Record<string, string>
  /** 型別翻譯：key → 文字 */
  readonly types: Record<string, string>
}

// ============================================================
// LocaleLoader — 翻譯載入器
// ============================================================

/**
 * LocaleLoader — 載入翻譯並注入 Blockly.Msg
 *
 * 責任：
 * 1. 載入指定 locale 的翻譯檔
 * 2. 將 blocks 翻譯注入 Blockly.Msg
 * 3. 將 types 翻譯注入 Blockly.Msg（TYPE_XXX keys）
 * 4. 處理 key 缺失的 fallback（FR-003）
 *
 * Fallback 策略：
 * - 若 key 不存在於翻譯檔 → 顯示 key 名稱本身
 * - 若 locale 檔案載入失敗 → 使用 fallback locale（en）
 */
export interface LocaleLoader {
  /**
   * 載入指定 locale 的翻譯並注入 Blockly.Msg。
   * @param localeId - 語言環境識別碼（如 "zh-TW"）
   * @returns 載入的 LocaleBundle
   */
  load(localeId: string): Promise<LocaleBundle>

  /**
   * 取得當前已載入的 locale。
   */
  getCurrentLocale(): string

  /**
   * 取得所有可用的 locale 列表。
   */
  getAvailableLocales(): string[]
}

// ============================================================
// Blockly.Msg 注入規格
// ============================================================

/**
 * Blockly.Msg 注入說明（非介面，僅文件）
 *
 * LocaleLoader.load() 執行時會做以下注入：
 *
 * 1. 遍歷 LocaleBundle.blocks 的所有 key-value
 *    → 設定 Blockly.Msg[key] = value
 *
 * 2. 遍歷 LocaleBundle.types 的所有 key-value
 *    → 設定 Blockly.Msg[key] = value
 *
 * 3. 積木 JSON 中的 %{BKY_XXX} 會自動從 Blockly.Msg['XXX'] 查找
 *
 * 4. 動態積木在 init() 中使用 Blockly.Msg['KEY'] 取得文字
 *
 * 5. 若 Blockly.Msg['KEY'] 為 undefined，積木會顯示 '%{BKY_KEY}'
 *    → 符合 FR-003 的 fallback 需求
 */
