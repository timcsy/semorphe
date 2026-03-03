/** 積木定義中的程式碼模板 */
export interface CodeTemplate {
  /** 程式碼模板字串，含佔位符（如 `for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}`） */
  pattern: string
  /** 此積木需要的 #include 指令 */
  imports: string[]
  /** 運算子優先順序（用於括號判斷），數字越小優先順序越高 */
  order: number
}

/** AST 匹配模式 */
export interface AstPattern {
  /** tree-sitter CST 節點類型（如 `for_statement`） */
  nodeType: string
  /** 子節點約束條件 */
  constraints: AstConstraint[]
}

/** AST 約束條件 */
export interface AstConstraint {
  /** 子節點欄位名稱 */
  field: string
  /** 預期的節點類型 */
  nodeType?: string
  /** 預期的文字內容 */
  text?: string
}

/** 積木定義（Block Spec） */
export interface BlockSpec {
  /** 積木唯一識別碼 */
  id: string
  /** 語言識別：'universal' 或語言 ID（如 'cpp'） */
  language: 'universal' | string
  /** 工具箱分類 */
  category: string
  /** 定義檔版本號 */
  version: string
  /** Blockly JSON 積木定義 */
  blockDef: Record<string, unknown>
  /** 程式碼產生模板（僅語言特殊積木） */
  codeTemplate?: CodeTemplate
  /** AST 匹配模式（僅語言特殊積木） */
  astPattern?: AstPattern
}

/** 驗證錯誤 */
export interface ValidationError {
  /** 錯誤欄位路徑 */
  field: string
  /** 錯誤訊息 */
  message: string
}

/** BlockJSON 積木 JSON 格式 */
export interface BlockJSON {
  type: string
  id: string
  x?: number
  y?: number
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlockJSON }>
  next?: { block: BlockJSON }
  extraState?: unknown
}

/** Workspace JSON 格式 */
export interface WorkspaceJSON {
  blocks: {
    languageVersion: number
    blocks: BlockJSON[]
  }
}

/** 原始碼映射（積木 ↔ 程式碼行號對應） */
export interface SourceMapping {
  /** Blockly 積木 ID */
  blockId: string
  /** 原始碼起始行（0-based） */
  startLine: number
  /** 原始碼結束行（0-based） */
  endLine: number
}

/** 語言適配器介面 */
export interface LanguageAdapter {
  /**
   * 給定 AST 節點，回傳對應的積木 ID。
   * 優先匹配共用積木，無法匹配時才嘗試語言特殊積木。
   * 回傳 null 表示需要降級為原始碼積木。
   */
  matchNodeToBlock(node: unknown): string | null

  /**
   * 給定 AST 節點和目標積木 ID，萃取欄位值。
   * 回傳 { fields, inputs } 結構。
   */
  extractFields(node: unknown, blockId: string): {
    fields: Record<string, unknown>
    inputs: Record<string, { block: BlockJSON }>
  }

  /**
   * 給定共用積木 ID 和欄位值，生成該語言的程式碼片段。
   * 語言特殊積木使用 codeTemplate，不呼叫此方法。
   */
  generateCode(blockId: string, block: BlockJSON, indent: number): string
}

/** 語言模組介面 */
export interface LanguageModule {
  readonly languageId: string

  getParser(): ParserModule
  getGenerator(): GeneratorModule
  getBlockSpecs(): BlockSpec[]
  getAdapter(): LanguageAdapter
}

/** Parser Module 介面 */
export interface ParserModule {
  getLanguageId(): string
  parse(code: string): Promise<unknown>
}

/** Generator Module 介面 */
export interface GeneratorModule {
  getLanguageId(): string
  generate(workspace: unknown): string
}

/** Converter 介面 */
export interface ConverterInterface {
  codeToBlocks(code: string, languageId: string): Promise<unknown>
  blocksToCode(workspace: unknown, languageId: string): string
}

/** 工作區狀態（用於持久化） */
export interface WorkspaceState {
  blocklyState: Record<string, unknown>
  code: string
  languageId: string
  customBlockSpecs: BlockSpec[]
  lastModified: string
}
