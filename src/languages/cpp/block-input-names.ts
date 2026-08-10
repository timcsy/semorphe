/**
 * C++ 積木插槽名的唯一真相。
 *
 * 與 `src/blocks/block-input-names.ts` 同一個形狀，只是涵蓋**語言專屬**的積木。
 *
 * ## 為什麼要分兩個模組
 *
 * 那一個只載入 universal 積木——要讓它涵蓋語言積木，它就得引用語言套件，
 * 而它住在核心側。核心不認識語言（P9）。
 *
 * 所以正確的形狀是：**語言套件自己提供一份**。語言套件引用自己的宣告檔沒有
 * 任何問題，而積木註冊處（在介面層）從兩邊各取所需。
 *
 * 見 specs/057-single-source-input-names
 */
import type { BlockProjectionJSON } from '../../core/types'
import coreBlocks from './core/blocks.json'
import { allStdModules } from './std'
import { componentBlocks } from '../../core/component/registry'

interface InputNames {
  value: string[]
  statement: string[]
}

const all = [
  ...(coreBlocks as unknown as BlockProjectionJSON[]),
  ...allStdModules.flatMap((m) => m.blocks),
  ...(componentBlocks() as BlockProjectionJSON[]),
]

function extract(blockDef: Record<string, unknown>): InputNames {
  const value: string[] = []
  const statement: string[] = []
  for (const key of Object.keys(blockDef).sort()) {
    const args = blockDef[key]
    if (!key.startsWith('args') || !Array.isArray(args)) continue
    for (const a of args as { type?: string; name?: string }[]) {
      if (!a?.name) continue
      if (a.type === 'input_value') value.push(a.name)
      else if (a.type === 'input_statement') statement.push(a.name)
    }
  }
  return { value, statement }
}

function getInputs(blockType: string): InputNames {
  const spec = all.find((b) => (b.blockDef as Record<string, unknown>)?.type === blockType)
  if (!spec) throw new Error(`找不到 ${blockType} 的積木宣告——插槽名沒有唯一真相可用`)
  return extract(spec.blockDef as Record<string, unknown>)
}

export const CPP_STRING_AT_INPUTS = getInputs('cpp_string_at')
export const C_COMPOUND_ASSIGN_INPUTS = getInputs('cpp_var_assign_compound')
export const C_COMPOUND_ASSIGN_EXPR_INPUTS = getInputs('cpp_var_assign_compound_expression')
export const C_VAR_DECLARE_EXPR_INPUTS = getInputs('cpp_var_declare_expression')
