/**
 * Contract: SemanticModel — 語義模型介面定義
 *
 * 語義模型是系統的唯一真實來源（P1）。
 * 程式碼和積木都從語義模型衍生。
 *
 * @see ../spec.md US4
 * @see ../data-model.md SemanticModel, SemanticNode
 */

// ============================================================
// ConceptId — 所有程式概念的唯一識別碼
// ============================================================

/** Universal 概念（所有程式語言共通） */
export type UniversalConcept =
  | 'program'
  | 'var_declare'
  | 'var_assign'
  | 'var_ref'
  | 'number_literal'
  | 'string_literal'
  | 'arithmetic'
  | 'compare'
  | 'logic'
  | 'logic_not'
  | 'if'
  | 'count_loop'
  | 'while_loop'
  | 'break'
  | 'continue'
  | 'func_def'
  | 'func_call'
  | 'return'
  | 'print'
  | 'input'
  | 'endl'
  | 'array_declare'
  | 'array_access'

/**
 * 語言特有概念使用 `lang:concept` 格式。
 * 例如：'cpp:include', 'cpp:pointer_declare', 'python:list_comprehension'
 */
export type LanguageSpecificConcept = `${string}:${string}`

/** ConceptId 是 universal 或 language-specific 概念的聯集 */
export type ConceptId = UniversalConcept | LanguageSpecificConcept

// ============================================================
// SemanticNode — 語義模型中的單一節點
// ============================================================

/** 節點屬性值類型 */
export type PropertyValue = string | number | boolean

/** 節點呈現資訊（metadata），不影響語義 */
export interface NodeMetadata {
  /** 原始碼行號範圍（0-based） */
  sourceRange?: { start: number; end: number }
  /** 積木在 workspace 中的位置 */
  blockPosition?: { x: number; y: number }
  /** 對應的 Blockly block ID */
  blockId?: string
}

/**
 * SemanticNode — 語義樹中的單一節點
 *
 * 純資料結構，no behavior。方便序列化、深比較、測試。
 *
 * @example
 * // 變數宣告：int x = 5;
 * {
 *   concept: 'var_declare',
 *   properties: { name: 'x', type: 'int' },
 *   children: {
 *     initializer: {
 *       concept: 'number_literal',
 *       properties: { value: '5' },
 *       children: {}
 *     }
 *   }
 * }
 */
export interface SemanticNode {
  /** 此節點代表的概念 */
  readonly concept: ConceptId
  /** 語義屬性（變數名、運算子、常數值等） */
  readonly properties: Record<string, PropertyValue>
  /** 子節點（函式體、條件、迴圈體等） */
  readonly children: Record<string, SemanticNode | SemanticNode[]>
  /** 呈現資訊（不影響語義比較） */
  metadata?: NodeMetadata
}

// ============================================================
// SemanticModel — 完整的程式語義表示
// ============================================================

/** 程式級呈現資訊 */
export interface ProgramMetadata {
  /** 偵測到的編碼風格（部分屬性） */
  detectedStyle?: Record<string, unknown>
  /** 原始碼的行數 */
  lineCount?: number
}

/**
 * SemanticModel — 程式的完整語義表示
 *
 * 這是系統中的唯一真實來源。所有轉換都經由此模型：
 * - Code → SemanticModel → Blocks
 * - Blocks → SemanticModel → Code
 */
export interface SemanticModel {
  /** 根節點，concept 必須是 'program' */
  readonly program: SemanticNode
  /** 程式級 metadata */
  metadata: ProgramMetadata
}

// ============================================================
// 操作介面
// ============================================================

/**
 * SemanticModel 的建立與操作工具函式（非 class，保持簡單）。
 * 實作時作為獨立函式導出。
 */

/** 建立一個 SemanticNode */
// createNode(concept, properties, children, metadata?): SemanticNode

/** 深比較兩個 SemanticModel 的語義是否等價（忽略 metadata） */
// semanticEquals(a: SemanticModel, b: SemanticModel): boolean

/** 走訪 SemanticNode 樹 */
// walkNodes(root: SemanticNode, visitor: (node: SemanticNode) => void): void

/** 序列化 SemanticModel 為 JSON（用於 localStorage 儲存） */
// serializeModel(model: SemanticModel): string

/** 反序列化 JSON 為 SemanticModel */
// deserializeModel(json: string): SemanticModel
