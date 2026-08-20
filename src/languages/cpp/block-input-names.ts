/**
 * C++ 積木插槽名的唯一真相。
 *
 * 與 `src/core/block-input-names.ts` 同一個形狀，只是涵蓋**語言專屬**的積木。
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

// ── 🔴 spec 154：從 `core/block-input-names.ts` 搬過來的九個 ──────────────
//
// 那個檔的註解（057 寫的）早就標出這個張力，逐字：
//
// > ⚠️ **本模組只涵蓋 universal 積木**……語言專屬積木的插槽名因此仍然寫死
// > ——要涵蓋它們，這個模組得引用語言套件，那與「核心不認識語言」相衝。
// > **那是另一個決定，不在 057 的範圍。不硬湊。**
//
// 🟢 **spec 154 就是那個決定**：它們一個一個都是 `cpp_*`，
// 而核心層不該認得任何語言的積木型別（P9）。
//
// ⚠️ 而 `extractInputNames`／`getInputs` **留在核心**——那兩個是通用工具，
// 一個語言專屬的字都沒有。搬走它們才會製造匯入循環。
export const IF_INPUTS = getInputs('cpp_if')
export const WHILE_INPUTS = getInputs('cpp_loop_while')
export const COUNT_LOOP_INPUTS = getInputs('cpp_loop_count')
export const FUNDEF_INPUTS = getInputs('cpp_func_def')
export const RETURN_INPUTS = getInputs('cpp_return')
export const ARRAY_ACCESS_INPUTS = getInputs('cpp_array_at')
export const ARRAY_ASSIGN_INPUTS = getInputs('cpp_array_assign')
export const VAR_ASSIGN_INPUTS = getInputs('cpp_var_assign')
// ⚠️ `ARRAY_DECLARE_INPUTS` **沒有搬**——它零消費者（只剩一段註解提到它）。
