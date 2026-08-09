/**
 * **降級不得寫回真實**
 *
 * ## 這支測試釘的是什麼
 *
 * 課程的漸進揭露會把「這一關還沒教到」的概念降級成父概念，讓學生看到
 * 一顆他認得的積木。那是**投影層**的事。
 *
 * 而 `downgradeConceptsForLevel` 是**就地改寫**的，於是它一度直接改到了
 * `currentTree`——也就是真實。後果：
 *
 * ```
 * vector<int> v;  →  cpp:vector_declare  →（初學課程看不到）→ lang:var_declare
 *                                              ↑ 真實也變成這個
 * 按「執行」→ int v; → v[0] → RUNTIME_ERR_TYPE_MISMATCH
 * ```
 *
 * ## 為什麼 3682 支測試抓不到
 *
 * 降級**只在「課程可見集合」這條路上發生**，而測試幾乎都用「全部概念可見」
 * 的設定跑。**綠只說明在現有觀察集下沒有差別**——而沒有人在那個觀察集下
 * 觀察過（見 `concepts/等價與觀察集.md`）。
 *
 * 這顆 bug 是 2026-08-08 開瀏覽器實測時發現的，而且**先在遷移前的 commit
 * 上重現過**，確認不是命名空間遷移造成的迴歸。
 */
import { describe, it, expect } from 'vitest'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { abstractConceptOf } from '../../src/core/language-executors'
import '../../src/languages/cpp/all-declarations'
import { registerCppLanguage } from '../../src/languages/cpp/generators'

registerCppLanguage()

/** 複製 sync-controller 的降級規則，用來證明「就地改寫」這件事本身是危險的 */
function 就地降級(node: SemanticNode, visible: Set<string>): void {
  if (!visible.has(node.conceptId)) {
    const parent = abstractConceptOf(node.conceptId)
    if (parent && visible.has(parent)) node.conceptId = parent
  }
  for (const arr of Object.values(node.children ?? {})) arr.forEach((c) => 就地降級(c, visible))
}

function clone(node: SemanticNode): SemanticNode {
  const children: Record<string, SemanticNode[]> = {}
  for (const [k, arr] of Object.entries(node.children ?? {})) children[k] = arr.map(clone)
  return { ...node, properties: { ...node.properties }, children }
}

describe('降級是投影，不得寫回真實', () => {
  const 真實 = (): SemanticNode =>
    createNode('cpp:program', {}, {
      body: [createNode('cpp:vector_declare', { name: 'v', type: 'int' }, {})],
    })

  it('★ 前提：`cpp:vector_declare` 確實有父概念，而且會被降級', () => {
    // 沒有這一支的話，下面兩支可能只是因為「根本沒有降級發生」而綠——
    // 那會是一個由建構保證的綠。
    const parent = abstractConceptOf('cpp:vector_declare')
    expect(parent, '這顆元件沒宣告父概念 → 這支測試釘不到東西').toBeTruthy()

    const 顯示 = clone(真實())
    就地降級(顯示, new Set(['cpp:program', parent!]))
    expect(顯示.children.body![0].conceptId, '降級沒有發生 → 這支測試沒有在測降級').toBe(parent)
  })

  it('★ 降級作用在拷貝上時，真實不變', () => {
    const t = 真實()
    const parent = abstractConceptOf('cpp:vector_declare')!
    就地降級(clone(t), new Set(['cpp:program', parent]))
    expect(
      t.children.body![0].conceptId,
      '真實被降級改掉了——執行會拿到 `int v;`，而 `v[0]` 會炸',
    ).toBe('cpp:vector_declare')
  })

  it('★ 反向：直接對真實降級**會**破壞它（證明拷貝不是多餘的）', () => {
    // 這一支刻意示範 bug 本身。沒有它，讀的人看不出上一支在防什麼，
    // 而「拷貝」會在某次重構中被當成多餘的開銷刪掉。
    const t = 真實()
    const parent = abstractConceptOf('cpp:vector_declare')!
    就地降級(t, new Set(['cpp:program', parent]))
    expect(t.children.body![0].conceptId, '就地降級沒有改到真實 → 那前一支就沒有在防什麼').toBe(parent)
  })
})
