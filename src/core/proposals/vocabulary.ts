/**
 * **元件詞彙**——外部操作者（AI）組提議之前要知道的東西（spec 222；vision 286 缺口④）。
 *
 * 與提議的形態檢查**同一份宣告**（`OpSchema`）：照這份詞彙組的節點，形態檢查就認得——不另抄一份
 * （兩份一定會分岔，而分岔的症狀是「詞彙說有、提議說不認得」）。
 *
 * 純資料、可序列化。第一版不帶說明文字與例子。
 */
import type { OpSchema } from './tree-ops'
import { positionsOf } from '../component/traits'

export interface VocabularyEntry {
  componentId: string
  /** 能出現在語句還是運算式的位置 */
  positions: ('statement' | 'expression')[]
  properties: { name: string; kind: string; values?: string[]; required: boolean; default?: string }[]
  /** `accepts`：收什麼——種類（statement／expression…）、具名的元件或族 */
  slots: { slot: string; accepts: string[]; max?: number }[]
}

/** 這個語言（元件身分的前綴，例如 `cpp`）的詞彙，依身分排序。 */
export function vocabularyOf(schema: OpSchema, language: string): VocabularyEntry[] {
  const prefix = `${language}:`
  const out: VocabularyEntry[] = []
  for (const id of schema.ids().filter((x) => x.startsWith(prefix)).sort()) {
    const shape = schema.shape(id)
    if (!shape) continue
    out.push({
      componentId: id,
      positions: positionsOf(id),
      properties: (shape.props ?? []).map((p) => ({
        name: p.name,
        kind: String(p.kind),
        ...(p.values && p.values.length > 0 ? { values: [...p.values] } : {}),
        required: p.required === true,
        ...(p.default !== undefined ? { default: p.default } : {}),
      })),
      slots: shape.slots.map((s) => ({ slot: s.slot, accepts: [...s.allowed], ...(s.max !== undefined ? { max: s.max } : {}) })),
    })
  }
  return out
}
