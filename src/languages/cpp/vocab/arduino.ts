/**
 * **`@cos-mos/arduino` 詞彙套件第一版**——從元件宣告抽出，以及語意樹 → 動作清單的投影（結構頻道）。
 *
 * 格式見 `knowledge/draft/2026-11-04-cos-mos-arduino詞彙套件格式.md`（與 cos-mos 對過：kind 必寫、params 順序有意義、
 * 值一律字串、非字面值寫 `{ expr }`、內容雜湊的正規化算法與測試向量）。使用者 2026-11-04 定（cos-mos history/014）：
 * 第一版由 semorphe 抽出、**只抽身分與參數**，之後正本翻轉到詞彙套件；發布前要問使用者。
 *
 * - 套件：`owner = (arduino)` 的每一顆元件 → `arduino:<名字>`；params 先屬性、後接點，照宣告順序；
 *   接點的型別讀宣告的 `slotTypes`（2026-11-04 補的，53 個），屬性的型別照 kind（enum 的選項取積木下拉）。
 * - 動作清單：只放敘述；運算式元件出現在別的動作的 args 裡，寫成 `{ expr }`；認不出來的那一段進 `unmapped`，不靜默丟。
 */
import { componentManifests, componentBlocks } from '../../../core/component/registry'
import { componentTraits } from '../../../core/component/traits'
import type { SemanticNode } from '../../../core/types'

export type ParamType = 'int' | 'bool' | 'enum' | 'string' | 'expr'
export interface VocabParam { type: ParamType; values?: string[]; required?: boolean; default?: string | boolean; variadic?: true }
export interface VocabComponent { kind: 'statement' | 'expression'; params: Record<string, VocabParam>; pins: '未定' }
export interface Vocab { name: '@cos-mos/arduino'; version: string; components: Record<string, VocabComponent> }

export const VOCAB_VERSION = '0.1.1'
const OWNER = '(arduino)'
/** 簿記用的屬性——由別的欄位推得出來（`ctorCount` ＝ 建構參數的個數），不是詞彙的一部分。 */
const BOOKKEEPING = new Set(['ctorCount'])

interface Manifest {
  componentId: string; role?: string; owner?: string
  properties?: { name: string; kind?: string; default?: unknown }[]
  slots?: Record<string, string>
  slotTypes?: Record<string, VocabParam>
}
interface BlockForm { componentId?: string; blockDef?: { args0?: { type: string; name?: string; options?: [string, string][] }[] }; renderMapping?: { fields?: Record<string, string> } }

/** 屬性名 → 它的下拉選項（取積木形態；同一個屬性在多個形態都有的，取第一個）。 */
function dropdownValues(componentId: string, blocks: BlockForm[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const b of blocks.filter((x) => x.componentId === componentId)) {
    const fieldToProp = b.renderMapping?.fields ?? {}
    for (const a of b.blockDef?.args0 ?? []) {
      if (a.type !== 'field_dropdown' || !a.name || !a.options) continue
      const prop = fieldToProp[a.name]
      if (prop && !out.has(prop)) out.set(prop, a.options.map((o) => o[1]))
    }
  }
  return out
}

function propertyParam(p: { name: string; kind?: string; default?: unknown }, dropdowns: Map<string, string[]>): VocabParam {
  const dflt = typeof p.default === 'string' || typeof p.default === 'boolean' ? { default: p.default } : {}
  if (p.kind === 'enum') {
    const values = dropdowns.get(p.name)
    if (!values) throw new Error(`enum 屬性 ${p.name} 找不到積木下拉的選項——套件說不出它能取哪些值`)
    // 選項只有 true／false 的下拉，本質上是布林（serial_print 的 newline）——套件寫 bool，值給真的布林
    if (values.length === 2 && values.includes('true') && values.includes('false')) {
      return { type: 'bool', ...(p.default === 'true' || p.default === 'false' ? { default: p.default === 'true' } : {}) }
    }
    return { type: 'enum', values, ...dflt }
  }
  if (p.kind === 'number') return { type: 'int', ...(typeof p.default === 'number' ? { default: String(p.default) } : {}) }
  return { type: 'string', ...dflt }
}

/** 套件 ＋ 對照表（`arduino:<名字>` ↔ semorphe 的元件身分）。 */
export function buildArduinoVocab(): { vocab: Vocab; map: Record<string, string> } {
  const blocks = componentBlocks(OWNER) as BlockForm[]
  const components: Record<string, VocabComponent> = {}
  const map: Record<string, string> = {}
  for (const m of componentManifests() as unknown as Manifest[]) {
    if (m.owner !== OWNER) continue
    const name = `arduino:${m.componentId.split(':')[1]}`
    const dropdowns = dropdownValues(m.componentId, blocks)
    const params: Record<string, VocabParam> = {}
    for (const p of m.properties ?? []) if (!BOOKKEEPING.has(p.name)) params[p.name] = propertyParam(p, dropdowns)
    for (const s of Object.keys(m.slots ?? {})) {
      const t = m.slotTypes?.[s]
      if (!t) throw new Error(`${m.componentId} 的接點 ${s} 沒有宣告型別（component.json 的 slotTypes）`)
      // C++ 依位置帶參數：可以省略的接點在宣告裡明寫 `required: false`（產生器有「沒接就不寫」那一支的才是），套件裡不寫 required
      const { required: _optional, ...rest } = t
      params[s] = rest
    }
    // 沒有預設值、不是可變長度、也沒有宣告可省略的參數 ⟹ 必填（cos-mos 2026-11-04：沒有這一條，`digital_write` 少給參數也會被放行）
    for (const [pn, d] of Object.entries(params)) {
      const optional = m.slotTypes?.[pn]?.required === false
      if (d.default === undefined && !d.variadic && !optional) params[pn] = { ...d, required: true }
    }
    if (m.role !== 'statement' && m.role !== 'expression') throw new Error(`${m.componentId} 的 role 不是 statement／expression：${m.role}`)
    components[name] = { kind: m.role, params, pins: '未定' }
    map[name] = m.componentId
  }
  return { vocab: { name: '@cos-mos/arduino', version: VOCAB_VERSION, components }, map }
}

/** 正規化 JSON（正本見 draft）：鍵遞迴排序（UTF-16）、陣列保持順序、無空白、字串照 JSON.stringify；**鍵只准 ASCII**。 */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).sort()
    for (const k of keys) if (!/^[\x20-\x7e]*$/.test(k)) throw new Error(`鍵只准 ASCII：${JSON.stringify(k)}`)
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  if (typeof v === 'number' && !Number.isInteger(v)) throw new Error('套件裡不放浮點數')
  return JSON.stringify(v)
}

export async function contentHash(components: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(components))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export type ArgValue = string | boolean | { expr: string } | ArgValue[]
export interface StructureMessage {
  vocab: string
  contentHash?: string
  at: number
  actions: { op: string; args: Record<string, ArgValue>; at: string }[]
  unmapped: { at: string; componentId: string }[]
}

/**
 * 哪些節點是「這一段認不出來」、哪些是字面值——**由元件自己宣告**（`traits.unrecognized`、`traits.literalValue`），
 * 這裡不點名身分（膠囊就近性：元件的身分不出現在自己的資料夾外）。`unresolved` 是核心的概念，不是膠囊。
 */
const isUnrecognized = (n: SemanticNode): boolean => n.componentId === 'unresolved' || componentTraits(n.componentId)?.unrecognized === true
const literalOf = (n: SemanticNode): string | undefined => {
  const key = componentTraits(n.componentId)?.literalValue
  return typeof key === 'string' && n.properties[key] !== undefined ? String(n.properties[key]) : undefined
}

/**
 * 語意樹 → 動作清單。`codeOf` 給一顆運算式的原始碼（呼叫端用產生器；這一層不依賴產生器的組裝）。
 * `revision` 是樹的版本（單調遞增，接收端丟掉不比上一份新的）。
 */
export function structureOf(
  tree: SemanticNode,
  opts: { vocab: Vocab; map: Record<string, string>; revision: number; codeOf: (n: SemanticNode) => string; contentHash?: string },
): StructureMessage {
  const byComponent = new Map(Object.entries(opts.map).map(([name, id]) => [id, name]))
  const actions: StructureMessage['actions'] = []
  const unmapped: StructureMessage['unmapped'] = []
  const valueOf = (n: SemanticNode | undefined): ArgValue =>
    !n ? { expr: '' } : literalOf(n) ?? { expr: opts.codeOf(n) }

  const walk = (n: SemanticNode): void => {
    const name = byComponent.get(n.componentId)
    if (isUnrecognized(n)) unmapped.push({ at: n.id, componentId: n.componentId })
    if (name && opts.vocab.components[name].kind === 'statement') {
      const decl = opts.vocab.components[name]
      const args: Record<string, ArgValue> = {}
      for (const [p, d] of Object.entries(decl.params)) {
        if (p in (n.slots ?? {})) {
          const kids = n.slots[p] ?? []
          if (d.variadic) args[p] = kids.map((k) => valueOf(k))
          else if (kids.length > 0) args[p] = valueOf(kids[0])
        } else if (n.properties[p] !== undefined) {
          const v = n.properties[p]
          args[p] = typeof v === 'boolean' ? v : d.type === 'bool' ? String(v) === 'true' : String(v)
        }
      }
      actions.push({ op: name, args, at: n.id })
      return   // 它的接點已經寫進 args，不再往下走（運算式元件不自成一筆）
    }
    for (const kids of Object.values(n.slots ?? {})) kids.forEach(walk)
  }
  walk(tree)
  return { vocab: `${opts.vocab.name}@${opts.vocab.version}`, ...(opts.contentHash ? { contentHash: opts.contentHash } : {}), at: opts.revision, actions, unmapped }
}
