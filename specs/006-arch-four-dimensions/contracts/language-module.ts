/**
 * Contract: LanguageModule — 語言模組介面定義
 *
 * 語言模組封裝一個程式語言的所有資訊：
 * 型別系統、概念支援、程式碼生成、程式碼解析。
 *
 * @see ../spec.md US2
 * @see ../data-model.md LanguageModule, TypeEntry
 */

import type { ConceptId, SemanticModel, SemanticNode } from '../../../src/core/types'
import type { CodingStyle } from './coding-style'

// ============================================================
// TypeEntry — 型別定義項目
// ============================================================

/**
 * 語言模組提供的型別定義。
 * value 是語義資訊（程式碼中的型別名稱），
 * labelKey 是呈現資訊的引用（由 Locale 提供實際文字）。
 */
export interface TypeEntry {
  /** 型別在程式碼中的表示（如 "int", "double"） */
  value: string
  /** i18n label key（如 "TYPE_INT"），用於從 Locale 取得顯示文字 */
  labelKey: string
  /** 分類（用於 UI 分組顯示） */
  category?: 'basic' | 'advanced'
}

// ============================================================
// ConceptDefinition — 額外概念定義
// ============================================================

/**
 * 語言專屬的概念定義。
 * 用於語言模組聲明自己新增的概念（非 universal 的）。
 */
export interface ConceptDefinition {
  /** 概念 ID（使用 lang:name 格式） */
  id: ConceptId
  /** 概念描述的 i18n key */
  descriptionKey: string
  /** 此概念的屬性列表 */
  propertyNames: string[]
  /** 此概念的子節點列表 */
  childNames: string[]
}

// ============================================================
// Generator & Parser 介面
// ============================================================

/**
 * 程式碼生成器介面。
 * 接受 SemanticModel 和 CodingStyle，產出程式碼字串。
 */
export interface Generator {
  /** 語言 ID */
  readonly languageId: string
  /** 從語義模型生成程式碼 */
  generate(model: SemanticModel, style: CodingStyle): string
}

/**
 * 程式碼解析器介面。
 * 解析程式碼為語義模型，並可偵測編碼風格。
 */
export interface Parser {
  /** 語言 ID */
  readonly languageId: string
  /** 初始化解析器（載入 WASM 等） */
  init(): Promise<void>
  /** 解析程式碼為語義模型 */
  parse(code: string): Promise<SemanticModel>
  /** 偵測程式碼的編碼風格 */
  detectStyle(code: string): Partial<CodingStyle>
}

/**
 * 語言適配器介面。
 * 負責 tree-sitter CST 節點與 SemanticNode 之間的轉換。
 */
export interface LanguageAdapter {
  /** 將 CST 節點轉換為 SemanticNode */
  toSemanticNode(cstNode: unknown): SemanticNode | null
  /** 將 SemanticNode 轉換為 Blockly block JSON */
  toBlockJSON(node: SemanticNode): unknown
  /** 從 Blockly block 讀取為 SemanticNode */
  fromBlockJSON(blockJson: unknown): SemanticNode | null
}

// ============================================================
// LanguageModule — 語言模組主介面
// ============================================================

/**
 * LanguageModule — 程式語言的完整定義
 *
 * 每個語言模組提供：
 * 1. 型別系統（types）
 * 2. 支援的概念（supportedConcepts）
 * 3. 語言專屬概念（additionalConcepts）
 * 4. Tooltip 覆蓋（tooltipOverrides）
 * 5. 語言專屬積木定義（blockSpecs）
 * 6. 生成器、解析器、適配器
 *
 * @example
 * const cppModule: LanguageModule = {
 *   languageId: 'cpp',
 *   displayNameKey: 'LANG_CPP',
 *   types: [
 *     { value: 'int', labelKey: 'TYPE_INT', category: 'basic' },
 *     { value: 'double', labelKey: 'TYPE_DOUBLE', category: 'basic' },
 *   ],
 *   supportedConcepts: ['var_declare', 'func_def', ...allUniversalConcepts],
 *   additionalConcepts: [
 *     { id: 'cpp:include', descriptionKey: 'CPP_INCLUDE_DESC', ... },
 *   ],
 *   tooltipOverrides: {
 *     'U_VAR_DECLARE_TOOLTIP': 'CPP_VAR_DECLARE_TOOLTIP',
 *   },
 *   ...
 * }
 */
export interface LanguageModule {
  /** 語言唯一識別碼 */
  readonly languageId: string
  /** 語言名稱的 i18n key */
  readonly displayNameKey: string

  /** 此語言的型別清單 */
  getTypes(): TypeEntry[]

  /** 此語言支援的 universal 概念列表 */
  getSupportedConcepts(): ConceptId[]

  /** 此語言新增的專屬概念定義 */
  getAdditionalConcepts(): ConceptDefinition[]

  /** Tooltip 覆蓋映射：原始 i18n key → 語言專屬 i18n key */
  getTooltipOverrides(): Record<string, string>

  /** 語言專屬積木定義 */
  getBlockSpecs(): unknown[]

  /** 取得程式碼生成器 */
  getGenerator(): Generator

  /** 取得程式碼解析器 */
  getParser(): Parser

  /** 取得語言適配器 */
  getAdapter(): LanguageAdapter
}

// ============================================================
// LanguageRegistry — 語言模組註冊表
// ============================================================

/**
 * 語言模組註冊表介面。
 * App 啟動時註冊所有可用的語言模組。
 */
export interface LanguageRegistry {
  /** 註冊語言模組 */
  register(module: LanguageModule): void
  /** 取得指定語言的模組 */
  get(languageId: string): LanguageModule | undefined
  /** 取得所有已註冊的語言 ID */
  getAvailableLanguages(): string[]
  /** 取得當前啟用的語言模組 */
  getActive(): LanguageModule
  /** 設定當前啟用的語言 */
  setActive(languageId: string): void
}
