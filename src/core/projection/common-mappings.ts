/**
 * Shared field→property and input→child mappings used by both
 * PatternExtractor and PatternRenderer.
 * Also provides a shared block ID counter.
 */

// ─── Block ID Counter ───

let blockIdCounter = 0

/** Generate a unique block ID with the given prefix. */
export function nextBlockId(prefix: string): string {
  return `${prefix}${++blockIdCounter}`
}

/** Reset the block ID counter (called at the start of each render pass). */
export function resetBlockIdCounter(): void {
  blockIdCounter = 0
}

/** Maps Blockly field names to semantic property names */
export const FIELD_COMMON_MAPPINGS: Record<string, string[]> = {
  'OP': ['operator'],
  'NUM': ['value'],
  'TEXT': ['value'],
  'VAR': ['variable', 'var_name'],
  'ARRAY': ['name'],
  'NS': ['namespace'],
  'HEADER': ['header'],
  'RETURN_TYPE': ['return_type'],
  'PARAMS': ['params'],
  'ARGS': ['args'],
  'BOUND': ['inclusive'],
  'FORMAT': ['format'],
  'POSITION': ['position'],
}

/** Maps Blockly input names to semantic child slot names */
export const INPUT_COMMON_MAPPINGS: Record<string, string[]> = {
  'COND': ['condition'],
  'CONDITION': ['condition'],
  'THEN': ['then_body', 'then'],
  'ELSE': ['else_body', 'else'],
  'BODY': ['body', 'then_body'],
  'A': ['left', 'operand'],
  'B': ['right'],
  'EXPR': ['values', 'expression'],
  'VALUE': ['value', 'initializer'],
  'INIT': ['initializer'],
}

// ─── Dynamic Rule Utilities ───

/**
 * Resolve a dotpath from an object, supporting array indexing with [N].
 * Examples: "argCount", "args.length", "args[0].mode"
 * Template form with {i}: "args[{i}].mode" → resolved by caller replacing {i} first.
 */
export function resolvePath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Resolve a pattern string by replacing {i} with the given index.
 * Example: "ARG_{i}" with i=2 → "ARG_2"
 */
export function resolvePattern(pattern: string, index: number): string {
  return pattern.replace(/\{i\}/g, String(index))
}

// ─── 推導欄位對應：**唯一一份** ───

/**
 * 從積木定義推導「積木欄位 ↔ 語義參數」的對應。
 *
 * ## ⚠️ 這裡曾經有兩份，而兩份不一樣
 *
 * `PatternRenderer` 與 `PatternExtractor` 各有一份 `deriveRenderMapping`。
 * 渲染那份認 `field_multilinetext`，抽取那份**不認**——於是
 * `c_comment_block` 的內容**渲染得出去、抽取不回來**：使用者在積木編輯器裡
 * 寫的區塊註解會消失，而唯一的症狀是「切換積木風格之後東西不見了」。
 *
 * `c_comment_doc` 幾乎一模一樣卻沒中，只因為它剛好有**顯式**的 `fields`。
 * **一顆會掉、一顆不會，而兩顆看起來一樣。**
 *
 * > **同一件事在兩個地方各推導一次，就是在等它們分歧。**
 *
 * 兩份已合併成這一份。一致性有護欄在看（`audit-derive-agreement`）——
 * 它餵同一個輸入給渲染與抽取，比對兩邊的輸出，而不是比對程式碼。
 *
 * ## 這份推導**還會被消滅**
 *
 * 它讀 `concept.properties` 去比對積木欄位名，於是**參數宣告驅動了抽取行為**
 * ——那是 C1（參數規格化）的卡點。下一步是把推導結果固化成顯式宣告，
 * 之後這個函式就沒有呼叫者了。見 `knowledge/vision.md` 的 C1。
 */
export function deriveRenderMapping(
  blockDef: Record<string, unknown>,
  properties: readonly string[],
  children: Record<string, unknown>,
): { fields: Record<string, string>; inputs: Record<string, string>; statementInputs: Record<string, string> } {
  const mapping = {
    fields: {} as Record<string, string>,
    inputs: {} as Record<string, string>,
    statementInputs: {} as Record<string, string>,
  }

  const allArgs: Array<Record<string, unknown>> = []
  for (let i = 0; i <= 9; i++) {
    const args = blockDef[`args${i}`] as Array<Record<string, unknown>> | undefined
    if (args) allArgs.push(...args)
  }

  for (const arg of allArgs) {
    const argType = arg.type as string
    const argName = arg.name as string
    if (!argName) continue

    // ⚠️ 這份清單是分歧的所在——`field_multilinetext` 曾經只有一邊認得。
    if (
      argType === 'field_input' ||
      argType === 'field_dropdown' ||
      argType === 'field_number' ||
      argType === 'field_multilinetext'
    ) {
      const semProp = findMatchingProperty(argName, properties)
      if (semProp) mapping.fields[argName] = semProp
    } else if (argType === 'input_value') {
      const semChild = findMatchingChild(argName, children)
      if (semChild) mapping.inputs[argName] = semChild
    } else if (argType === 'input_statement') {
      const semChild = findMatchingChild(argName, children)
      if (semChild) mapping.statementInputs[argName] = semChild
    }
  }

  return mapping
}

/** 積木欄位名 → 語義參數名。先大小寫不敏感全等，再查共用對照表 */
export function findMatchingProperty(fieldName: string, properties: readonly string[]): string | null {
  const lower = fieldName.toLowerCase()
  for (const prop of properties) {
    if (prop.toLowerCase() === lower) return prop
  }
  const mapped = FIELD_COMMON_MAPPINGS[fieldName]
  if (mapped) {
    for (const m of mapped) {
      if (properties.includes(m)) return m
    }
  }
  return null
}

/** 積木輸入名 → 語義子節點名。同上 */
export function findMatchingChild(inputName: string, children: Record<string, unknown>): string | null {
  const lower = inputName.toLowerCase()
  for (const child of Object.keys(children)) {
    if (child.toLowerCase() === lower) return child
  }
  const mapped = INPUT_COMMON_MAPPINGS[inputName]
  if (mapped) {
    for (const m of mapped) {
      if (m in children) return m
    }
  }
  return null
}
