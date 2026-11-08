/**
 * 提議佇列（spec 220 US1／US3／US4）：送出不改程式、排隊、樹改了重新檢查（過期照實標）、接受／退回。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { allCppComponents } from '../../../../src/languages/cpp/all-declarations'
import { schemaFrom, type OpSchema } from '../../../../src/core/proposals/tree-ops'
import { ProposalQueue } from '../../../../src/core/proposals/proposal-queue'
import type { SemanticNode } from '../../../../src/core/types'

let parser: Parser
let schema: OpSchema
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  schema = schemaFrom(allCppComponents())
})

const SRC = 'int main() {\n    int n = 5;\n    if (n > 3) {\n        n = 1;\n    }\n    return 0;\n}\n'
const lift = (src = SRC): SemanticNode => createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const byComp = (t: SemanticNode, id: string): SemanticNode => {
  const st = [t]
  while (st.length) { const n = st.pop()!; if (n.componentId === id) return n; for (const k of Object.values(n.slots ?? {})) st.push(...k) }
  throw new Error(id)
}
const PRINT = { componentId: 'cpp:print', slots: { values: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }] } }

function setup(tree = lift()) {
  let cur = tree
  const q = new ProposalQueue({ schema: () => schema, currentTree: () => cur })
  return { q, get tree() { return cur }, set: (t: SemanticNode) => { cur = t; q.revalidate(t) } }
}

describe('送出、接受、退回', () => {
  it('合法的提議 → pending，目前的程式不變', () => {
    const s = setup()
    const before = JSON.stringify(s.tree)
    const r = s.q.submit({ author: 'AI', rationale: '印出 n', ops: [{ op: 'insert', parent: byComp(s.tree, 'cpp:func_def').id, slot: 'body', index: 1, node: PRINT }] })
    expect(r.status).toBe('pending')
    expect(JSON.stringify(s.tree)).toBe(before)
    expect(s.q.list().map((p) => p.id)).toEqual([r.id])
    expect(s.q.get(r.id)?.preview).toBeTruthy()
  })
  it('不合法 → refused、不入佇列、帶原因', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: 'node_nope' }] })
    expect(r).toMatchObject({ status: 'refused', reason: { code: 'node-missing' } })
    expect(s.q.list()).toEqual([])
    expect(s.q.get(r.id)?.status).toBe('refused')
  })
  it('接受 → 回傳提議後的樹、移出佇列', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    const a = s.q.accept(r.id)
    expect(a.ok).toBe(true)
    if (a.ok) expect(() => byComp(a.tree, 'cpp:if')).toThrow()
    expect(s.q.list()).toEqual([])
    expect(s.q.get(r.id)?.status).toBe('accepted')
  })
  it('退回 → 移出，程式不變', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    expect(s.q.reject(r.id)).toBe(true)
    expect(s.q.list()).toEqual([])
    expect(s.q.get(r.id)?.status).toBe('rejected')
  })
  it('作者沒給 → 空字串（顯示「未具名」是介面的事）', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    expect(s.q.get(r.id)?.author).toBe('')
  })
  it('沒有程式（樹是空的）→ refused', () => {
    const q = new ProposalQueue({ schema: () => schema, currentTree: () => null })
    expect(q.submit({ ops: [{ op: 'remove', node: 'x' }] }).status).toBe('refused')
  })
})

describe('過期', () => {
  it('引用的節點不在了（重新 lift 全部換號）→ stale，不能接受', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    s.set(lift())
    expect(s.q.get(r.id)).toMatchObject({ status: 'stale', reason: { code: 'node-missing' } })
    expect(s.q.accept(r.id).ok).toBe(false)
    expect(s.q.list().map((p) => p.id)).toEqual([r.id])
  })
  it('同一個 id 換成了別的元件 → stale（node-changed）', () => {
    const s = setup()
    const ifN = byComp(s.tree, 'cpp:if')
    const r = s.q.submit({ ops: [{ op: 'remove', node: ifN.id }] })
    const t2 = structuredClone(s.tree)
    const n2 = byComp(t2, 'cpp:if')
    n2.componentId = 'cpp:while_loop'
    s.set(t2)
    expect(s.q.get(r.id)).toMatchObject({ status: 'stale', reason: { code: 'node-changed', nodeId: ifN.id } })
  })
  it('無關的改動 → 仍 pending，預覽以新的樹重算', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    const t2 = structuredClone(s.tree)
    byComp(t2, 'cpp:var_declare').properties.name = 'm'
    s.set(t2)
    const p = s.q.get(r.id)!
    expect(p.status).toBe('pending')
    expect(byComp(p.preview!, 'cpp:var_declare').properties.name).toBe('m')
  })
  it('回到可套用（例如復原）→ 又變回 pending', () => {
    const s = setup()
    const orig = s.tree
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    s.set(lift())
    expect(s.q.get(r.id)?.status).toBe('stale')
    s.set(orig)
    expect(s.q.get(r.id)?.status).toBe('pending')
  })
  it('過期的可以退回', () => {
    const s = setup()
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    s.set(lift())
    expect(s.q.reject(r.id)).toBe(true)
    expect(s.q.list()).toEqual([])
  })
})

describe('排隊', () => {
  it('依送出順序；接受第一個使第二個過期', () => {
    const s = setup()
    const ifId = byComp(s.tree, 'cpp:if').id
    const a = s.q.submit({ author: 'A', ops: [{ op: 'remove', node: ifId }] })
    const b = s.q.submit({ author: 'B', ops: [{ op: 'setProperty', node: ifId, name: 'x', value: 1 }] })
    const c = s.q.submit({ author: 'C', ops: [{ op: 'setProperty', node: byComp(s.tree, 'cpp:var_declare').id, name: 'name', value: 'k' }] })
    expect(b.status).toBe('refused') // if 沒有屬性 x
    expect(s.q.list().map((p) => p.author)).toEqual(['A', 'C'])
    const d = s.q.submit({ author: 'D', ops: [{ op: 'move', node: ifId, parent: byComp(s.tree, 'cpp:func_def').id, slot: 'body', index: 0 }] })
    const acc = s.q.accept(a.id)
    if (!acc.ok) throw new Error('應可接受')
    s.set(acc.tree)
    expect(s.q.get(d.id)?.status).toBe('stale')
    expect(s.q.get(c.id)?.status).toBe('pending')
    expect(s.q.list().map((p) => p.author)).toEqual(['C', 'D'])
  })
  it('onChange 在送出、接受、退回、重新檢查時通知', () => {
    const s = setup()
    let n = 0
    s.q.onChange(() => { n++ })
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    s.set(lift())
    s.q.reject(r.id)
    expect(n).toBe(3)
  })
})

describe('程式被換掉（spec 221）', () => {
  it('staleAll → 全部過期、原因是 replaced；之後的檢查不會變回 pending', () => {
    const s = setup()
    const orig = s.tree
    const r = s.q.submit({ ops: [{ op: 'remove', node: byComp(s.tree, 'cpp:if').id }] })
    s.q.staleAll('套用了範例')
    expect(s.q.get(r.id)).toMatchObject({ status: 'stale', reason: { code: 'replaced' } })
    s.set(orig)
    expect(s.q.get(r.id)?.status).toBe('stale')
    expect(s.q.accept(r.id).ok).toBe(false)
    expect(s.q.reject(r.id)).toBe(true)
  })
})

