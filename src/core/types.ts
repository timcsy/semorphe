// ─── Property Values ───

export type PropertyValue = string | number | boolean | string[]

// ─── Concept IDs ───

/** Universal 概念（所有程式語言共通） */
export type UniversalConcept =
  | 'cpp:program'
  | 'cpp:var_declare'
  | 'cpp:var_assign'
  | 'cpp:var_ref'
  | 'cpp:literal_number'
  | 'cpp:literal_string'
  | 'cpp:arithmetic'
  | 'cpp:compare'
  | 'cpp:logic'
  | 'cpp:logic_not'
  | 'cpp:negate'
  | 'cpp:if'
  | 'cpp:loop_count'
  | 'cpp:loop_while'
  | 'cpp:break'
  | 'cpp:continue'
  | 'cpp:func_def'
  | 'cpp:func_call'
  | 'cpp:return'
  | 'cpp:print'
  | 'cpp:input'
  | 'cpp:endl'
  | 'cpp:array_declare'
  | 'cpp:array_at'

/** 語言特有概念使用 `lang:concept` 格式 */
export type LanguageSpecificConcept = `${string}:${string}`

/** ConceptId 是 universal 或 language-specific 概念的聯集 */
export type ConceptId = UniversalConcept | LanguageSpecificConcept

// ─── Semantic Tree ───

export interface SemanticNode {
  id: string
  conceptId: string
  properties: Record<string, PropertyValue>
  children: Record<string, SemanticNode[]>
  annotations?: Annotation[]
  metadata?: NodeMetadata
}

export interface Annotation {
  type: 'comment' | 'pragma' | 'lint_directive'
  text: string
  position: 'before' | 'after' | 'inline'
}

export type ConfidenceLevel = 'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'
export type DegradationCause = 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'

export interface NodeMetadata {
  syntaxPreference?: string
  confidence?: ConfidenceLevel
  degradationCause?: DegradationCause
  rawCode?: string
  sourceRange?: SourceRange
  /** Block ID from which this node was extracted (for block↔code highlight mapping) */
  sourceBlockId?: string
}

export interface SourceRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

/** 程式級呈現資訊 */
export interface ProgramMetadata {
  detectedStyle?: Record<string, unknown>
  lineCount?: number
}

/** SemanticModel — 程式的完整語義表示 */
export interface SemanticModel {
  readonly program: SemanticNode
  metadata: ProgramMetadata
}

// ─── Concept System ───

export type ConceptLayer = 'universal' | 'lang-core' | 'lang-library'

export interface ConceptDef {
  id: string
  layer: ConceptLayer
  abstractConcept?: string
  propertyNames: string[]
  childNames: string[]
  semanticContract?: SemanticContract
  annotations?: Record<string, unknown>
}

export interface SemanticContract {
  effect: 'pure' | 'mutate_self' | 'mutate_arg'
  returnSemantics: 'void' | 'self' | 'new_value'
  chainable: boolean
}

// ─── Block Spec (JSON-driven) ───

export interface BlockSpec {
  /**
   * 這顆積木是哪個**形態**。
   *
   * 不寫 = 中性形態（軸值取不到時用的那個）。寫了就是某條軸上的一個值，
   * 例如 `{ axis: 'container_kind', value: 'stack' }`。
   *
   * ⚠️ **軸的定義不重複寫在每個變體上**——它是核心的一張表（`KNOWN_AXES`）。
   * 加一條軸就是加一列，不是加一個外掛系統。
   */
  form?: { axis: string; value: string }

  /**
   * 這顆積木是**誰宣告的**——std 模組的 header、`'(core)'` 或 `'(universal)'`。
   *
   * 由組裝處蓋章（`makeModule` / `coreBlocks` / `universalBlocks` 的匯出），
   * **不是寫在 JSON 裡**：一顆積木屬於哪個模組，是它所在的資料夾說了算，
   * 讓它自己再宣告一次就是第二份會漂移的真相。
   *
   * 工具箱靠它把「`<map>` 的容器」與「`<stack>` 的容器」分開——兩者的
   * `category` 都是 `'containers'`，而它們該去不同的工具箱分類。
   */
  owner?: string

  /**
   * 這顆積木該出現在**哪個（些）工具箱分類**——只在「來源不足以決定」時宣告。
   *
   * 絕大多數積木不寫這一欄：它所屬的來源＋登錄分類（`<map>` 的 `containers`）
   * 只對到一個工具箱分類，導得出來。
   *
   * 需要寫的是**真的散開**的那幾包，而那是逐顆的教學決定：
   * `<cstdlib>` 的 `abs` 是運算、`exit` 是控制、`atoi` 是文字——一個標頭三個意圖。
   *
   * 陣列代表**同時屬於多個分類**（`c_memset` 既是文字也是記憶體操作）。
   *
   * ⚠️ **中性形態不寫這一欄。** 它不進工具箱是推導出來的
   * （這個身分有多個形態，而這一顆沒有 `form`），不是靠漏掉它。
   */
  toolboxCategory?: string | string[]

  id: string
  language: string
  category: string
  version: string
  /**
   * 這顆積木對應的概念。
   *
   * 舊名 `concept`——與 `SemanticNode.concept`（一個**字串**）同名而不同義，
   * 是 2026-08-06 那次改名翻車的直接原因：腳本分不出「值是物件」與「值是
   * 字串」的兩種 `concept`，而測試檔不在型別檢查範圍內，改錯了照樣編得過。
   *
   * 改名讓「`concept`」在專案裡的意思收斂。見 experience「同一個欄位名長在
   * 三個不同型別上時」。
   */
  conceptMapping: ConceptMapping
  blockDef: Record<string, unknown>
  codeTemplate: CodeTemplate
  astPattern: AstPattern
  renderMapping?: RenderMapping
}

export interface ConceptMapping {
  conceptId: string
  abstractConcept?: string
  properties?: string[]
  children?: Record<string, string>
  role?: 'statement' | 'expression' | 'both'
  annotations?: Record<string, unknown>
}

export interface CodeTemplate {
  pattern: string
  imports: string[]
  order: number
}

export interface AstPattern {
  nodeType: string
  constraints: AstConstraint[]
  patternType?: 'simple' | 'operatorDispatch' | 'chain' | 'composite' | 'unwrap' | 'contextTransform' | 'multiResult'
  fieldMappings?: FieldMapping[]
  operatorDispatch?: OperatorDispatchDef
  chain?: ChainDef
  composite?: CompositeDef
  unwrapChild?: number | string
  contextTransform?: ContextTransformDef
  multiResult?: MultiResultDef
  liftStrategy?: string
}

export interface AstConstraint {
  field: string
  text?: string
  nodeType?: string
  match?: 'exact' | 'startsWith'
}

export interface FieldMapping {
  semantic: string
  ast: string
  extract: 'text' | 'lift' | 'liftBody' | 'liftChildren'
  transform?: string
}

export interface OperatorDispatchDef {
  operatorField: string
  routes: Record<string, string>
  fieldMappings?: FieldMapping[]
}

export interface ChainDef {
  operator: string
  direction: 'left' | 'right'
  rootMatch: { text: string }
  collectField: string
  specialNodes?: Record<string, string>
}

export interface CompositeDef {
  checks: Array<{
    field: string
    typeIs?: string
    operatorIn?: string[]
  }>
  extract: Record<string, ExtractRule>
}

export interface ContextTransformDef {
  liftChild: number | string
  transformRules: Array<{
    fromConcept: string
    toConcept: string
  }>
}

export interface MultiResultDef {
  iterateOver: string
  perItemPatterns?: Record<string, ExtractRule>
  wrapInCompound: boolean
}

export interface ExtractRule {
  source: 'text' | 'lift' | 'liftBody' | 'path' | 'nodeText' | 'operator'
  path?: string
  field?: string
}

// ─── Render Mapping (JSON-driven) ───

/**
 * 形態選擇軸——**具名**，而不是寫死的兩個欄位。
 *
 * 目前有兩條軸在跑，而且**取值來源不同**：
 *
 * | 軸 | `from` | 例 |
 * |---|---|---|
 * | `role` | `position`——由呈現位置決定 | 敘述版／運算式版 |
 * | `container_kind` | `property`——讀節點屬性 | 堆疊／佇列 |
 *
 * 寫死兩個欄位裝不下第二條軸，而 P3 說「新增不得改變既有」。
 * **但不建外掛系統**——軸的解析就是一張表，加一條軸就是加一列。
 */
export interface FormAxis {
  /** 軸名，只用於診斷訊息 */
  name: string
  /** 值從哪來 */
  from: 'position' | 'property'
  /** `from: 'property'` 時讀哪個屬性 */
  property?: string
}

/**
 * 一個元件身分可對應的所有積木形態，以及**怎麼選**。
 *
 * 不變式 FS-1..FS-4 見 `specs/097-multi-form-projection/data-model.md`，
 * 由 `validateFormSet()` 檢查。
 */
export interface FormSet {
  conceptId: string
  /** null = 只有一個形態（絕大多數元件） */
  axis: FormAxis | null
  /** 軸值 → 積木型別 */
  forms: Record<string, string>
  /** 選不出時用哪個。MUST 在 `forms` 的值域裡（FS-2） */
  fallback: string
}

export interface RenderMapping {
  fields: Record<string, string>
  inputs: Record<string, string>
  statementInputs: Record<string, string>
  dynamicInputs?: DynamicInputDef
  strategy?: string
  /** Block type to use when this statement block appears in expression context */
  expressionCounterpart?: string
  /** Declarative rules for dynamic block structure (variable-count inputs, multi-mode slots, etc.) */
  dynamicRules?: DynamicRule[]
  /** Extra state flags: set extraState[key] = true when children[childSlot] is non-empty */
  extraStateFlags?: Record<string, string>
}

export interface DynamicInputDef {
  semanticChild: string
  inputPrefix: string
  countProperty?: string
}

// ─── Dynamic Rules (unified extract/render for dynamic blocks) ───

/**
 * A declarative rule describing how to extract/render dynamic block structure.
 * Each rule maps a variable-count set of inputs/fields to a semantic children slot.
 */
export interface DynamicRule {
  /** Path in extraState to get the element count (e.g., "argCount", "args.length") */
  countSource: string
  /** Semantic children slot name to populate */
  childSlot: string
  /** Input name pattern with {i} placeholder (e.g., "ARG_{i}") — reads input_value */
  inputPattern?: string
  /** Field name pattern with {i} placeholder (e.g., "TYPE_{i}") — reads field value */
  fieldPattern?: string
  /** Path in extraState to get each element's mode (e.g., "args[{i}].mode") */
  modeSource?: string
  /** Mode-specific extraction rules */
  modes?: Record<string, ModeExtractRule>
  /** Concept to create for each element (used with fieldPattern groups) */
  childConcept?: string
  /** Map of field patterns → property names for childConcept nodes */
  childFields?: Record<string, string>
  /** If true, the inputPattern refers to statement inputs (chains) rather than expression inputs */
  isStatementInput?: boolean
}

/** Describes how to extract a value in a specific mode (select, input, expression, etc.) */
export interface ModeExtractRule {
  /** Path in extraState to read the value (for select/input modes) */
  field?: string
  /** Wrap the value as this concept (e.g., "var_ref", "number_literal") */
  wrap?: string
  /** Read from block input (for expression/compose modes) */
  input?: string
}

// ─── Split JSON Formats (Phase 3: concept/blockDef separation) ───

/** 五路完備性的路徑名 */
export type PathName = 'lift' | 'render' | 'extract' | 'generate' | 'execute'

/** Concept definition in concepts.json (semantic layer) */
/**
 * 一個參數的**語義種類**——決定「什麼值是錯的」。
 *
 * ⚠️ **刻意不是 JS 型別。** 實測 177 顆元件的實例側幾乎全是字串
 * （唯一的布林是 `cpp_include.local`），所以 `'string' | 'number'` 這種詞彙
 * **等於什麼都沒說**——那正是「沒有指涉物的設計」（`knowledge/experience.md`）。
 *
 * 每一個種類都以**它能讓什麼失敗**來定義。生不出檢查的種類不該存在。
 *
 * | 種類 | 實測的參數名（節錄） | 它讓什麼失敗 |
 * |---|---|---|
 * | `identifier` | `name`(43)、`obj`(30)、`class_name`、`alias` | 空字串、不合法的識別字 |
 * | `type_expr` | `type`(16)、`return_type`(8)、`key_type` | 空字串（`long long` 那條債的所在） |
 * | `enum` | `operator`(6)、`position`、`inclusive` | **值不在宣告的集合裡** ← 最強的一條 |
 * | `literal` | `value`、`text`、`code`、`format` | 只驗存在——內容是使用者的資料 |
 * | `count` | `rows`、`cols` | 非數字、負數 |
 */
export type ParamKind = 'identifier' | 'type_expr' | 'enum' | 'literal' | 'count'

/**
 * 型別側的參數宣告——**規格**，不是名字清單。
 *
 * 詞彙出自 `knowledge/concepts/元件.md:203`（「型別側參數宣告 = 參數規格 = `ParamSpec`」）。
 *
 * ⚠️ **實例側（`SemanticNode.properties`）不動。** 這裡只描述，不驅動任何行為——
 * 曾經驅動過（`deriveRenderMapping` 拿 `properties` 比對積木欄位名），
 * 那個耦合已於 2026-08-08 解除。
 */
export interface ParamSpec {
  name: string
  kind: ParamKind
  /** `kind: 'enum'` 時的允許值。少了它，enum 這個種類就退化成 literal */
  values?: string[]
  /** 沒有它這顆元件就不完整嗎 */
  required?: boolean
  /** 沒給的時候用什麼 */
  default?: string
}

export interface ConceptDefJSON {
  conceptId: string
  layer: ConceptLayer
  abstractConcept?: string | null
  /**
   * ⚠️ **過渡中**：純名字清單（124 顆）與 `ParamSpec[]`（規格化後）並存。
   * 見 `specs/102-param-spec`。全部遷完之後這裡只留 `ParamSpec[]`。
   */
  properties: string[] | ParamSpec[]
  children: Record<string, string>
  role: 'statement' | 'expression' | 'both'
  annotations?: Record<string, unknown>
  /**
   * 本概念**刻意**不提供的路徑。
   *
   * **這不再只是文件——執行引擎會讀它。** 在此之前「哪些概念不執行」寫死在
   * 核心直譯器的一份清單裡，而這個欄位一個概念都沒用過；同一個事實有兩處
   * 記載，且兩處從未一致。現在只有一處：概念自己說。
   *
   * 未宣告的空實作一律判為「殼」——正確的空與缺失的空長得一樣，
   * 所以要求正確的那個出聲。見 knowledge/concepts/執行機構.md。
   */
  skipPaths?: PathName[]
  /**
   * 每條被跳過的路徑**為什麼**被跳過。有 `skipPaths` 就必須有它。
   *
   * 沒有理由的宣告是**把缺陷洗成設計**——而且宣告下去之後，護欄會替它背書。
   * 實測 34 個「無執行行為」的概念裡，只有 12 個說得出理由（見
   * `specs/053-declare-noop-execute/classification.md`）。
   */
  skipReasons?: Partial<Record<PathName, SkipReason>>
}

/**
 * 一條路徑被刻意跳過的理由。**只有兩個值，而且不得增加。**
 *
 * 第三個值就是在替「還沒做」找一個體面的名字。
 */
/**
 * 為什麼這個概念刻意不走某條路。
 *
 * ⚠️ **值域必須小，而且每個值都要能機械查證。** `history/018` 的原話：
 * 「理由只有固定幾個值且不得增加——第三個值就是在替『還沒做』找一個體面的
 * 名字。」所以第三個值的門檻要比前兩個更硬：
 * `skip-declaration-gate` 會去驗每一個宣告的**事實依據**，不只驗它有理由。
 */
export type SkipReason =
  /** 這個概念在執行期沒有任何可觀察效果（註解、include、define…） */
  | 'declarative'
  /**
   * **由降級抵達，不由辨識抵達。**
   *
   * 有些概念是別人的抽象父概念——它們不會出現在任何原始碼裡，而是在具體
   * 概念不可用時**被降級成**的目標（`cpp_ternary` → `if_else`）。
   *
   * 完備性假設「每個概念都該從產出的程式碼辨識得回來」，而那個假設對降級
   * 目標**不成立**。
   *
   * 門檻（`skip-declaration-gate` 會驗）：
   *   ① 必須真的有概念宣告它為 `abstractConcept`
   *   ② 必須不在工具箱裡——使用者拖得到的話它就該辨識得回來
   */
  | 'degradation-target'
  /** 有子槽，但由父概念的執行器負責走訪（cpp_case ← cpp_switch） */
  | 'consumed-by-parent'

/** Block projection in block-specs.json (projection layer) */
export interface BlockProjectionJSON {
  /**
   * 這顆積木是哪個**形態**。
   *
   * 不寫 = 中性形態（軸值取不到時用的那個）。寫了就是某條軸上的一個值，
   * 例如 `{ axis: 'container_kind', value: 'stack' }`。
   *
   * ⚠️ **軸的定義不重複寫在每個變體上**——它是核心的一張表（`KNOWN_AXES`）。
   * 加一條軸就是加一列，不是加一個外掛系統。
   */
  form?: { axis: string; value: string }

  /**
   * 這顆積木是**誰宣告的**——std 模組的 header、`'(core)'` 或 `'(universal)'`。
   *
   * 由組裝處蓋章（`makeModule` / `coreBlocks` / `universalBlocks` 的匯出），
   * **不是寫在 JSON 裡**：一顆積木屬於哪個模組，是它所在的資料夾說了算，
   * 讓它自己再宣告一次就是第二份會漂移的真相。
   *
   * 工具箱靠它把「`<map>` 的容器」與「`<stack>` 的容器」分開——兩者的
   * `category` 都是 `'containers'`，而它們該去不同的工具箱分類。
   */
  owner?: string

  /**
   * 這顆積木該出現在**哪個（些）工具箱分類**——只在「來源不足以決定」時宣告。
   *
   * 絕大多數積木不寫這一欄：它所屬的來源＋登錄分類（`<map>` 的 `containers`）
   * 只對到一個工具箱分類，導得出來。
   *
   * 需要寫的是**真的散開**的那幾包，而那是逐顆的教學決定：
   * `<cstdlib>` 的 `abs` 是運算、`exit` 是控制、`atoi` 是文字——一個標頭三個意圖。
   *
   * 陣列代表**同時屬於多個分類**（`c_memset` 既是文字也是記憶體操作）。
   *
   * ⚠️ **中性形態不寫這一欄。** 它不進工具箱是推導出來的
   * （這個身分有多個形態，而這一顆沒有 `form`），不是靠漏掉它。
   */
  toolboxCategory?: string | string[]

  id: string
  conceptId: string
  language: string
  category: string
  version: string
  blockDef: Record<string, unknown>
  codeTemplate?: CodeTemplate
  astPattern?: AstPattern
  renderMapping?: RenderMapping
}

/** Language manifest for manifest-driven loading */
export interface LanguageManifest {
  id: string
  name: string
  version: string
  parser: {
    type: 'tree-sitter'
    language: string
  }
  provides: {
    concepts: string[]
    blocks: string[]
    templates: string[]
    liftPatterns: string[]
  }
}

// ─── Universal Template (Language-specific code templates for universal concepts) ───

export interface UniversalTemplate {
  conceptId: string
  pattern?: string
  styleVariants?: Record<string, CodeTemplate>
  styleKey?: string
  order: number
  imports?: string[]
}

// ─── Lift Pattern (JSON-driven AST→Semantic patterns) ───

export interface LiftPattern {
  id: string
  astNodeType: string
  concept?: { conceptId: string }
  patternType?: AstPattern['patternType']
  constraints?: AstConstraint[]
  fieldMappings?: FieldMapping[]
  operatorDispatch?: OperatorDispatchDef
  chain?: ChainDef
  composite?: CompositeDef
  unwrapChild?: number | string
  contextTransform?: ContextTransformDef
  multiResult?: MultiResultDef
  extract?: Record<string, ExtractRule>
  priority?: number
  liftStrategy?: string
}

// ─── Style ───

export interface StylePreset {
  id: string
  name: Record<string, string>
  io_style: 'cout' | 'printf'
  naming_convention: 'camelCase' | 'snake_case'
  indent_size: number
  brace_style: 'K&R' | 'Allman'
  namespace_style: 'using' | 'explicit'
  header_style: 'bits' | 'individual'
}

// ─── Lift Context ───

export interface Declaration {
  name: string
  type: string
  scope: number
}

export interface LiftContextData {
  declarations: Declaration[]
  usingDirectives: string[]
  includes: string[]
  macroDefinitions: string[]
  scopeStack: ScopeFrame[]
}

export interface ScopeFrame {
  level: number
  declarations: Declaration[]
}

// ─── Workspace State (Persistence) ───

export interface WorkspaceState {
  version: number
  tree: SemanticNode
  language: string
  style: string
  locale: string
  topicId: string
  enabledBranches: string[]
}

// ─── Lift Result ───

export interface LiftError {
  message: string
  sourceRange?: SourceRange
  level: 'warning' | 'error'
}

export interface LiftResult {
  tree: SemanticNode
  errors: LiftError[]
  hasUnresolved: boolean
}

// ─── Toolbox ───

type ExtraBlockDef = string | { type: string; extraState?: Record<string, unknown> }

/**
 * 工具箱分類裡的一個**段落**：一個來源的一個登錄分類。
 *
 * 段落的**順序**是教學設計（宣告的）；段落的**成員**是導出的（登錄表知道）。
 * 這條線是整個工具箱導出的判準——問「登錄表知道嗎」，不問「這是不是一份清單」。
 */
export interface ToolboxSource {
  /** 來源：std 模組的 header（`'<string>'`）、`'(core)'`、`'(universal)'` */
  from: string
  /** 該來源裡的登錄分類（積木 JSON 的 `category`） */
  category: string
}

export interface ToolboxCategoryDef {
  key: string
  nameKey: string
  fallback: string
  colorKey: string
  /**
   * **有序**的段落清單——順序即學生看到的順序。
   *
   * 取代了原本的 `registryCategories: string[]` ＋ 80 筆手寫 `extraTypes`。
   * 實測發現既有的每一個分類，其積木順序**本來就是**一串互不重複的連續段落
   * （`<cstring>/strings → <string>/containers → <cctype>/stdlib → …`），
   * 所以這個形狀是把既有的教學設計**寫下來**，不是重新發明一個。
   */
  sources: ToolboxSource[]
  /**
   * 只留**帶 `extraState`** 的入口——那是「這個預設狀態值得一個獨立入口」的
   * 教學判斷（三個 `u_if` 變體），登錄表推不出來。
   *
   * 純字串的項目已全數消除：那些是「這顆積木屬於這個分類」，**登錄表知道**。
   */
  extraTypes?: ExtraBlockDef[]
  excludeTypes?: string[]
  /** If true, this category uses the I/O builder (iostream/cstdio sorting) */
  isIoCategory?: boolean
  /** Custom content builder for special categories */
  buildContents?: (registry: import('./block-spec-registry').BlockSpecRegistry, visibleConcepts: Set<string>, ioPreference: 'iostream' | 'cstdio') => { kind: string; type: string }[]
}

// ─── Topic System ───

/** Topic 代表一個使用情境的投影組態 */
export interface Topic {
  id: string
  language: string
  name: string
  default?: boolean
  description?: string
  levelTree: LevelNode
  blockOverrides?: Record<string, BlockOverride>
}

/** 層級樹中的一個節點 */
export interface LevelNode {
  id: string
  level: number
  label: string
  concepts: string[]
  children: LevelNode[]
}

/** Topic 對特定概念的積木呈現覆蓋 */
export interface BlockOverride {
  message?: string
  tooltip?: string
  args?: BlockArgOverride[]
  renderMapping?: Partial<RenderMapping>
}

/** BlockOverride 中的 arg 覆蓋項目 */
export interface BlockArgOverride {
  name: string
  type?: string
  options?: Array<[string, string]>
  _remove?: boolean
  _insert?: string
  [key: string]: unknown
}
