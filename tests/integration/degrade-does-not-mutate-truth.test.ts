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

/**
 * ## ⚠️ 第二個方向（2026-08-11，`spec 116` 錄存檔樣本時發現）
 *
 * 上面釘的是 **code→blocks**：降級不得就地改寫真實。
 *
 * 而 **blocks→code** 那個方向的樹是**從積木抽回來的**，而積木畫的就是
 * 降級後的樣子——**使用者拖一下任何一顆積木，降級後的身分就成為真實**，
 * 而且存檔之後救不回來。
 *
 * > **閉環的系統裡，輸出端的損失會從輸入端回來。**
 *
 * 2026-08-09 那次只修了一個方向，**沒有問「反方向呢」**。
 * 發現的方式：錄 v9 存檔樣本時為了觸發自動存檔拖了一下積木，
 * 而那份真實檔案的 `tree` 裡已經是 `cpp:var_declare` 了。
 */
describe('降級的反方向：抽回來的樹不得把降級當成真實', () => {
  /** 模擬 sync-controller 的兩張表：降級時記、抽回來時還原 */
  function 降級並記錄(node: SemanticNode, visible: Set<string>, 記: Map<string, string>): void {
    if (!visible.has(node.conceptId)) {
      const parent = abstractConceptOf(node.conceptId)
      if (parent && visible.has(parent)) {
        記.set(node.id, node.conceptId)
        node.conceptId = parent
      }
    }
    for (const arr of Object.values(node.children ?? {})) arr.forEach((c) => 降級並記錄(c, visible, 記))
  }
  function 還原(node: SemanticNode, 記: Map<string, string>): void {
    const 原 = 記.get(node.id)
    if (原 !== undefined && node.conceptId === abstractConceptOf(原)) node.conceptId = 原
    for (const arr of Object.values(node.children ?? {})) arr.forEach((c) => 還原(c, 記))
  }

  function 樹(): SemanticNode {
    return createNode('cpp:program', {}, {
      body: [createNode('cpp:vector_declare', { type: 'int', name: 'v' })],
    })
  }
  const 只看得到基礎 = new Set(['cpp:program', 'cpp:var_declare'])

  it('★ 前提：這個設定真的會降級——否則下面兩支都是空過', () => {
    const t = 樹()
    const 記 = new Map<string, string>()
    降級並記錄(t, 只看得到基礎, 記)
    expect(t.children.body[0].conceptId, '沒有降級發生 → 這支測試什麼都沒測到').toBe('cpp:var_declare')
    expect(記.size).toBe(1)
  })

  it('★ 抽回來的樹被還原成原本的身分——使用者拖一下積木不該弄丟 vector', () => {
    const 顯示樹 = 樹()
    const 記 = new Map<string, string>()
    降級並記錄(顯示樹, 只看得到基礎, 記)
    // 使用者拖了一下 → 抽回來的就是顯示樹（nodeId 由 _blockIdToNodeId 保住）
    還原(顯示樹, 記)
    expect(顯示樹.children.body[0].conceptId).toBe('cpp:vector_declare')
  })

  it('★ 反向：使用者**真的**把它換成別的概念時，不得還原', () => {
    // 這一條把「投影損失」與「使用者的編輯」分開。少了它，還原會把
    // 使用者的修改吃掉——那比原本的缺陷更糟。
    const 顯示樹 = 樹()
    const 記 = new Map<string, string>()
    降級並記錄(顯示樹, 只看得到基礎, 記)
    顯示樹.children.body[0].conceptId = 'cpp:string_declare' // 使用者換掉了
    還原(顯示樹, 記)
    expect(顯示樹.children.body[0].conceptId, '使用者的編輯被還原吃掉了').toBe('cpp:string_declare')
  })
})

