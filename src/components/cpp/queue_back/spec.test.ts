/**
 * `cpp:queue_back` 的自證測。
 *
 * ## ⚠️ 這一顆**沒有 lift 那一路**，而那不是遺漏
 *
 * `q.back()` 在辨識層被判成 **`cpp:vector_back`**（`.back()` 不看容器型別）
 * ——所以 **`cpp:queue_back` 從程式碼永遠得不到**，只能從積木拖出來。
 *
 * 這是「**路徑滿的但到不了**」的第二個實例（第一個是 `cpp:if_else`）。
 * 完整診斷見 `draft/2026-08-11-容器方法的辨識不看型別.md`。
 *
 * → 所以 `component.json` 的 `paths` **沒有 `lift`**，而這裡也不假裝測得到它。
 *   **誠實地少一路，勝過一支永遠空過的測試。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

describe('膠囊自證：cpp:queue_back', () => {
  it('★ generate：產回 q.back()', () => {
    const tree = createNode('cpp:program', {}, {
      body: [createNode('cpp:queue_back', { obj: 'que' })],
    })
    expect(generateCode(tree, 'cpp', apcs as unknown as StylePreset)).toContain('que.back()')
  })

  it('★ execute：回傳最後一個元素', async () => {
    const src = '#include <iostream>\n#include <queue>\nusing namespace std;\nint main(){ queue<int> q; q.push(1); q.push(2); cout << q.back(); }'
    const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(tree)
    // ⚠️ 這一支走的是 `cpp:vector_back` 的執行器（見檔頭），而基準值相同。
    // 它證明的是**搬家沒有改變行為**，不是「這顆元件被執行了」。
    expect(i.getOutput().join(''), '基準：q.back() 印出 2').toBe('2')
  })

  it('★ 直接執行這顆身分：回傳最後一個元素', async () => {
    // ⚠️ **合成語義樹**，不從程式碼 lift——因為 `q.back()` 得不到這顆身分（見檔頭）。
    // 這一支才是真的在測 `cpp:queue_back` 的執行器；上一支測的是行為沒變。
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(createNode('cpp:program', {}, {
      body: [
        createNode('cpp:queue_declare', { type: 'int', name: 'q' }),
        createNode('cpp:container_push', { obj: 'q', container_kind: 'queue' }, {
          value: [createNode('cpp:literal_number', { value: '3' })],
        }),
        createNode('cpp:container_push', { obj: 'q', container_kind: 'queue' }, {
          value: [createNode('cpp:literal_number', { value: '9' })],
        }),
        createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', { obj: 'q' })] }),
      ],
    }))
    expect(i.getOutput().join(''), '這一支才是真的在測 cpp:queue_back 的執行器').toBe('9')
  })

  it('★ 空佇列回預設值（釘住既有行為——搬移不重寫）', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(createNode('cpp:program', {}, {
      body: [
        createNode('cpp:queue_declare', { type: 'int', name: 'q' }),
        createNode('cpp:print', {}, { values: [createNode('cpp:queue_back', { obj: 'q' })] }),
      ],
    }))
    expect(i.getOutput().join(''), '⚠️ 這是靜默回退，而搬家不重寫它').toBe('0')
  })
})
