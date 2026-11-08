/**
 * **提議中的變更**（spec 220；history/334：AI 的變更預設待人確認，人接受才進語意樹）。
 *
 * 佇列只管狀態：送出時在副本上驗證並套用、樹改了重新檢查、接受時交回提議後的樹。
 * 不碰 DOM、不產碼、不改目前的程式——把樹換進去的是呼叫端（走 `edit:tree`）。
 *
 * 🔴 **過期照實標，不硬套**：節點 id 會在重新 lift 時全部換號（缺口②還沒補），
 * 所以人改了程式碼之後大部分提議會過期。依形狀重新對位是「猜」——第一刀不做。
 */
import type { SemanticNode } from '../types'
import { applyOps, refsOf, type OpReason, type OpSchema, type TreeOp } from './tree-ops'

export type ProposalStatus = 'pending' | 'stale' | 'accepted' | 'rejected' | 'refused'

export interface ProposalInput {
  author?: string
  rationale?: string
  ops: TreeOp[]
}

export interface Proposal {
  id: string
  /** 送出者自填；空字串＝未具名（怎麼顯示歸介面） */
  author: string
  rationale: string
  ops: TreeOp[]
  /** 送出當下引用到的節點 → 元件 */
  refs: Record<string, string>
  status: ProposalStatus
  reason?: OpReason
  /** pending 時：以目前的程式套用之後的樹 */
  preview?: SemanticNode
  /** 程式被換掉而過期——之後的檢查不會讓它變回可接受（spec 221） */
  sticky?: boolean
  submittedAt: number
}

export interface SubmitResult {
  id: string
  status: 'pending' | 'refused'
  reason?: OpReason
}

export interface ProposalQueueDeps {
  schema: () => OpSchema
  currentTree: () => SemanticNode | null
  now?: () => number
}

const HISTORY = 50

export class ProposalQueue {
  private queue: Proposal[] = []
  private done: Proposal[] = []
  private seq = 0
  private listeners = new Set<() => void>()

  private readonly deps: ProposalQueueDeps

  constructor(deps: ProposalQueueDeps) { this.deps = deps }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private emit(): void { for (const cb of this.listeners) cb() }

  submit(input: ProposalInput): SubmitResult {
    const now = this.deps.now?.() ?? Date.now()
    const author = typeof input?.author === 'string' ? input.author.trim() : ''
    const p: Proposal = {
      id: `proposal_${++this.seq}`,
      author,
      rationale: typeof input?.rationale === 'string' ? input.rationale : '',
      ops: Array.isArray(input?.ops) ? structuredClone(input.ops) : [],
      refs: {},
      status: 'pending',
      submittedAt: now,
    }
    const tree = this.deps.currentTree()
    if (!tree) {
      p.status = 'refused'
      p.reason = { step: null, code: 'node-missing', detail: '目前沒有程式' }
      this.remember(p)
      return { id: p.id, status: 'refused', reason: p.reason }
    }
    const r = applyOps(tree, p.ops, this.deps.schema())
    if (!r.ok) {
      p.status = 'refused'
      p.reason = r.reason
      this.remember(p)
      return { id: p.id, status: 'refused', reason: r.reason }
    }
    p.refs = refsOf(tree, p.ops)
    p.preview = r.tree
    this.queue.push(p)
    this.emit()
    return { id: p.id, status: 'pending' }
  }

  /** 佇列中的（pending／stale），依送出順序。 */
  list(): Proposal[] { return [...this.queue] }

  get(id: string): Proposal | null {
    return this.queue.find((p) => p.id === id) ?? this.done.find((p) => p.id === id) ?? null
  }

  /** 程式變了：每一個待處理的提議重新檢查。 */
  revalidate(tree: SemanticNode | null): void {
    if (this.queue.length === 0) return
    for (const p of this.queue) this.check(p, tree)
    this.emit()
  }

  /**
   * **程式被換掉了**（不是被改了）：所有待處理的提議過期，而且黏住——
   * 節點身分會沿用（spec 221），新程式若恰好有形狀相同的部分，提議不得因此套到新程式上。
   */
  staleAll(detail: string): void {
    if (this.queue.length === 0) return
    for (const p of this.queue) {
      p.sticky = true
      p.status = 'stale'
      p.preview = undefined
      p.reason = { step: null, code: 'replaced', detail }
    }
    this.emit()
  }

  private check(p: Proposal, tree: SemanticNode | null): void {
    if (p.sticky) return
    p.preview = undefined
    if (!tree) { p.status = 'stale'; p.reason = { step: null, code: 'node-missing', detail: '目前沒有程式' }; return }
    const now = refsOf(tree, p.ops)
    for (const [id, comp] of Object.entries(p.refs)) {
      if (!(id in now)) {
        p.status = 'stale'
        p.reason = { step: null, nodeId: id, code: 'node-missing', detail: `提議指的節點 ${id} 已不在目前的程式裡` }
        return
      }
      if (now[id] !== comp) {
        p.status = 'stale'
        p.reason = { step: null, nodeId: id, code: 'node-changed', detail: `提議指的節點 ${id} 原本是 ${comp}，現在是 ${now[id]}` }
        return
      }
    }
    const r = applyOps(tree, p.ops, this.deps.schema())
    if (!r.ok) { p.status = 'stale'; p.reason = r.reason; return }
    p.status = 'pending'
    p.reason = undefined
    p.preview = r.tree
  }

  /** 人按了接受：以目前的程式重新套用一次，交回提議後的樹。過期的不能接受。 */
  accept(id: string): { ok: true; tree: SemanticNode } | { ok: false; reason: OpReason } {
    const p = this.queue.find((x) => x.id === id)
    if (!p) return { ok: false, reason: { step: null, code: 'node-missing', detail: `沒有待處理的提議 ${id}` } }
    this.check(p, this.deps.currentTree())
    if (p.status !== 'pending' || !p.preview) {
      this.emit()
      return { ok: false, reason: p.reason ?? { step: null, code: 'node-missing', detail: '提議已過期' } }
    }
    const tree = p.preview
    p.status = 'accepted'
    p.preview = undefined
    this.finish(p)
    return { ok: true, tree }
  }

  reject(id: string): boolean {
    const p = this.queue.find((x) => x.id === id)
    if (!p) return false
    p.status = 'rejected'
    p.preview = undefined
    this.finish(p)
    return true
  }

  private finish(p: Proposal): void {
    this.queue = this.queue.filter((x) => x !== p)
    this.remember(p)
    this.emit()
  }

  private remember(p: Proposal): void {
    this.done.push(p)
    if (this.done.length > HISTORY) this.done.shift()
  }
}
