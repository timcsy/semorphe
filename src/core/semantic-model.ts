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

/** 語言特有概念使用 `lang:concept` 格式 */
export type LanguageSpecificConcept = `${string}:${string}`

/** ConceptId 是 universal 或 language-specific 概念的聯集 */
export type ConceptId = UniversalConcept | LanguageSpecificConcept

/** 節點屬性值類型 */
export type PropertyValue = string | number | boolean

/** 節點呈現資訊（metadata），不影響語義 */
export interface NodeMetadata {
  sourceRange?: { start: number; end: number }
  blockPosition?: { x: number; y: number }
  blockId?: string
}

/** SemanticNode — 語義樹中的單一節點（純資料結構） */
export interface SemanticNode {
  readonly concept: ConceptId
  readonly properties: Record<string, PropertyValue>
  readonly children: Record<string, SemanticNode | SemanticNode[]>
  metadata?: NodeMetadata
}

/** 程式級呈現資訊 */
export interface ProgramMetadata {
  detectedStyle?: Record<string, unknown>
  lineCount?: number
}

/** SemanticModel — 程式的完整語義表示，唯一真實來源 */
export interface SemanticModel {
  readonly program: SemanticNode
  metadata: ProgramMetadata
}

/** 建立 SemanticNode */
export function createNode(
  concept: ConceptId,
  properties: Record<string, PropertyValue> = {},
  children: Record<string, SemanticNode | SemanticNode[]> = {},
  metadata?: NodeMetadata,
): SemanticNode {
  return { concept, properties, children, metadata }
}

/** 深比較兩個 SemanticNode 的語義是否等價（忽略 metadata） */
export function nodeEquals(a: SemanticNode, b: SemanticNode): boolean {
  if (a.concept !== b.concept) return false

  const aKeys = Object.keys(a.properties)
  const bKeys = Object.keys(b.properties)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a.properties[key] !== b.properties[key]) return false
  }

  const aChildKeys = Object.keys(a.children)
  const bChildKeys = Object.keys(b.children)
  if (aChildKeys.length !== bChildKeys.length) return false
  for (const key of aChildKeys) {
    const aChild = a.children[key]
    const bChild = b.children[key]
    if (bChild === undefined) return false
    if (Array.isArray(aChild)) {
      if (!Array.isArray(bChild)) return false
      if (aChild.length !== bChild.length) return false
      for (let i = 0; i < aChild.length; i++) {
        if (!nodeEquals(aChild[i], bChild[i])) return false
      }
    } else {
      if (Array.isArray(bChild)) return false
      if (!nodeEquals(aChild, bChild)) return false
    }
  }

  return true
}

/** 深比較兩個 SemanticModel 的語義是否等價（忽略 metadata） */
export function semanticEquals(a: SemanticModel, b: SemanticModel): boolean {
  return nodeEquals(a.program, b.program)
}

/** 走訪 SemanticNode 樹 */
export function walkNodes(root: SemanticNode, visitor: (node: SemanticNode) => void): void {
  visitor(root)
  for (const child of Object.values(root.children)) {
    if (Array.isArray(child)) {
      for (const node of child) {
        walkNodes(node, visitor)
      }
    } else {
      walkNodes(child, visitor)
    }
  }
}

/** 序列化 SemanticModel 為 JSON */
export function serializeModel(model: SemanticModel): string {
  return JSON.stringify(model)
}

/** 反序列化 JSON 為 SemanticModel */
export function deserializeModel(json: string): SemanticModel {
  return JSON.parse(json) as SemanticModel
}
