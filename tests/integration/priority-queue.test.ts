/**
 * `priority_queue` 五路——**期望值來自 `g++ -std=c++17`**
 *
 * ## 為什麼這顆元件值得一支專屬測試
 *
 * 它在補齊之前是一顆**幽靈**：`core/lifters/strategies.ts` 的容器對照表寫著
 * `'priority_queue': 'cpp_priority_queue_declare'`，而那顆元件**從來不存在**。
 * 辨識 `priority_queue<int> pq;` 會產出一個沒有人認識的身分。
 *
 * 而**靜態掃描看不到它**——身分是從對照表算出來的，不是字面。抓到它的是
 * 「走流程掃樹」那一半（見 `audit-component-id-integrity`）。
 *
 * ## 最大的陷阱：不能抄 `queue`
 *
 * 兩者都用 `{type:'array'}` 存、`push` 也真的一樣，**而取出的語義相反**：
 *
 * | | 取出哪一個 |
 * |---|---|
 * | `queue.front()` | 最先放進去的 |
 * | `priority_queue.top()` | **最大的** |
 *
 * 這是「共用一個實作，可能是行為一樣，也可能是差別沒被模型化」的同一個坑。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { generateCode } from '../../src/core/projection/code-generator'
import { loadToolbox } from '../helpers/toolbox'
import type { SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const P = '#include <iostream>\n#include <queue>\nusing namespace std;\n'

function lift(src: string): SemanticNode {
  const tree = treeParser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

function collect(node: SemanticNode, id: string): SemanticNode[] {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (!n) return
    if (n.conceptId === id) out.push(n)
    for (const l of Object.values(n.children ?? {})) for (const c of l ?? []) walk(c as SemanticNode)
  }
  walk(node)
  return out
}

async function run(body: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(`${P}int main(){ ${body} return 0; }`))
  return i.getOutput().join('')
}

describe('lift（辨識）', () => {
  it('★ `priority_queue<int> pq;` 辨識得出 cpp_priority_queue_declare', () => {
    const nodes = collect(lift(`${P}int main(){ priority_queue<int> pq; return 0; }`), 'cpp:priority_queue_declare')
    expect(nodes.length, '零個 → 對照表指向的身分仍然不存在').toBeGreaterThan(0)
    expect(nodes[0].properties.name).toBe('pq')
  })
})

describe('generate（產生）', () => {
  it('★ 產得回去，而且不是 queue', () => {
    const code = generateCode(lift(`${P}int main(){ priority_queue<int> pq; return 0; }`), 'cpp', apcs as never)
    expect(code).toContain('priority_queue<int> pq;')
    expect(code).not.toContain('⟨')
  })

  it('★ 負向：不得產成一般 queue', () => {
    // 抄 queue 的產生器會產出 `queue<int> pq;`——那是**另一個資料結構**
    const code = generateCode(lift(`${P}int main(){ priority_queue<int> pq; return 0; }`), 'cpp', apcs as never)
    expect(code.replace('priority_queue', '')).not.toContain('queue<int> pq;')
  })
})

describe('execute（執行）——期望值來自 g++ -std=c++17', () => {
  it('★ top() 取的是**最大值**：g++ 說是 5（不是 1）', async () => {
    const out = await run('priority_queue<int> pq; pq.push(1); pq.push(5); pq.push(3); cout << pq.top();')
    expect(out, '1 代表抄了 queue.front() 的實作——那讓「優先佇列」這個概念完全沒有意義').toBe('5')
  })

  it('★ 負向：**一般 queue** 的 front() 取的是最先進來的', async () => {
    // 沒有這一支的話，「所有容器都回傳最大值」的實作也會過
    const out = await run('queue<int> que; que.push(1); que.push(5); que.push(3); cout << que.front();')
    expect(out, 'queue 也回傳最大值了 → 兩個概念被壓成同一個').toBe('1')
  })

  it('★ 推入順序不影響結果', async () => {
    const out = await run('priority_queue<int> pq; pq.push(5); pq.push(1); pq.push(3); cout << pq.top();')
    expect(out).toBe('5')
  })
})

describe('工具箱（E 項的第一次回報）', () => {
  it('★ 歸屬是導出的——`toolbox-categories.ts` 一個字都沒改', () => {
    const { categoriesOf } = loadToolbox()
    expect(
      categoriesOf.get('cpp_priority_queue_declare'),
      '新元件沒有自動出現 → 那代表歸屬又變回手寫的了',
    ).toContain('堆疊與佇列')
    expect(categoriesOf.get('cpp_priority_queue_peek')).toContain('堆疊與佇列')
  })

  // ⚠️ **上面那一支是使用者拿不到的證據，不是拿得到的證據。**
  //
  // `loadToolbox()` 用「全部概念可見」。而使用者看到的是**課程**的可見集合——
  // 一顆沒有被任何課程收錄的元件，`getVisibleConcepts` 會把它擋掉，
  // 學生**永遠看不到**。
  //
  // 第一版只有上面那一支，於是它綠著，而使用者回報「priority_queue 我沒看到呀」。
  //
  // **這是同一個坑的第三次**：標籤說謊（097）、通用積木消失（100）、這一次。
  // 而「快照要釘在使用者實際會看到的狀態上，不是最大的那個狀態」這句話
  // 三個 commit 前才寫進 experience.md。
  it('★ **學生真的看得到**——在課程的可見集合裡', async () => {
    const { getVisibleConcepts } = await import('../../src/core/level-tree')
    const { BlockSpecRegistry } = await import('../../src/core/block-spec-registry')
    const { buildToolbox } = await import('../../src/ui/toolbox-builder')
    const { CATEGORY_COLORS } = await import('../../src/ui/theme/category-colors')
    const { allCppConcepts, allCppProjections } = await import('../../src/languages/cpp/all-declarations')
    const { cppCategoryDefs } = await import('../../src/languages/cpp/toolbox-categories')
    const beginner = (await import('../../src/languages/cpp/topics/cpp-beginner.json')).default
    const competitive = (await import('../../src/languages/cpp/topics/cpp-competitive.json')).default

    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppConcepts(), allCppProjections())

    for (const [name, topic, levels] of [
      ['初學 C++', beginner, ['L0', 'L1a', 'L1b', 'L2a', 'L2b', 'L2c', 'L3a']],
      ['競程 C++', competitive, ['L0', 'L1a', 'L2a']],
    ] as const) {
      const tb = buildToolbox({
        blockSpecRegistry: reg,
        visibleConcepts: getVisibleConcepts(topic as never, new Set(levels)),
        ioPreference: 'iostream',
        msgs: {},
        categoryColors: CATEGORY_COLORS,
        categoryDefs: cppCategoryDefs,
      }) as { contents: { name: string; contents: { type: string }[] }[] }
      const 全部 = tb.contents.flatMap((c) => c.contents.map((b) => b.type))
      // ⚠️ `b.type` 是**積木型別**，遷移不動它（B 項加法式保留）
      for (const t of ['cpp_priority_queue_declare', 'cpp_priority_queue_peek']) {
        expect(全部, `${name}：學生解鎖到最深的關卡也看不到 ${t}——它沒有被任何課程收錄`).toContain(t)
      }
    }
  })
})
