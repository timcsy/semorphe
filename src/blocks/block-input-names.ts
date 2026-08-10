/**
 * Single source of truth for block input names.
 *
 * Both `universal.json` (blockDef) and `app.new.ts` (dynamic registration)
 * define input names for blocks. This module extracts canonical input names
 * from the JSON specs so that dynamic registration code references them
 * instead of hardcoding duplicate string literals.
 *
 * If a blockDef input name changes in JSON, the dynamic registration
 * automatically picks up the change — no dual maintenance.
 */
import type { BlockSpec } from '../core/types'
import { BlockSpecRegistry } from '../core/block-spec-registry'
import { universalConcepts, universalBlocks } from './universal'

const _registry = new BlockSpecRegistry()
_registry.loadFromSplit(universalConcepts, universalBlocks)
const specs = _registry.getAll()

interface InputNames {
  value: string[]
  statement: string[]
  field: Record<string, string>  // field name → default text
}

/** Extract value/statement input names and field names from a blockDef */
function extractInputNames(blockDef: Record<string, unknown>): InputNames {
  const value: string[] = []
  const statement: string[] = []
  const field: Record<string, string> = {}
  for (const key of Object.keys(blockDef)) {
    const args = blockDef[key]
    if (!key.startsWith('args') || !Array.isArray(args)) continue
    for (const arg of args as Array<{ type: string; name: string; text?: string }>) {
      if (arg.type === 'input_value') value.push(arg.name)
      else if (arg.type === 'input_statement') statement.push(arg.name)
      else if (arg.type === 'field_input' || arg.type === 'field_dropdown') {
        field[arg.name] = arg.text ?? ''
      }
    }
  }
  return { value, statement, field }
}

function getSpec(blockType: string): BlockSpec {
  const spec = specs.find(s => (s.blockDef as Record<string, unknown>)?.type === blockType)
  if (!spec) throw new Error(`BlockSpec not found for ${blockType} in universal-blocks.json`)
  return spec
}

function getInputs(blockType: string): InputNames {
  return extractInputNames(getSpec(blockType).blockDef)
}

// Pre-extract for blocks that have dynamic overrides in app.new.ts
export const IF_INPUTS = getInputs('cpp_if')
export const WHILE_INPUTS = getInputs('cpp_loop_while')
export const COUNT_LOOP_INPUTS = getInputs('cpp_loop_count')

// 057：把寫死的插槽名換成這裡導出的常數——JSON 改了動態註冊自動跟上
//
// ⚠️ **本模組只涵蓋 universal 積木**（它只載入 universal-blocks.json）。
// 語言專屬積木（`cpp_string_at`、`cpp_var_assign_compound` 等）的插槽名因此仍然
// 寫死——要涵蓋它們，這個模組得引用語言套件，那與「核心不認識語言」相衝。
// 那是另一個決定，不在 057 的範圍。**不硬湊。**
export const FUNDEF_INPUTS = getInputs('cpp_func_def')
export const RETURN_INPUTS = getInputs('cpp_return')
export const ARRAY_DECLARE_INPUTS = getInputs('cpp_array_declare')
export const ARRAY_ACCESS_INPUTS = getInputs('cpp_array_at')
export const ARRAY_ASSIGN_INPUTS = getInputs('cpp_array_assign')
export const VAR_ASSIGN_INPUTS = getInputs('cpp_var_assign')

// Re-export the extractor for use in tests
export { extractInputNames, getInputs }
