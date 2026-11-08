/**
 * **提議列**——「提議中的變更」給人看與決定的地方（spec 220）。
 *
 * 一次顯示佇列最前面的那一個：誰提的、為什麼、改前改後的差異、還有幾個在等；
 * 接受／退回只在這裡（外部操作者不能替人接受）。過期的照實說原因、接受停用。
 * 不阻斷——沒有提議時不在畫面上。
 */
import type { DiffLine } from '../core/proposals/line-diff'
import type { OpReason } from '../core/proposals/tree-ops'
import { msg } from '../core/messages'

export interface ProposalBarItem {
  id: string
  author: string
  rationale: string
  status: 'pending' | 'stale'
  reason?: OpReason
  diff: DiffLine[] | null
}

export interface ProposalBarHandlers {
  accept(id: string): void
  reject(id: string): void
}

const CONTEXT = 2

/** 只留改動的行與前後兩行；中間省略的以「⋯」帶過。 */
export function condense(diff: DiffLine[]): (DiffLine | null)[] {
  const keep = new Set<number>()
  diff.forEach((l, i) => {
    if (l.kind === ' ') return
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(diff.length - 1, i + CONTEXT); k++) keep.add(k)
  })
  const out: (DiffLine | null)[] = []
  let last = -1
  for (let i = 0; i < diff.length; i++) {
    if (!keep.has(i)) continue
    if (last >= 0 && i > last + 1) out.push(null)
    out.push(diff[i])
    last = i
  }
  return out
}

export class ProposalBar {
  private el: HTMLElement | null = null

  private readonly handlers: ProposalBarHandlers

  constructor(handlers: ProposalBarHandlers) { this.handlers = handlers }

  render(item: ProposalBarItem | null, waiting: number): void {
    if (!item) { this.el?.remove(); this.el = null; return }
    if (!this.el) {
      this.el = document.createElement('div')
      this.el.className = 'proposal-bar'
      this.el.setAttribute('role', 'region')
      this.el.setAttribute('aria-label', msg('PROPOSAL_REGION', '提議中的變更'))
      document.body.appendChild(this.el)
    }
    const el = this.el
    el.dataset.proposalId = item.id
    el.dataset.status = item.status
    el.replaceChildren()

    const head = document.createElement('div')
    head.className = 'proposal-bar-head'
    const who = document.createElement('span')
    who.className = 'proposal-bar-author'
    who.textContent = msg('PROPOSAL_FROM', '{author} 提議').replace('{author}', item.author || msg('PROPOSAL_UNNAMED', '未具名'))
    head.appendChild(who)
    const count = document.createElement('span')
    count.className = 'proposal-bar-count'
    count.textContent = msg('PROPOSAL_WAITING', '還有 {n} 個在等').replace('{n}', String(waiting))
    head.appendChild(count)
    el.appendChild(head)

    if (item.rationale) {
      const why = document.createElement('div')
      why.className = 'proposal-bar-rationale'
      why.textContent = item.rationale
      el.appendChild(why)
    }

    if (item.status === 'stale') {
      const stale = document.createElement('div')
      stale.className = 'proposal-bar-stale'
      stale.textContent = `${msg('PROPOSAL_STALE', '程式在這個提議送出之後改過了，它指的地方已經不在或不一樣——只能退回。')}${item.reason ? `（${item.reason.detail}）` : ''}`
      el.appendChild(stale)
    }

    if (item.diff) {
      const pre = document.createElement('pre')
      pre.className = 'proposal-bar-diff'
      const shown = condense(item.diff)
      if (shown.length === 0) {
        pre.textContent = msg('PROPOSAL_NO_CHANGE', '（程式碼沒有變化）')
      }
      for (const l of shown) {
        const line = document.createElement('div')
        if (l === null) { line.className = 'proposal-diff-gap'; line.textContent = '⋯' }
        else {
          line.className = l.kind === '+' ? 'proposal-diff-add' : l.kind === '-' ? 'proposal-diff-del' : 'proposal-diff-same'
          line.textContent = `${l.kind} ${l.text}`
        }
        pre.appendChild(line)
      }
      el.appendChild(pre)
    }

    const btns = document.createElement('div')
    btns.className = 'proposal-bar-btns'
    const accept = document.createElement('button')
    accept.className = 'style-action-btn primary proposal-accept'
    accept.textContent = msg('PROPOSAL_ACCEPT', '接受')
    accept.disabled = item.status !== 'pending'
    accept.addEventListener('click', () => this.handlers.accept(item.id))
    const reject = document.createElement('button')
    reject.className = 'style-action-btn proposal-reject'
    reject.textContent = msg('PROPOSAL_REJECT', '退回')
    reject.addEventListener('click', () => this.handlers.reject(item.id))
    btns.append(accept, reject)
    el.appendChild(btns)
  }

  dispose(): void { this.el?.remove(); this.el = null }
}
