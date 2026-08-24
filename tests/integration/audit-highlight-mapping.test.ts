/**
 * 第五十六條護欄：**對應表指到的那一行，要真的是那個節點自己的那一行。**
 *
 * ## 這條規範從哪來
 *
 * 使用者 2026-08-24：「我還發現有時候 **HighLight 兩邊對不上**。」
 *
 * 量出來的形狀（**先讀證據再提假設**，見 `diagnose-in-browser`）：
 *
 * ```
 * 0| x = 1          MAP var_assign  行 0  ✔
 * 1| if x > 0:      MAP var_assign  行 1  ✘ 那是 `if` 的標頭
 * 2|     y = 2      MAP print       行 2  ✘ 那是 y = 2
 * 3|     print(y)   MAP var_assign  行 3  ✘ 那是 print(y)
 * ```
 *
 * **區塊裡的每一顆都往上偏一行**：按下「設定 y 為 2」，反白跑到 `if x > 0:`。
 *
 * 根因：行號由一個共用的計數器記，而**複合產生器必須自己把標頭那一行算進去**
 * （`trackOwnText`）。C++ 那側每一顆都呼叫了，**Python 那側九顆一顆都沒有**
 * ——於是主體裡的每一顆都從標頭那一行開始算。
 *
 * > **一條靠「每個實作者記得呼叫」維持的契約，第二個語言進來的那天就會破。**
 * > 而它**不會有任何測試變紅**：產出的程式碼一字不差，錯的只有對應表。
 *
 * ## 量什麼
 *
 * 一個**有主體**的節點，它的標頭佔掉一行，所以：
 *
 * ```
 * 標頭的行號  <  主體第一顆的行號
 * ```
 *
 * ⚠️ **根節點除外**：`program` 沒有標頭，它的主體就是從第 0 行開始。
 * 這不是特例豁免，是「它本來就沒有標頭」——而那正是這條不變式的前提。
 *
 * ## 本護欄【不】檢測什麼
 *
 * - ❌ **不檢測欄位層的對應**（積木上的哪一格 ↔ 程式碼的哪一段）——只到行。
 * - ❌ **不檢測反白畫得對不對**（那是視圖的事）——只檢測它拿到的座標。
 * - ⚠️ **偏移剛好等於零時抓不到**：一個標頭有兩行的結構若少算一行，
 *   `<` 仍然成立。要抓那個得比「節點自己的文字」，成本高得多。
 *
 * ## 自我否證聲明 ⚠️ 先於量測寫下
 *
 * > **如果餵一份「主體第一顆與標頭同一行」的合成對應表進判定函式，
 * > 而它回報乾淨，代表這條護欄壞了，不是世界很乾淨。**
 *
 * 判斷依據是下面的 `★ 注入①`——它餵的是**合成的對應表**，不是任何真實元件的狀態。
 * ⚠️ 入口條件錨在**掃了幾段語料**上，那個量不會因為缺陷被修好而變小。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { liftPython, generatePython, createPythonLifter } from '../helpers/python-lift'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { PythonParser } from '../../src/languages/python/parser'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCodeWithMapping } from '../../src/core/projection/code-generator'
import type { CodeMapping } from '../../src/core/projection/code-generator'
import { printReport, assertCorpus, assertRatchet } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import pythonStyle from '../../src/languages/python/styles/python.json'

/** C++ 那側是**正向錨點**——它一直是對的，而少了它這條護欄只保護一個語言。 */
const CPP_PROBES: readonly (readonly [string, string])[] = [
  ['巢狀 if', 'int main() {\n    int x = 1;\n    if (x > 0) {\n        int y = 2;\n    }\n    return 0;\n}\n'],
  ['for 裡的 while', 'int main() {\n    for (int i = 0; i < 2; i++) {\n        while (i > 0) {\n            i--;\n        }\n    }\n    return 0;\n}\n'],
  ['函式與兩個語句', 'int add(int a, int b) {\n    int s = a + b;\n    return s;\n}\n'],
]

/**
 * 判定：**有主體的節點，主體第一顆必須排在它的標頭之後**。
 *
 * 吃的是「樹 ＋ 對應表 ＋ 根的 id」，所以**注入餵得進來**（合成的對應表就能驗）。
 */
export function misaligned(
  tree: SemanticNode,
  mappings: readonly CodeMapping[],
  rootId: string,
): string[] {
  const range = new Map(mappings.map((m) => [m.nodeId, m]))
  const out: string[] = []
  const walk = (n: SemanticNode): void => {
    const m = range.get(n.id)
    // ⚠️ 主體的鍵不只一個（`body`／`methods`／`try_body`…）——取第一個非空的
    const body = Object.entries(n.children ?? {})
      .filter(([k]) => k === 'body' || k === 'methods' || k === 'try_body')
      .map(([, v]) => v).find((v) => v.length > 0)
    if (m && body && n.id !== rootId) {
      const first = range.get(body[0].id)
      // 🔴 標頭佔掉一行，所以主體第一顆**必須**在它後面
      if (first && !(m.startLine < first.startLine)) {
        out.push(`${n.componentId} 標頭在行 ${m.startLine}，而主體第一顆也在行 ${first.startLine}`)
      }
    }
    for (const ks of Object.values(n.children ?? {})) ks.forEach(walk)
  }
  walk(tree)
  return out
}

let tp: Parser
let cppLifter: Lifter

beforeAll(async () => {
  const pyParser = new PythonParser()
  await pyParser.init(`${process.cwd()}/public`)
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  createPythonLifter()
  setDegradationLanguage('python')
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  cppLifter = createTestLifter()
  registerCppLanguage()
})

describe('第五十六條護欄：積木↔程式碼的對應表指得準嗎', () => {
  it('★ 注入①：一份「主體與標頭同一行」的對應表【必須】被抓到', () => {
    // 合成的樹與合成的對應表——**一個真實元件身分都沒有**
    const kid: SemanticNode = { id: 'k', componentId: 'x:kid', properties: {}, children: {} }
    const parent: SemanticNode = { id: 'p', componentId: 'x:parent', properties: {}, children: { body: [kid] } }
    const root: SemanticNode = { id: 'r', componentId: 'x:root', properties: {}, children: { body: [parent] } }
    const bad: CodeMapping[] = [
      { nodeId: 'r', startLine: 0, endLine: 2 },
      { nodeId: 'p', startLine: 0, endLine: 2 },
      { nodeId: 'k', startLine: 0, endLine: 0 },  // ← 與標頭同一行
    ]
    expect(misaligned(root, bad, 'r'), '對應表偏了而護欄沒說話 → 判定壞了').toHaveLength(1)
  })

  it('★ 注入②：一份正確的對應表不可以被誤報（含沒有標頭的根）', () => {
    const kid: SemanticNode = { id: 'k', componentId: 'x:kid', properties: {}, children: {} }
    const parent: SemanticNode = { id: 'p', componentId: 'x:parent', properties: {}, children: { body: [kid] } }
    const root: SemanticNode = { id: 'r', componentId: 'x:root', properties: {}, children: { body: [parent] } }
    const good: CodeMapping[] = [
      { nodeId: 'r', startLine: 0, endLine: 1 },   // 根沒有標頭——從第 0 行開始是對的
      { nodeId: 'p', startLine: 0, endLine: 1 },
      { nodeId: 'k', startLine: 1, endLine: 1 },
    ]
    expect(misaligned(root, good, 'r'), '一個「什麼都報」的判定也會過注入① —— 這一支擋的是它')
      .toEqual([])
  })

  it('★ 入口條件：語料與探針真的餵進來了', () => {
    expect(PYTHON_CORPUS.length, '語料是空的 → 下面的零是假的').toBeGreaterThan(50)
    expect(CPP_PROBES.length, 'C++ 那一半沒餵 → 這條護欄只保護一個語言').toBeGreaterThan(2)
  })

  it('硬性零：每一顆的對應都指到自己那一行', async () => {
    const bad: string[] = []
    let scanned = 0

    for (const [name, src] of PYTHON_CORPUS) {
      const tree = await liftPython(src)
      if (!tree) continue
      scanned++
      generatePython(tree)  // 確保 python 的產生器工廠已註冊
      const { mappings } = generateCodeWithMapping(tree, 'python', pythonStyle as unknown as StylePreset)
      for (const m of misaligned(tree, mappings, tree.id)) bad.push(`py ${name}｜${m}`)
    }
    for (const [name, src] of CPP_PROBES) {
      scanned++
      const tree = cppLifter.lift(tp.parse(src)!.rootNode as never) as SemanticNode
      const { mappings } = generateCodeWithMapping(tree, 'cpp', apcs as unknown as StylePreset)
      for (const m of misaligned(tree, mappings, tree.id)) bad.push(`cpp ${name}｜${m}`)
    }

    printReport('對應表指到的那一行是不是自己那一行', [
      `掃描   ${scanned} 段（Python 語料 ${PYTHON_CORPUS.length} ＋ C++ 探針 ${CPP_PROBES.length}）`,
      `偏了   ${bad.length} 筆  ← 硬性零`,
      ...bad.slice(0, 12).map((b) => `  ✘ ${b}`),
      bad.length > 12 ? `  …其餘 ${bad.length - 12} 筆` : '',
      '',
      '⚠️ 這一類缺陷**不會讓任何既有測試變紅**：產出的程式碼一字不差，',
      '   錯的只有「按下積木時反白到哪一行」。',
    ].filter(Boolean))

    assertCorpus([['語料段數', PYTHON_CORPUS.length], ['C++ 探針', CPP_PROBES.length]], 'highlight-mapping')
    assertRatchet([['偏了', bad.length]], 'highlight-mapping', { detail: bad })
    expect(bad, '按下積木反白到別行——使用者：「HighLight 兩邊對不上」').toEqual([])
  }, 120_000)
})
