/**
 * spec 157：**等價從【宣告】升級成【行為】。**
 *
 * ## 為什麼需要這一支
 *
 * spec `156` 的等價護欄自己寫著它量不到什麼：
 *
 * > ```
 * > 量得到   在【宣告的性狀】這個觀察集下，誰跟誰同類
 * > 量不到   它們是不是【真的】做同一件事——那要行為證據
 * > ```
 *
 * 這一支補的就是那一半：**一段真的 Python 原始碼**走完
 * `解析 → lift → 語義樹 → generate`，而形式**一字不差**。
 *
 * ## ⚠️ 這一支的能力邊界
 *
 * ```
 * 量得到   Python 的 print 認得出來、產得回去
 * 量不到   它在瀏覽器裡能不能用——**沒有 Python target**，
 *          所以 wasm【不出貨】，而這支從 tests/assets/ 讀它
 * ```
 *
 * 🔴 **wasm 不放 `public/`** 是刻意的：`e2e/shipped-assets.spec.ts` 的判準是
 * 「出貨的每一個 wasm，都要有人真的去要它」，而瀏覽器裡沒有人會去要它。
 * > **一個沒有人載入的資產不是「準備好了」，是死重。**
 * 🟢 重開條件：Python 有了 target（那時它才有人要）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset, NodeGenerator } from '../../src/core/types'
import { registerLanguage, generateCode } from '../../src/core/projection/code-generator'
import { registerGenerate as registerPythonPrint } from '../../src/components/python/print/generate'
import googleStyle from '../../src/languages/cpp/styles/google.json'

let pyParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  pyParser = new Parser()
  // ⚠️ 從 `tests/assets/` 讀——**不是 `public/`**（見檔頭）。
  pyParser.setLanguage(await Language.load(`${process.cwd()}/tests/assets/tree-sitter-python.wasm`))
  lifter = createTestLifter()

  // 🟢 Python 的產生器——**組裝點在測試裡**，因為產品還沒有 Python target。
  registerLanguage('python', (): Map<string, NodeGenerator> => {
    const g = new Map<string, NodeGenerator>()
    registerPythonPrint(g)
    return g
  })
})

function componentsIn(n: SemanticNode, out: string[] = []): string[] {
  out.push(n.componentId)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids as SemanticNode[]) componentsIn(k, out)
  return out
}

/** 找出那顆 `python:print`——⚠️ **不要拿整棵樹去產出**，見下一段。 */
function findComponent(n: SemanticNode, id: string): SemanticNode | null {
  if (n.componentId === id) return n
  for (const kids of Object.values(n.children ?? {})) {
    for (const k of kids as SemanticNode[]) {
      const hit = findComponent(k, id)
      if (hit) return hit
    }
  }
  return null
}

describe('spec 157 · Python 的第一趟行為證據', () => {
  it('★ 錨點：Python 的解析器真的認得 Python（否則下面在測空樹）', () => {
    const root = pyParser.parse('print("hi")').rootNode
    expect(root.type, 'tree-sitter 沒有把它當成 Python 模組').toBe('module')
    expect(root.toString(), '解析結果裡沒有 call 節點').toContain('call')
  })

  it('🔴 `print("hi")` lift 出 `python:print`', () => {
    const tree = lifter.lift(pyParser.parse('print("hi")').rootNode as never)
    expect(tree, 'lift 回了 null').not.toBeNull()
    expect(componentsIn(tree!),
      'Python 的 print 沒有被辨識——⚠️ 而 spec 156 那筆 `patternType: "named-call"` '
      + '就是這樣被靜靜忽略的').toContain('python:print')
  })

  it('🔴 反向：`foo("hi")` **不得**變成 `python:print`', () => {
    // 🔴 **這一條是注入實測逼出來的**：把 `constraints` 整個拿掉，
    //    樣式就會吃下**任何** `call` 節點——而只測 `print(...)` 的話**看不出來**。
    //
    // > **「會報」與「不亂報」是兩個方向，而只釘一個方向的護欄，
    // > 一個「什麼都認」的樣式也能通過。**
    const tree = lifter.lift(pyParser.parse('foo("hi")').rootNode as never)!
    expect(componentsIn(tree), 'foo(...) 也被認成 print → 樣式的 constraints 沒生效')
      .not.toContain('python:print')
  })

  it('🔴 引數真的被收進 `values`——而不是只留在 rawCode 裡', () => {
    // 🔴 **這一條是注入實測逼出來的。**
    //    第一版直接拿【整棵樹】去 generate，而**根節點是 `unresolved`**
    //    （Python 的 `module` 還沒有樣式）——於是產出走的是**降級路徑的 `rawCode`**，
    //    與我的產生器**一點關係都沒有**。
    //    ⚠️ 把 `fieldMappings` 整個拿掉，那一版**照樣綠**。
    //
    // > **一個因為錯誤理由而給出正確結果的護欄，看起來與健康的完全一樣。**
    const tree = lifter.lift(pyParser.parse('print("hi")').rootNode as never)!
    const node = findComponent(tree, 'python:print')
    expect(node, '樹裡沒有 python:print').not.toBeNull()
    expect(node!.children.values?.length,
      '引數沒有被收進 `values` → `fieldMappings` 沒生效').toBe(1)
  })

  it('🔴 產回去一字不差——而且是【那顆節點】產的', () => {
    const tree = lifter.lift(pyParser.parse('print("hi")').rootNode as never)!
    const node = findComponent(tree, 'python:print')!
    const out = generateCode(node, 'python', googleStyle as unknown as StylePreset)
    expect(out.trim(), `產出對不上：${JSON.stringify(out)}`).toBe('print("hi")')
  })
})
