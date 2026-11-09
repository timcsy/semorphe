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
import { componentBlocks } from '../component/registry'

export interface VocabularyEntry {
  componentId: string
  /** 這顆元件在做什麼——膠囊自己的積木提示（照語系，spec 226）；說不出就沒有這一格（不編一句） */
  description?: string
  /** 能出現在語句還是運算式的位置 */
  positions: ('statement' | 'expression')[]
  properties: { name: string; kind: string; values?: string[]; required: boolean; default?: string }[]
  /** `accepts`：收什麼——種類（statement／expression…）、具名的元件或族 */
  slots: { slot: string; accepts: string[]; max?: number }[]
}

let TOOLTIPS: Map<string, string> | null = null

/**
 * 這顆元件的積木提示是哪一個標籤鍵（`%{BKY_U_PRINT_TOOLTIP}` → `U_PRINT_TOOLTIP`）——中性形態優先。
 * 核心只回答鍵；鍵對到哪一種語言的文字由呼叫端決定（宿主的訊息埠）。
 */
export function tooltipKeyOf(componentId: string): string | undefined {
  if (!TOOLTIPS) {
    TOOLTIPS = new Map()
    // 中性形態（沒有 `form` 的那一個）優先——`var_declare` 的第一個形態是運算式版，它的提示說的是「運算式版本」
    const blocks = componentBlocks() as { componentId?: string; form?: unknown; blockDef?: { tooltip?: unknown } }[]
    for (const b of [...blocks.filter((x) => !x.form), ...blocks.filter((x) => x.form)]) {
      const m = /^%\{BKY_(\w+)\}$/.exec(String(b.blockDef?.tooltip ?? ''))
      if (b.componentId && m && !TOOLTIPS.has(b.componentId)) TOOLTIPS.set(b.componentId, m[1])
    }
  }
  return TOOLTIPS.get(componentId)
}

/** 這個語言（元件身分的前綴，例如 `cpp`）的詞彙，依身分排序。`describe` 給說明文字（照語系）——沒給就不帶。 */
export function vocabularyOf(schema: OpSchema, language: string, describe?: (componentId: string) => string | undefined): VocabularyEntry[] {
  const prefix = `${language}:`
  const out: VocabularyEntry[] = []
  for (const id of schema.ids().filter((x) => x.startsWith(prefix)).sort()) {
    const shape = schema.shape(id)
    if (!shape) continue
    const description = describe?.(id)
    out.push({
      componentId: id,
      ...(description ? { description } : {}),
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
