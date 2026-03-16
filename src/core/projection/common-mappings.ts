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
