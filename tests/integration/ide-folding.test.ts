/**
 * @vitest-environment happy-dom
 *
 * **IDE 宿主的程式碼也跟著收合**（spec 223；vision〈分子〉最後一格）。
 *
 * 程式碼視圖收到收合狀態 → 告訴宿主摺哪幾行、展開哪幾行。真的摺起來要宿主的 API（`editor.fold`），
 * 那一半只有人驗得到（見 spec 的手動驗收）；這裡驗的是「送出去的行對不對」。
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { SemanticNode } from '../../src/core/types'
import { collapsedToKeys } from '../../src/core/granularity'

const posted: { type: string; fold?: number[]; unfold?: number[] }[] = []
let View: typeof import('../../src/vscode/webview/vscode-code-view').VscodeCodeView
beforeAll(async () => {
  vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: (m: never) => posted.push(m) }))
  View = (await import('../../src/vscode/webview/vscode-code-view')).VscodeCodeView
})

const leaf = (id: string, componentId: string): SemanticNode => ({ id, componentId, properties: {}, slots: {} })
const tree: SemanticNode = {
  id: 'root', componentId: 'cpp:program', properties: {},
  slots: { body: [{ id: 'f', componentId: 'cpp:func_def', properties: { name: 'main' }, slots: { body: [leaf('w', 'cpp:while_loop'), leaf('i', 'cpp:if')] } }] },
}
const mappings = [
  { nodeId: 'f', startLine: 0, endLine: 9 },
  { nodeId: 'w', startLine: 1, endLine: 3 },
  { nodeId: 'i', startLine: 4, endLine: 7 },
]
const folds = () => posted.filter((m) => m.type === 'fold')

describe('IDE 宿主的摺疊', () => {
  it('收合狀態 → 送出要摺的行；狀態撤掉 → 只展開自己摺過的', () => {
    const v = new View(document.createElement('div'))
    v.onSemanticUpdate({ tree, mappings, source: 'code' } as never)
    posted.length = 0
    v.onGranularity({ entries: collapsedToKeys(tree, new Set(['w', 'i'])) })
    const last = folds().at(-1)
    expect(last?.fold).toEqual([1, 4])
    expect(last?.unfold).toEqual([])
    v.onGranularity({ entries: collapsedToKeys(tree, new Set(['i'])) })
    // 第 4 行已經摺著——不重送（重送會把使用者自己展開的又摺回去）
    expect(folds().at(-1)).toMatchObject({ fold: [], unfold: [1] })
  })
  it('對映挪了（上面多一行）→ 摺的行跟著挪', () => {
    const v = new View(document.createElement('div'))
    v.onSemanticUpdate({ tree, mappings, source: 'code' } as never)
    v.onGranularity({ entries: collapsedToKeys(tree, new Set(['i'])) })
    posted.length = 0
    v.onSemanticUpdate({ tree, mappings: mappings.map((m) => ({ ...m, startLine: m.startLine + 1, endLine: m.endLine + 1 })), source: 'code' } as never)
    expect(folds().at(-1)).toMatchObject({ fold: [5], unfold: [4] })
  })
  it('狀態沒變就不重送', () => {
    const v = new View(document.createElement('div'))
    v.onSemanticUpdate({ tree, mappings, source: 'code' } as never)
    posted.length = 0
    v.onGranularity({ entries: [] })
    expect(folds()).toEqual([])
  })
})
