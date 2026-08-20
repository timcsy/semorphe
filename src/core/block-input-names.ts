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
import type { BlockSpec } from './types'
import { BlockSpecRegistry } from './block-spec-registry'
// ⚠️ **第十個組裝點**（2026-08-11）：這裡原本只讀 `universal-blocks.json`。
// 一顆通用元件搬進膠囊之後它就查不到了，症狀是
// `BlockSpec not found for cpp_loop_while in universal-blocks.json`
// ——**訊息指著一個已經不是唯一來源的檔**。
//
// > **每一處「自己列舉來源」的地方，都會在下一次搬家時漏掉一種來源。**
import { universalConcepts, universalBlocks } from './universal'
import { componentConcepts, componentBlocks } from './component/registry'
import type { ConceptDefJSON, BlockProjectionJSON } from './types'

const _registry = new BlockSpecRegistry()
_registry.loadFromSplit(
  [...universalConcepts, ...(componentConcepts() as unknown as ConceptDefJSON[])],
  [...universalBlocks, ...(componentBlocks() as BlockProjectionJSON[])],
)
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
  if (!spec) throw new Error(`BlockSpec not found for ${blockType}（找過 universal-blocks.json 與全部元件膠囊）`)
  return spec
}

function getInputs(blockType: string): InputNames {
  return extractInputNames(getSpec(blockType).blockDef)
}

// 🔴 **這裡不再有任何積木型別**（spec 154）。
//
// 原本有九個 `getInputs('cpp_*')` 常數，而它們**唯一的消費者是
// `src/ui/block-registrar.ts`**——一個只服務單一語言的模組，
// 住在 `core/` 只是**位置**，不是**身分**。
//
// > **核心層是所有語言共用的那一份，所以它的違規比視圖層更硬。**
//
// 🟢 常數搬去 `languages/cpp/block-input-names.ts`（那裡本來就有同形狀的機制），
// 由**組裝點**注入給 registrar。這裡只留 `extractInputNames`／`getInputs`
// ——⚠️ 它們是**通用工具**，一個語言專屬的字都沒有。

// Re-export the extractor for use in tests
export { extractInputNames, getInputs }
