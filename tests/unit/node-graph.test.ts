/**
 * 語義樹 → **節點圖**的推導（不含畫）。
 *
 * ⚠️ 使用者當場否掉了第一版的傳統流程圖：
 * 「我要的比較像是 Node 然後有 Flow 可以接線可以呈現**資料流**的那種。」
 * 所以這裡驗的是**節點與接線**：`x > 3` 自己是一顆節點，左右兩條資料線接進來。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { liftPython } from '../helpers/python-lift'
import { buildNodeGraph } from '../../src/core/flow/node-graph'
import { annotationOf } from '../../src/core/skip-declarations'

const CODE = `x = 5
if x > 3:
    print("big")
else:
    print("small")
while x > 0:
    x = x - 1
def f(a):
    return a + 1
`

async function graphOf(code: string): Promise<ReturnType<typeof buildNodeGraph>> {
  const tree = await liftPython(code)
  expect(tree).not.toBeNull()
  return buildNodeGraph(tree!.children['body'] ?? [])
}

beforeAll(async () => {
  const { registerCppSkipDeclarations } = await import('../../src/languages/cpp/generators/index')
  // ⚠️ 名字掛在 C++ 底下而**它掃的是全部膠囊**——那筆錯位記在 `history/121`
  registerCppSkipDeclarations()
})

describe('節點圖推導', () => {
  it('★ 入口條件：控制流宣告真的進得了核心登記處', () => {
    expect(annotationOf('python:if', 'control_flow'), '讀不到宣告的話，執行接點的分色會全部落在同一個值').toBe('branch')
    expect(annotationOf('python:loop_while', 'control_flow')).toBe('loop')
    expect(annotationOf('python:func_def', 'control_flow')).toBe('sequence')
  })

  it('執行出口帶著膠囊宣告的流程形狀——迴圈與分支在圖上分得出來', async () => {
    const g = await graphOf(CODE)
    const w = g.nodes.find((n) => n.componentId === 'python:loop_while')!
    const ifN = g.nodes.find((n) => n.componentId === 'python:if')!
    expect(w.flow).toBe('loop')
    expect(ifN.flow).toBe('branch')
    expect(w.ports.find((p) => p.key === 'body')?.flow, '接點沒帶著它的話，畫的時候只能再查一次——而那就是第二份真相').toBe('loop')
    const lit = g.nodes.find((n) => n.componentId === 'python:literal_number')!
    expect(lit.flow, '沒宣告的不補預設值').toBeUndefined()
  })

  it('運算式自己是節點——`x > 3` 不是格子裡的一串字', async () => {
    const g = await graphOf(CODE)
    const ids = g.nodes.map((n) => n.componentId)
    expect(ids, '比較運算沒有自己的節點的話，這就退回成傳統流程圖了').toContain('python:compare')
    expect(ids).toContain('python:var_ref')
    expect(ids).toContain('python:literal_number')
  })

  it('比較運算有兩個資料入口，而且兩條線分別接到左右', async () => {
    const g = await graphOf('if x > 3:\n    print("big")\n')
    const cmp = g.nodes.find((n) => n.componentId === 'python:compare')!
    const inputs = cmp.ports.filter((p) => p.kind === 'data' && p.side === 'in')
    expect(inputs.map((p) => p.key)).toEqual(['left', 'right'])
    const into = g.wires.filter((w) => w.kind === 'data' && w.to.node === cmp.id)
    expect(into.map((w) => w.to.port).sort()).toEqual(['left', 'right'])
    const sources = into.map((w) => g.nodes.find((n) => n.id === w.from.node)!.componentId).sort()
    expect(sources).toEqual(['python:literal_number', 'python:var_ref'])
  })

  it('資料線接的是**輸出接點**，而運算式沒有執行接點', async () => {
    const g = await graphOf('x = 5\n')
    const lit = g.nodes.find((n) => n.componentId === 'python:literal_number')!
    expect(lit.ports.map((p) => p.key)).toEqual(['__out__'])
    expect(lit.ports.every((p) => p.kind === 'data'), '運算式不被「執行到」，它被取值').toBe(true)
  })

  it('語句串成執行線：前一句的 next 接下一句的 in', async () => {
    const g = await graphOf('x = 5\nprint("hi")\n')
    const exec = g.wires.filter((w) => w.kind === 'exec')
    expect(exec.length).toBe(1)
    expect(exec[0].from.port).toBe('__next__')
    expect(exec[0].to.port).toBe('__in__')
    const from = g.nodes.find((n) => n.id === exec[0].from.node)!
    const to = g.nodes.find((n) => n.id === exec[0].to.node)!
    expect([from.componentId, to.componentId]).toEqual(['python:var_assign', 'python:print'])
  })

  it('身體是**具名的執行出口**——if 的兩臂各一個，而不是同一條線', async () => {
    const g = await graphOf(CODE)
    const ifNode = g.nodes.find((n) => n.componentId === 'python:if')!
    const execOuts = ifNode.ports.filter((p) => p.kind === 'exec' && p.side === 'out' && p.key !== '__next__')
    expect(execOuts.length, 'if 有 then 也有 else').toBe(2)
    // ⚠️ 排掉 `__next__`：那是「if 整句跑完之後往下」，不是它的某一臂
    const fromIf = g.wires.filter((w) => w.kind === 'exec' && w.from.node === ifNode.id && w.from.port !== '__next__')
    expect(new Set(fromIf.map((w) => w.from.port)).size, '兩臂共用一個出口的話，圖上看不出哪一條是 else').toBe(2)
  })

  it('多值子槽每個值各一個接點——第二個引數不會消失', async () => {
    const g = await graphOf('print("a", "b")\n')
    const p = g.nodes.find((n) => n.componentId === 'python:print')!
    const ins = p.ports.filter((x) => x.kind === 'data' && x.side === 'in')
    expect(ins.length).toBe(2)
    expect(ins.map((x) => x.key)).toEqual(['values[0]', 'values[1]'])
  })

  it('資料在左、執行往下：來源節點排在消費者的左邊', async () => {
    const g = await graphOf('x = 5\n')
    const assign = g.nodes.find((n) => n.componentId === 'python:var_assign')!
    const lit = g.nodes.find((n) => n.componentId === 'python:literal_number')!
    expect(lit.x + lit.w).toBeLessThanOrEqual(assign.x)
  })

  it('空的樹畫出空的圖（不是丟例外）', () => {
    const g = buildNodeGraph([])
    expect(g.nodes).toEqual([])
    expect(g.width).toBe(0)
  })
})
