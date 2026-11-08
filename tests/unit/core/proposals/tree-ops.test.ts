/**
 * 結構操作（spec 220 US2／US3）：四種操作作用在副本上、全有或全無；不合法的照實拒、說出第幾步與原因。
 * 用真的 C++ 元件宣告（`allCppComponents()`）與真的 lift 出來的樹。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { allCppComponents } from '../../../../src/languages/cpp/all-declarations'
import { applyOps, refsOf, schemaFrom, type OpSchema, type TreeOp } from '../../../../src/core/proposals/tree-ops'
import type { SemanticNode } from '../../../../src/core/types'

let parser: Parser
let schema: OpSchema
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  schema = schemaFrom(allCppComponents())
})

const SRC = '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 5;\n    cout << n << endl;\n    if (n > 3) {\n        n = 1;\n    }\n    return 0;\n}\n'
const lift = (): SemanticNode => createTestLifter().lift(parser.parse(SRC)!.rootNode as never) as SemanticNode
const find = (t: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode => {
  const stack = [t]
  while (stack.length) {
    const n = stack.pop()!
    if (pred(n)) return n
    for (const kids of Object.values(n.slots ?? {})) stack.push(...kids)
  }
  throw new Error('找不到')
}
const main = (t: SemanticNode) => find(t, (n) => n.componentId === 'cpp:func_def')
const ifNode = (t: SemanticNode) => find(t, (n) => n.componentId === 'cpp:if')
const decl = (t: SemanticNode) => find(t, (n) => n.componentId === 'cpp:var_declare')
const shape = (n: SemanticNode): unknown => [n.componentId, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const PRINT_N = { componentId: 'cpp:print', slots: { values: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }, { componentId: 'cpp:endl' }] } }

function ok(t: SemanticNode, ops: TreeOp[]): SemanticNode {
  const r = applyOps(t, ops, schema)
  if (!r.ok) throw new Error(`預期成功：${JSON.stringify(r.reason)}`)
  return r.tree
}
function refused(t: SemanticNode, ops: TreeOp[]) {
  const r = applyOps(t, ops, schema)
  if (r.ok) throw new Error('預期被拒')
  return r.reason
}

describe('四種操作', () => {
  it('插入：新節點出現在指定位置、拿到系統發的 id、其他不動；輸入不被改動', () => {
    const t = lift()
    const before = JSON.stringify(t)
    const m = main(t)
    const out = ok(t, [{ op: 'insert', parent: m.id, slot: 'body', index: 1, node: PRINT_N }])
    expect(JSON.stringify(t)).toBe(before)
    const body = main(out).slots.body
    expect(body.map((n) => n.componentId)).toEqual(['cpp:var_declare', 'cpp:print', 'cpp:print', 'cpp:if', 'cpp:return'])
    expect(body[1].id).toBeTruthy()
    expect(body[1].id).not.toBe(body[2].id)
    expect(body[1].slots.values[0].properties.name).toBe('n')
    expect(body[0].id).toBe(m.slots.body[0].id)
  })
  it('插入在最後（index ＝ 長度）', () => {
    const t = lift()
    const out = ok(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 4, node: PRINT_N }])
    expect(main(out).slots.body.at(-1)!.componentId).toBe('cpp:print')
  })
  it('刪除：節點與子孫不見，其他不動', () => {
    const t = lift()
    const out = ok(t, [{ op: 'remove', node: ifNode(t).id }])
    expect(main(out).slots.body.map((n) => n.componentId)).toEqual(['cpp:var_declare', 'cpp:print', 'cpp:return'])
  })
  it('移動：到另一個接點，子節點跟著走（index 以移除後計）', () => {
    const t = lift()
    const printNode = find(t, (n) => n.componentId === 'cpp:print')
    const out = ok(t, [{ op: 'move', node: printNode.id, parent: ifNode(t).id, slot: 'then_body', index: 0 }])
    expect(main(out).slots.body.map((n) => n.componentId)).toEqual(['cpp:var_declare', 'cpp:if', 'cpp:return'])
    const moved = ifNode(out).slots.then_body[0]
    expect(moved.id).toBe(printNode.id)
    expect(shape(moved)).toEqual(shape(printNode))
  })
  it('移動：同一個接點裡換位置', () => {
    const t = lift()
    const ret = main(t).slots.body[3]
    const out = ok(t, [{ op: 'move', node: ret.id, parent: main(t).id, slot: 'body', index: 0 }])
    expect(main(out).slots.body.map((n) => n.componentId)).toEqual(['cpp:return', 'cpp:var_declare', 'cpp:print', 'cpp:if'])
  })
  it('改屬性：只有那一個屬性變了', () => {
    const t = lift()
    const out = ok(t, [{ op: 'setProperty', node: decl(t).id, name: 'name', value: 'total' }])
    expect(decl(out).properties).toEqual({ ...decl(t).properties, name: 'total' })
  })
  it('一串操作 ＝ 逐一套用', () => {
    const t = lift()
    const ops: TreeOp[] = [
      { op: 'setProperty', node: decl(t).id, name: 'type', value: 'long long' },
      { op: 'remove', node: ifNode(t).id },
      { op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: PRINT_N },
    ]
    let step = t
    for (const o of ops) step = ok(step, [o])
    expect(shape(ok(t, ops))).toEqual(shape(step))
  })
  it('refsOf：記下每一步引用的既有節點與它的元件', () => {
    const t = lift()
    const refs = refsOf(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: PRINT_N }, { op: 'remove', node: ifNode(t).id }])
    expect(refs).toEqual({ [main(t).id]: 'cpp:func_def', [ifNode(t).id]: 'cpp:if' })
  })
})

describe('不合法 → 整個被拒，說出第幾步與原因', () => {
  it('空的提議', () => {
    expect(refused(lift(), []).code).toBe('empty')
  })
  it('節點不存在', () => {
    const r = refused(lift(), [{ op: 'remove', node: 'node_nope' }])
    expect(r).toMatchObject({ code: 'node-missing', step: 0, nodeId: 'node_nope' })
  })
  it('元件不認得（含新節點的子孫）', () => {
    const t = lift()
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: { componentId: 'cpp:nope' } }]).code).toBe('unknown-component')
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: { componentId: 'cpp:print', slots: { values: [{ componentId: 'cpp:zzz' }] } } }]).code).toBe('unknown-component')
  })
  it('接點不是那顆元件宣告的', () => {
    const t = lift()
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'nope', index: 0, node: PRINT_N }]).code).toBe('unknown-slot')
  })
  it('子節點不合那個接點', () => {
    const t = lift()
    // 參數格只收 param_decl
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'params', index: 0, node: PRINT_N }]).code).toBe('slot-mismatch')
  })
  it('超過接點宣告的上限（max）', () => {
    const t = lift()
    const BITS = { componentId: 'cpp:bits_count', slots: { obj: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }, { componentId: 'cpp:var_ref', properties: { name: 'n' } }] } }
    const r = refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: { componentId: 'cpp:print', slots: { values: [BITS] } } }])
    expect(r.code).toBe('slot-full')
  })
  it('enum 屬性的值要在宣告的值裡（有列值的時候）', () => {
    const t = lift()
    const r = applyOps(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: { componentId: 'cpp:print', slots: { values: [{ componentId: 'cpp:bits_count', properties: { method: '__builtin_popcount' }, slots: { obj: [{ componentId: 'cpp:var_ref', properties: { name: 'n' } }] } }] } } }], schema)
    expect(r.ok).toBe(true)
  })
  it('屬性未宣告、值的形狀不對', () => {
    const t = lift()
    expect(refused(t, [{ op: 'setProperty', node: decl(t).id, name: 'color', value: 'red' }]).code).toBe('unknown-property')
    expect(refused(t, [{ op: 'setProperty', node: decl(t).id, name: 'name', value: { x: 1 } as never }]).code).toBe('bad-value')
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 0, node: { componentId: 'cpp:print', properties: { bogus: 1 } } }]).code).toBe('unknown-property')
  })
  it('位置超出範圍', () => {
    const t = lift()
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: 9, node: PRINT_N }]).code).toBe('index-out-of-range')
    expect(refused(t, [{ op: 'insert', parent: main(t).id, slot: 'body', index: -1, node: PRINT_N }]).code).toBe('index-out-of-range')
  })
  it('根不可刪、不可移', () => {
    const t = lift()
    expect(refused(t, [{ op: 'remove', node: t.id }]).code).toBe('root')
    expect(refused(t, [{ op: 'move', node: t.id, parent: main(t).id, slot: 'body', index: 0 }]).code).toBe('root')
  })
  it('移到自己的子孫底下會成環', () => {
    const t = lift()
    expect(refused(t, [{ op: 'move', node: main(t).id, parent: ifNode(t).id, slot: 'then_body', index: 0 }]).code).toBe('cycle')
  })
  it('中途失敗 → 整串都不生效、指出是第幾步', () => {
    const t = lift()
    const before = JSON.stringify(t)
    const r = refused(t, [{ op: 'remove', node: ifNode(t).id }, { op: 'remove', node: ifNode(t).id }])
    expect(r).toMatchObject({ code: 'node-missing', step: 1 })
    expect(JSON.stringify(t)).toBe(before)
  })
  it('原因帶白話說明', () => {
    expect(refused(lift(), [{ op: 'remove', node: 'node_nope' }]).detail).toMatch(/node_nope/)
  })
})
