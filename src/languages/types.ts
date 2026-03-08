import type { ConceptId, SemanticModel, SemanticNode } from '../core/types'
import type { CodingStyle } from './style'

/** 語言模組提供的型別定義項目 */
export interface TypeEntry {
  value: string
  labelKey: string
  category?: 'basic' | 'advanced'
}

/** 語言專屬的概念定義 */
export interface ConceptDefinition {
  id: ConceptId
  descriptionKey: string
  propertyNames: string[]
  childNames: string[]
}

/** 程式碼生成器介面（新版，接受 SemanticModel） */
export interface Generator {
  readonly languageId: string
  generate(model: SemanticModel, style: CodingStyle): string
}

/** 程式碼解析器介面（新版，輸出 SemanticModel） */
export interface Parser {
  readonly languageId: string
  init(): Promise<void>
  parse(code: string): Promise<SemanticModel>
  detectStyle(code: string): Partial<CodingStyle>
}

/** 語言適配器介面（新版，SemanticNode 為核心） */
export interface NewLanguageAdapter {
  toSemanticNode(cstNode: unknown): SemanticNode | null
  toBlockJSON(node: SemanticNode): unknown
  fromBlockJSON(blockJson: unknown): SemanticNode | null
}

/** LanguageModule — 程式語言的完整定義（新版） */
export interface NewLanguageModule {
  readonly languageId: string
  readonly displayNameKey: string
  getTypes(): TypeEntry[]
  getSupportedConcepts(): ConceptId[]
  getAdditionalConcepts(): ConceptDefinition[]
  getTooltipOverrides(): Record<string, string>
  getBlockSpecs(): unknown[]
  getGenerator(): Generator
  getParser(): Parser
  getAdapter(): NewLanguageAdapter
}

/** 語言模組註冊表介面 */
export interface LanguageRegistry {
  register(module: NewLanguageModule): void
  get(languageId: string): NewLanguageModule | undefined
  getAvailableLanguages(): string[]
  getActive(): NewLanguageModule
  setActive(languageId: string): void
}
