// ─── Property Values ───

export type PropertyValue = string | number | boolean | string[]

// ─── Component IDs ───

/**
 * 元件身分：`<scope>:<name>`。
 *
 * ## 為什麼這裡沒有一份「通用概念」的聯集了（2026-08-09 刪）
 *
 * 這裡原本列著 24 顆 `UniversalComponent` 的字面聯集。**D 之後它對型別零貢獻**——
 * 所有身分都加上了 `:`，於是每一顆都已經是 `` `${string}:${string}` ``，
 * 整個聯集被完全吸收（`UniversalComponent extends ComponentId` 恆真，反向不成立）。
 * 而 `UniversalComponent` 除了餵這一行之外沒有任何使用者。
 *
 * ⚠️ 它同時是 P9 的一筆違規，而**中立性護欄回報 0**——那條護欄按設計遮掉
 * 「型別位置的聯集成員」。加一顆通用元件本來要編輯核心的型別；現在不用了。
 * （`draft/2026-08-07-元件目錄與膠囊契約.md` §九 把這批列為「落在護欄維度外面」，
 * 而正確的處置比改護欄便宜：刪掉，沒有任何東西會變。）
 */
export type ComponentId = `${string}:${string}`

// ─── Semantic Tree ───

export interface SemanticNode {
  id: string
  componentId: string
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
  /**
   * **解析器指名的「該有而沒有」**（spec 143）。
   *
   * ⚠️ **陣列而不是單值**：一個節點底下可能少好幾個東西，
   * 而合併之後「哪裡」就消失了——「哪裡」正是這一格加的全部。
   *
   * 🔴 **有缺口才有這一格**。看不懂的那些（`@@@ ###`）沒有 MISSING 節點，
   * 於是這一格不存在，而它們仍然走既有的 `SYNTAX_ERROR` 診斷
   * ——**訊息一個字不變**（FR-004：找不到就完全不提）。
   *
   * 型別住在 `core/diagnostics.ts`（`SyntaxGap`），而這裡用結構型別避免循環相依。
   */
  syntaxGaps?: { missing: string; line: number; column: number }[]
  rawCode?: string
  sourceRange?: SourceRange
  /** Block ID from which this node was extracted (for block↔code highlight mapping) */
  sourceBlockId?: string
  /**
   * **原文的排版偏好**——「這個節點在原始碼裡長什麼樣」，而語義不看它。
   *
   * 🔴 **它在 `metadata` 而不是 `properties`，是刻意的**：積木上沒有這一格、
   * 學生不必知道，而產生器要能把使用者的碼原樣還回去。
   *
   * > **投影記住它，積木看不到它。**（空行那一刀的同一句話）
   *
   * 今天的唯一消費者：Python 的固定組合——`a, b = 1, 2` 沒有括號，
   * 而 `(1, 2)` 有；兩者語義相同，硬加括號等於改了使用者的碼。
   *
   * ⚠️ 使用者在積木那側改過之後這一格會不在，那時產出預設的排版
   * ——**仍然正確**。排版的遺失不是語義的遺失。
   */
  layoutHints?: Record<string, boolean>
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

// ─── Component System ───


export interface ComponentDef {
  id: string
  abstractComponent?: string
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
   * 陣列代表**同時屬於多個分類**（`cpp_memory_fill` 既是文字也是記憶體操作）。
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
   * 舊名 `component`——與 `SemanticNode.component`（一個**字串**）同名而不同義，
   * 是 2026-08-06 那次改名翻車的直接原因：腳本分不出「值是物件」與「值是
   * 字串」的兩種 `component`，而測試檔不在型別檢查範圍內，改錯了照樣編得過。
   *
   * 改名讓「`component`」在專案裡的意思收斂。見 experience「同一個欄位名長在
   * 三個不同型別上時」。
   */
  componentMapping: ComponentMapping
  blockDef: Record<string, unknown>
  codeTemplate: CodeTemplate
  astPattern: AstPattern
  renderMapping?: RenderMapping
}

export interface ComponentMapping {
  componentId: string
  /**
   * 這顆概念屬於哪一層——**呈現層要分「通用 vs 語言專屬」時問這裡，
   * 不要看名字的前綴。**
   *
   * ⚠️ 116 之前，工具箱用 `blockType.startsWith('u_')` 判。積木型別改成
   * 從身分導出之後沒有型別以 `u_` 開頭，那個判斷**靜靜地失效**
   * （`universalIo` 恆為空，iostream／printf 的排序偏好不再有作用）。
   *
   * > **命名慣例不是契約。** 要判斷「這顆概念是不是 X」，就宣告一個 X 標註。
   */
  abstractComponent?: string
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

/**
 * 一筆 lift 樣式的**種類**——🔴 **這是唯一真相**（spec 157）。
 *
 * 它原本只是 `AstPattern.patternType` 上的一個字面聯集，
 * 而 `lift-pattern.json` 是**資料**：TypeScript 檢查不到它。
 * ⚠️ spec 156 寫了一筆 `patternType: 'named-call'`——**不在這個集合裡**，
 * 而它被 `componentLiftPatterns()` 的 glob **收進生產路徑，沒有任何東西說話**。
 *
 * > **一筆型別不合法的宣告被讀了進去，而讀的人不驗。**
 *
 * 🟢 提成執行期的常數，讓護欄**用同一份**去驗——
 * ⚠️ **不要在測試裡再抄一份**：兩份判準遲早會漂。
 */
export const PATTERN_TYPES = [
  'simple', 'operatorDispatch', 'chain', 'composite', 'unwrap', 'contextTransform', 'multiResult',
] as const
export type PatternType = (typeof PATTERN_TYPES)[number]

export interface AstPattern {
  /** 🔴 這個 AST 形狀寫給哪個文法——理由與 `LiftPattern.grammar` 相同。 */
  grammar: GrammarId
  nodeType: string
  constraints: AstConstraint[]
  patternType?: PatternType
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
  /**
   * 🔴 **要求這個欄位【不存在】**（spec 168）。
   *
   * 在此之前，缺欄位一律讓 constraint 失敗（`if (!child) return false`），
   * 於是「這個欄位必須沒有」**表達不出來**。
   *
   * 而它不是一個罕見的需求：Python 的 `if_statement` 帶不帶 `alternative`
   * 是**兩顆不同的元件**（`if` vs `if_else`），而 `elif` 是第三種——
   * 沒有這個欄位的話，不帶 else 的那一筆只能寫成「沒有 constraint」，
   * 於是**帶 elif 的 if 會被它接走，而那兩個分支被靜靜丟掉**。
   *
   * > **一個語言表達不出「必須沒有」，就只能用「沒有限制」代替——
   * > 而那兩件事在執行時完全不同。**
   */
  absent?: boolean
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
    fromComponent: string
    toComponent: string
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
  componentId: string
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
  /**
   * 把一個接點的子節點序列化進**一個文字欄位**，並解析回來。
   *
   * 與 `dynamicRules` 是**兩種不同的形態**——那個是「每項一組欄位」
   * （`cpp_func_def` 的 `TYPE_{i}`／`PARAM_{i}`），這個是「全部擠進一個欄位」
   * （`cpp_lambda` 的 `PARAMS`）。並列在同一層，讓「這顆元件的參數長什麼樣」
   * 一眼看得出來。
   *
   * 見 `src/core/projection/children-as-field.ts` 的檔頭（含**升級成結構化
   * 插槽的三個訊號**）。
   */
  childrenAsField?: ChildrenAsField[]
}

import type { ChildrenAsField } from './projection/children-as-field'
export type { ChildrenAsField }

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
  /** Component to create for each element (used with fieldPattern groups) */
  childComponent?: string
  /** Map of field patterns → property names for childComponent nodes */
  childFields?: Record<string, string>
  /** If true, the inputPattern refers to statement inputs (chains) rather than expression inputs */
  isStatementInput?: boolean
}

/** Describes how to extract a value in a specific mode (select, input, expression, etc.) */
export interface ModeExtractRule {
  /** Path in extraState to read the value (for select/input modes) */
  field?: string
  /** Wrap the value as this component (e.g., "var_ref", "number_literal") */
  /**
   * ⚠️ **已由 `wrapTrait` 取代**（2026-08-11）。留著是為了不打破外部的自訂積木。
   *
   * 它的值是一個**元件身分**，而那讓宣告這條規則的那顆元件永遠搬不進膠囊
   * ——就近性護欄的反向檢查會說「膠囊裡出現別顆元件的身分」。
   */
  wrap?: string
  /**
   * 把選到的文字包成「有這個性狀的那顆元件」。
   *
   * > **一個宣告要指涉另一顆元件時，指它的性質而不是它的名字。**
   *
   * `wrapTrait: 'variableRef'` 讀作「包成一個變數參照」——
   * 哪一顆元件是變數參照由它自己宣告，這裡不必知道。
   */
  wrapTrait?: string
  /** Read from block input (for expression/compose modes) */
  input?: string
}

// ─── Split JSON Formats (Phase 3: component/blockDef separation) ───

/** 五路完備性的路徑名 */
export type PathName = 'lift' | 'render' | 'extract' | 'generate' | 'execute'

/** Component definition in components.json (semantic layer) */
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

export interface ComponentDefJSON {
  componentId: string
  abstractComponent?: string | null
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
   *   ① 必須真的有概念宣告它為 `abstractComponent`
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
   * 陣列代表**同時屬於多個分類**（`cpp_memory_fill` 既是文字也是記憶體操作）。
   *
   * ⚠️ **中性形態不寫這一欄。** 它不進工具箱是推導出來的
   * （這個身分有多個形態，而這一顆沒有 `form`），不是靠漏掉它。
   */
  toolboxCategory?: string | string[]

  id: string
  componentId: string
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
    components: string[]
    blocks: string[]
    templates: string[]
    liftPatterns: string[]
  }
}

// ─── Universal Template (Language-specific code templates for universal components) ───

export interface UniversalTemplate {
  componentId: string
  pattern?: string
  styleVariants?: Record<string, CodeTemplate>
  styleKey?: string
  order: number
  imports?: string[]
}

// ─── Lift Pattern (JSON-driven AST→Semantic patterns) ───

/**
 * **文法**——`astNodeType` 這個字串所屬的命名空間。
 *
 * 🔴 **它不是「語言」。** `cpp` 套件一個文法（tree-sitter-cpp）服務四個教學語言
 * （c-beginner／cpp-beginner／cpp-competitive／arduino）——以語言為鍵過濾，
 * `c-beginner` 會拿不到 C++ 的 pattern。
 *
 * 取值採用**解析器的名字**（`tree-sitter-cpp`／`tree-sitter-python`），
 * 因為它**已經是出貨的 wasm 檔名**——對得起來、查得到，不是自創代號。
 */
export type GrammarId = string

export interface LiftPattern {
  id: string
  /**
   * 🔴 **這一筆 pattern 寫給哪個文法——必填，而且【不得】從任何名字、路徑或前綴推導。**
   *
   * tree-sitter-python 與 tree-sitter-cpp 大量同名：`if_statement`／`while_statement`／
   * `for_statement`／`return_statement`／`identifier`／`call`。
   *
   * > **兩個文法各自獨立命名，而它們自然會撞名——因為它們描述的是同一批程式語言概念。
   * > 撞名不是巧合，是必然。而 pattern 的比對鍵剛好只有那個名字。**
   *
   * ⚠️ **為什麼不從 `component.componentId` 的前綴導**：5 筆 `operatorDispatch` pattern
   * （negate／logic_not／logic／compare／arithmetic）**沒有 componentId**——身分依運算子而定。
   *
   * ⚠️ **為什麼不從膠囊資料夾導**：那是慣例不是契約，而這個專案在
   * 「拿名字的形狀做判斷」上付過**三次**學費（型別追蹤靜靜失效、單步除錯完全失效、
   * 一整族從護欄的信號裡消失）——**三次都不會讓測試變紅**。
   * 清單與原文見 `knowledge/skills/component-rename/SKILL.md` 第 6 步。
   */
  grammar: GrammarId
  astNodeType: string
  component?: { componentId: string }
  patternType?: PatternType
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
   * 教學判斷（三個 `cpp_if` 變體），登錄表推不出來。
   *
   * 純字串的項目已全數消除：那些是「這顆積木屬於這個分類」，**登錄表知道**。
   */
  extraTypes?: ExtraBlockDef[]
  excludeTypes?: string[]
  /** If true, this category uses the I/O builder (iostream/cstdio sorting) */
  isIoCategory?: boolean
  /** Custom content builder for special categories */
  buildContents?: (registry: import('./block-spec-registry').BlockSpecRegistry, visibleComponents: Set<string>, ioPreference: 'iostream' | 'cstdio') => { kind: string; type: string }[]
}

// ─── Target（目標）───

/**
 * **目標**——把「哪些概念看得到」與「產出什麼形狀」綁成一個具名的組合。
 *
 * ## 它從哪來
 *
 * 使用者今天要**分三個地方各選一次**（課程清單／風格／心裡記著用什麼編譯器驗），
 * 而**沒有任何東西保證那三次一致**。
 *
 * > **三個機制各自都對，而沒有東西保證它們指向同一個世界。**
 *
 * ## 🔴 它不擁有任何資料
 *
 * `topic` 與 `style` 是**指向既有東西的引用**，`id`／`name` 是標籤。
 * **四個欄位，兩個引用兩個標籤——零新機制。**
 * ⚠️ 加一個「只有目標才有」的欄位，它就從**組合**變成**新的抽象層**了
 * ——而那正是 `draft/2026-08-13-C和C++難分難捨.md`§三 明確排除的。
 *
 * ## ⚠️ 而「具名」不是便利，是那個組合【本身就是一個身分】
 *
 * 2026-08-17 動手時發現：**沒有任何既有 style 欄位標得出「這是 C」**
 * ——`printf` 競賽也是（而它是 C++），`explicit` google 也是。
 * 靠合取推出來的「這是 C」，只是今天剛好沒有別人命中。
 *
 * > **一個靠既有欄位合取推出來的身分，不是一個身分。**
 *
 * ## ⚠️ 本輪只做兩格
 *
 * 完整設計有四格（`visible`／`io`／`provides`／`reference`）。
 * **本輪只做前兩格**——`provides`（這個世界提供什麼能力）與
 * `reference`（用什麼驗證）**沒有做**。
 * 🔴 **不得因為這個型別存在就以為目標已經完整。**
 */
export interface Target {
  id: string
  name: string
  /**
   * 這個目標提供哪些**能力**（capability）。
   *
   * 🔴 **省略 ＝ 提供全部**，不是「一個都不提供」。
   *
   * 非硬體目標（`cpp`／`c`／競程）沒有板子的概念，而它們**不得因為多了這一格
   * 就開始少東西**——所以預設值的方向必須是「全都有」。
   * ⚠️ 反過來設計的話，加這一格的當下三個既有目標會整批清空。
   *
   * 元件那一端宣告 `traits.needsCapability`（見 `component/traits.ts`）。
   * 工具箱的可見集合 ＝ 課程清單 ∩ 這裡提供的。
   *
   * > **一個新的維度加進既有的宣告時，它的預設值要讓【沒宣告的人】
   * > 保持原狀——否則加一格等於改全部。**
   *
   * 見 `specs/142-arduino-board-targets/data-model.md`。
   */
  provides?: readonly string[]
  /**
   * 這個目標把某個標頭**換成別的名字**——`<WiFi.h>` → `<ESP8266WiFi.h>`。
   *
   * 🔴 **它與 C 目標那兩支換名字的函式是【三個不同的問題】**（spec 150）：
   *
   * ```
   * toCHeader        這個標頭在 C 裡【叫什麼】        cmath → math.h
   * cIoHeaderFor     C 裡【什麼標頭】滿足這個需求      iostream → stdio.h
   * headerAliases    【這塊板子】上它叫什麼           WiFi.h → ESP8266WiFi.h
   * ```
   *
   * ⚠️ spec 146 就是在這裡踩過一次：
   * **兩個函式如果回傳同一種型別，很容易被合成一個——而它們答的是不同的問題。**
   *
   * 🟢 **省略 ＝ 不換任何標頭**，所以既有的目標一個字都不變。
   */
  headerAliases?: Readonly<Record<string, string>>
  /**
   * 這個目標的**板子模型**（腳位上界 ＋ 具名常數）——spec 145。
   *
   * 🔴 **它與 `provides` 是兩件事**：`provides` 是「有沒有這個能力」（布林集合），
   * 這裡是「**是多少**」（值）。
   *
   * > **一個宣告如果同時裝「有沒有」與「是多少」，讀它的每一個消費者
   * > 都要先分辨自己拿到的是哪一種——而那個分辨會在每個消費點各寫一次。**
   *
   * ⚠️ **省略 ＝ 這個目標沒有板子**（`cpp`／`c`／競程）。
   */
  board?: BoardPinModel
  /** 指向一個**既有的**課程清單 id——決定哪些概念看得到 */
  topic: string
  /** 指向一個**既有的**風格 id——決定產出什麼形狀 */
  style: string
  /**
   * 這個目標的程式**外殼**長什麼樣。
   *
   * ```
   * 'main'（預設）  using namespace std; ＋ int main() { … return 0; }
   * 'none'          沒有外殼——函式就是頂層（Arduino 的 setup()／loop()）
   * ```
   *
   * 🔴 **為什麼是宣告在目標上，不是由程式碼去認名字。** 使用者在 Arduino IDE
   * 開 `.ino`，而鷹架把 `setup()`／`loop()` **包進了 `int main()`**
   * ——⚠️ 那不是顯示問題，它寫進了使用者的檔案。
   *
   * 而修法不可以是「`src/ui` 認得 `arduino` 這個名字」：那一層不該認識
   * 任何具體的目標（中立性護欄在看）。**讓目標自己說。**
   *
   * > **要讓一個通用的層知道特例，辦法是讓特例自己帶著宣告來，
   * > 不是讓通用的層去記住特例的名字。**
   */
  entryShell?: 'main' | 'none'
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
  components: string[]
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

/**
 * **一塊板子的腳位模型**（spec 145）。
 *
 * ⚠️ **它住在核心，是因為它一個 C++ 的字都不認識**——只是三個數值欄位。
 * 理由與 `component/traits.ts` 的 `ioTraitOf` 逐字相同：
 *
 * > 「它原本住在 `languages/cpp/…`，而它的消費者是 `ui/…`，
 * > 於是**視圖層為了問一句話而 import 了整個 C++ 語言套件**
 * > ——P9 語言獨立性的字面違反（第三十九條護欄抓到）。」
 *
 * 🔴 **這一次也是那條護欄抓到的**，在同一個位置。
 */
export interface BoardPinModel {
  /** 給人看的名字——⚠️ 錯誤訊息要說得出是哪一塊板子。 */
  name: string
  /**
   * 這塊板子**真的有哪些腳位**——閉區間的清單。
   *
   * 🔴 **不是一個上界。** ESP32 的號碼跑到 39，**而它沒有 GPIO 20／24／28–31**
   * ——用上界判定的話 `digitalWrite(30, HIGH)` 會靜靜地過（30 < 39），
   * 而那支腳在真板子上根本不存在。
   *
   * > **一個用「最大值」表達的集合，會把中間的洞一起收進來。**
   *
   * ⚠️ ESP8266 的 `A0` 是 17，而它的數位腳只到 16——所以 17 也在集合裡，
   * 它是**類比輸入**不是數位腳（方向那一層今天沒有模型，見 spec 147 明確排除）。
   */
  pins: readonly { readonly from: number; readonly to: number }[]
  /**
   * 這份資料**抄自哪裡**——上游 variant 檔案的路徑。
   *
   * 🔴 **spec 147 的存在理由**：前一版的「ESP32 沒有 `A0`」與「Nano ＝ Uno」
   * 都是**憑印象填的**，而其中一個還長出了一條護欄把它固定住。
   *
   * > **一個沒附來源的事實主張，長出護欄之後就變成不可質疑的。**
   */
  source: string
  /** 這塊板子提供的具名常數。⚠️ 沒有的名字要**查不到**，不是給別的板子的值。 */
  constants: Readonly<Record<string, number>>
}

/**
 * 一個「風格例外」——某個節點不符合目前的風格偏好，而它**轉得過去**。
 *
 * 🔴 **spec 153 從 `languages/cpp/style-exceptions.ts` 搬進來**：
 * 它的四個欄位**一個語言專屬的東西都沒有**（節點／說明／建議／怎麼轉），
 * 而視圖層（`sync-controller`）需要它的型別。
 *
 * > **中立的形狀住在核心，語言專屬的規則住在語言套件。**
 * ⚠️ 而**規則**（哪些算例外、怎麼轉）仍然由語言套件推進來——那不是這裡的事。
 */
export interface StyleException {
  /** 那個節點 */
  node: SemanticNode
  /** 給人看的說明 */
  label: string
  /** 轉過去會變成什麼（描述） */
  suggestion: string
  /** 執行轉換——回替代節點，或 `null` 代表移除 */
  convert: () => SemanticNode[] | null
}

/**
 * 一段程式碼**符不符合目前的風格偏好**——中立的那一半。
 *
 * 🔴 **spec 153**：視圖層（`sync-controller`）只讀 `verdict`，其餘欄位它只是轉交。
 * 而語言專屬的細節（C++ 的 `iostreamCount`／`cstdioCount`）**留在語言套件**
 * ——把它們搬進核心等於把語言知識搬進核心。
 *
 * > **視圖需要的是【判決】，不是【證據】。**
 */
export interface StyleConformance {
  verdict: 'conforming' | 'minor_exception' | 'bulk_deviation'
}
