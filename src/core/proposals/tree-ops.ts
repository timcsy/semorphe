/**
 * **結構操作**——人和 AI 改語義樹用的同一組手勢（spec 220；history/334 的缺口①）。
 *
 * 插入／刪除／移動／改屬性，位置以節點 id 指定。全部作用在**副本**上、全有或全無；
 * 不合法的照實拒，說出第幾步、哪個節點、為什麼（P6 誠實降級——指錯地方的操作不得被套到別處）。
 *
 * ⚠️ 合法性只問**形態**（元件認不認得、接點與屬性是不是它宣告的、放不放得進那一格）
 * ——對不對歸 Cella，這裡不判。
 *
 * 核心不 import `languages/`：元件宣告由呼叫端交進來（`schemaFrom(語言套件的 declarations)`）。
 */
import type { ComponentDefJSON, ParamSpec, PropertyValue, SemanticNode } from '../types'
import { generateId } from '../semantic-tree'
import { paramSpecs } from '../param-spec'
import { fitsSlot, isDynamic, slotDeclsOf } from '../component/slot-check'
import { isProgramRoot } from '../component/traits'
import { registeredComponents } from '../component/registry'

/** 插入時給的新節點——id 由系統發，操作者不給。 */
export interface NodeSpec {
  componentId: string
  properties?: Record<string, PropertyValue>
  slots?: Record<string, NodeSpec[]>
}

export type TreeOp =
  | { op: 'insert'; parent: string; slot: string; index: number; node: NodeSpec }
  | { op: 'remove'; node: string }
  /** `index` 以**移除之後**的那個接點計。 */
  | { op: 'move'; node: string; parent: string; slot: string; index: number }
  | { op: 'setProperty'; node: string; name: string; value: PropertyValue }

export type ReasonCode =
  | 'empty' | 'node-missing' | 'node-changed' | 'unknown-component' | 'unknown-slot' | 'slot-mismatch'
  | 'slot-full' | 'unknown-property' | 'bad-value' | 'index-out-of-range' | 'root' | 'cycle'

export interface OpReason {
  /** 第幾步（0 起算）；不屬於任何一步時是 null */
  step: number | null
  nodeId?: string
  code: ReasonCode
  /** 給開發者與 log 的白話；畫面上的說法依 code 另外措辭 */
  detail: string
}

export type ApplyResult = { ok: true; tree: SemanticNode } | { ok: false; reason: OpReason }

export interface ComponentShape {
  slots: { slot: string; allowed: string[]; max?: number }[]
  /** null ＝ 不限（降級節點：我們沒讀懂它，不替它設限） */
  props: ParamSpec[] | null
}

export interface OpSchema {
  shape(componentId: string): ComponentShape | null
  isRoot(componentId: string): boolean
  fits(childComponentId: string, allowed: string[]): boolean
}

/**
 * 由元件宣告組出操作要問的形狀。接點優先用膠囊的宣告（含 `max`），否則用宣告檔的 `slots`。
 *
 * ⚠️ **語言套件交的那份不一定齊**：C++ 的 `declarations()` 含標準函式庫模組，
 * 而 Python 的套件**沒有** `declarations()`（2026-11-09 量到）——只靠它的話 Python 裡每一個提議都會被拒成「不認得的元件」。
 * ⟹ 交進來的找不到時，回頭問膠囊登錄表（每一顆膠囊都在那裡）。
 */
export function schemaFrom(components: readonly ComponentDefJSON[] = []): OpSchema {
  const byId = new Map<string, ComponentDefJSON>(components.map((c) => [c.componentId, c]))
  for (const c of registeredComponents()) {
    if (!byId.has(c.componentId)) byId.set(c.componentId, c.manifest as unknown as ComponentDefJSON)
  }
  return {
    shape(id) {
      const def = byId.get(id)
      if (!def) return isDynamic(id) ? { slots: [], props: null } : null
      const capsule = slotDeclsOf(id)
      const slots = capsule.length > 0
        ? capsule.map((d) => ({ slot: d.slot, allowed: d.allowed, max: d.max }))
        : Object.entries(def.slots ?? {}).map(([slot, v]) => ({ slot, allowed: [String(v)] }))
      return { slots, props: paramSpecs(def.properties) }
    },
    isRoot: isProgramRoot,
    fits: fitsSlot,
  }
}

interface Loc { node: SemanticNode; parent: SemanticNode | null; slot: string | null }

function index(tree: SemanticNode): Map<string, Loc> {
  const m = new Map<string, Loc>()
  const walk = (n: SemanticNode, parent: SemanticNode | null, slot: string | null): void => {
    m.set(n.id, { node: n, parent, slot })
    for (const [s, kids] of Object.entries(n.slots ?? {})) for (const k of kids) walk(k, n, s)
  }
  walk(tree, null, null)
  return m
}

const isPropertyValue = (v: unknown): v is PropertyValue =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  || (Array.isArray(v) && v.every((x) => typeof x === 'string'))

class Refuse extends Error {
  readonly code: ReasonCode
  readonly detail: string
  readonly nodeId?: string
  constructor(code: ReasonCode, detail: string, nodeId?: string) {
    super(detail)
    this.code = code
    this.detail = detail
    this.nodeId = nodeId
  }
}

function checkProperty(schema: OpSchema, componentId: string, name: string, value: unknown, nodeId?: string): void {
  const shape = schema.shape(componentId)
  if (!shape) throw new Refuse('unknown-component', `不認得的元件 ${componentId}`, nodeId)
  if (!isPropertyValue(value)) throw new Refuse('bad-value', `${componentId} 的屬性 ${name} 的值不是字串、數字、布林或字串陣列`, nodeId)
  if (shape.props === null) return
  const spec = shape.props.find((p) => p.name === name)
  if (!spec) throw new Refuse('unknown-property', `${componentId} 沒有宣告屬性 ${name}`, nodeId)
  if (spec.kind === 'enum' && spec.values && spec.values.length > 0 && !spec.values.includes(String(value))) {
    throw new Refuse('bad-value', `${componentId} 的屬性 ${name} 只接受 ${spec.values.join('／')}，收到 ${String(value)}`, nodeId)
  }
}

function slotOf(schema: OpSchema, parent: SemanticNode, slot: string) {
  const shape = schema.shape(parent.componentId)
  if (!shape) throw new Refuse('unknown-component', `不認得的元件 ${parent.componentId}`, parent.id)
  const decl = shape.slots.find((s) => s.slot === slot)
  if (!decl) throw new Refuse('unknown-slot', `${parent.componentId} 沒有宣告接點 ${slot}`, parent.id)
  return decl
}

function place(schema: OpSchema, parent: SemanticNode, slot: string, index: number, child: SemanticNode): void {
  const decl = slotOf(schema, parent, slot)
  if (!schema.fits(child.componentId, decl.allowed)) {
    throw new Refuse('slot-mismatch', `${child.componentId} 放不進 ${parent.componentId} 的 ${slot}（要 ${decl.allowed.join('／')}）`, parent.id)
  }
  const kids = parent.slots[slot] ?? []
  if (!Number.isInteger(index) || index < 0 || index > kids.length) {
    throw new Refuse('index-out-of-range', `${parent.componentId} 的 ${slot} 有 ${kids.length} 個，位置 ${index} 超出範圍`, parent.id)
  }
  if (decl.max !== undefined && kids.length + 1 > decl.max) {
    throw new Refuse('slot-full', `${parent.componentId} 的 ${slot} 最多 ${decl.max} 個`, parent.id)
  }
  parent.slots = { ...parent.slots, [slot]: [...kids.slice(0, index), child, ...kids.slice(index)] }
}

/** 由 NodeSpec 長出一棵新子樹，逐層檢查。 */
function build(schema: OpSchema, spec: NodeSpec): SemanticNode {
  if (!spec || typeof spec.componentId !== 'string' || !schema.shape(spec.componentId)) {
    throw new Refuse('unknown-component', `不認得的元件 ${String(spec?.componentId)}`)
  }
  const node: SemanticNode = { id: generateId(), componentId: spec.componentId, properties: {}, slots: {} }
  for (const [k, v] of Object.entries(spec.properties ?? {})) {
    checkProperty(schema, spec.componentId, k, v)
    node.properties[k] = v
  }
  for (const [slot, kids] of Object.entries(spec.slots ?? {})) {
    slotOf(schema, node, slot)
    node.slots[slot] = []
    kids.forEach((k, i) => place(schema, node, slot, i, build(schema, k)))
  }
  return node
}

function detach(loc: Loc): void {
  const p = loc.parent!
  const s = loc.slot!
  p.slots = { ...p.slots, [s]: p.slots[s].filter((n) => n !== loc.node) }
}

function step(tree: SemanticNode, op: TreeOp, schema: OpSchema): void {
  const idx = index(tree)
  const need = (id: string): Loc => {
    const loc = idx.get(id)
    if (!loc) throw new Refuse('node-missing', `節點 ${id} 不在目前的程式裡`, id)
    return loc
  }
  switch (op.op) {
    case 'insert': {
      const parent = need(op.parent).node
      slotOf(schema, parent, op.slot)
      place(schema, parent, op.slot, op.index, build(schema, op.node))
      return
    }
    case 'remove': {
      const loc = need(op.node)
      if (!loc.parent || schema.isRoot(loc.node.componentId)) throw new Refuse('root', '程式的根不能刪除', op.node)
      detach(loc)
      return
    }
    case 'move': {
      const loc = need(op.node)
      if (!loc.parent || schema.isRoot(loc.node.componentId)) throw new Refuse('root', '程式的根不能移動', op.node)
      const target = need(op.parent).node
      for (let p: Loc | undefined = idx.get(target.id); p; p = p.parent ? idx.get(p.parent.id) : undefined) {
        if (p.node === loc.node) throw new Refuse('cycle', `不能把 ${op.node} 移到它自己的底下`, op.node)
      }
      slotOf(schema, target, op.slot)
      detach(loc)
      place(schema, target, op.slot, op.index, loc.node)
      return
    }
    case 'setProperty': {
      const node = need(op.node).node
      checkProperty(schema, node.componentId, op.name, op.value, node.id)
      node.properties = { ...node.properties, [op.name]: op.value }
      return
    }
    default:
      throw new Refuse('unknown-component', `不認得的操作 ${String((op as { op?: unknown }).op)}`)
  }
}

/** 在副本上依序套用；任何一步失敗就整串不生效。輸入的樹不被改動。 */
export function applyOps(tree: SemanticNode, ops: readonly TreeOp[], schema: OpSchema): ApplyResult {
  if (!Array.isArray(ops) || ops.length === 0) {
    return { ok: false, reason: { step: null, code: 'empty', detail: '提議裡沒有任何操作' } }
  }
  const copy = structuredClone(tree)
  for (let i = 0; i < ops.length; i++) {
    try {
      step(copy, ops[i], schema)
    } catch (e) {
      if (e instanceof Refuse) return { ok: false, reason: { step: i, nodeId: e.nodeId, code: e.code, detail: `第 ${i + 1} 步：${e.detail}` } }
      throw e
    }
  }
  return { ok: true, tree: copy }
}

/** 每一步引用的**既有**節點，與它在這棵樹上的元件——之後判斷提議過期與否的快照。 */
export function refsOf(tree: SemanticNode, ops: readonly TreeOp[]): Record<string, string> {
  const idx = index(tree)
  const out: Record<string, string> = {}
  for (const op of ops) {
    const ids = op.op === 'insert' ? [op.parent] : op.op === 'move' ? [op.node, op.parent] : [op.node]
    for (const id of ids) {
      const loc = idx.get(id)
      if (loc) out[id] = loc.node.componentId
    }
  }
  return out
}
