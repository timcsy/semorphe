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
  /** 工具箱分類 */
  category: string
  /** 定義檔版本號 */
  version: string
  /** Blockly JSON 積木定義 */
  blockDef: Record<string, unknown>
  /** 程式碼產生模板 */
  codeTemplate: CodeTemplate
  /** AST 匹配模式 */
  astPattern: AstPattern
}

/** 驗證錯誤 */
export interface ValidationError {
  /** 錯誤欄位路徑 */
  field: string
  /** 錯誤訊息 */
  message: string
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
