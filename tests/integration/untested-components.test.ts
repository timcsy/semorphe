/**
 * 三顆**零測試足跡**的元件（B 項，身分整併的第一批）
 *
 * 元件身分健檢護欄（第十八條）報出 `cpp_comma_expr`、`var_declarator`、
 * `cpp_map_access` **在整個測試樹裡一次都沒被提到過**。
 *
 * ## 為什麼「沒被測過」是一個身分問題
 *
 * 膠囊會固化身分。而一顆從來沒有人驗過的元件，**沒有人知道它是活的還是死的**
 * ——搬進膠囊等於把一個未知數固化成一個資料夾。
 *
 * 三種可能，處理方式完全不同：
 *
 * | | 意味著 | 怎麼辦 |
 * |---|---|---|
 * | 活的 | 只是沒人寫測試 | **補測試**（本檔） |
 * | 死的 | 概念存在但沒有路徑到得了 | 刪掉，或記進墓碑 |
 * | 半死 | 五路有缺 | 補齊或明確宣告 skip |
 *
 * **不先量就搬，是把 47 顆可疑元件裡的未知一起搬進去。**
 *
 * ## 期望值來自實際 `g++ -std=c++17`
 *
 * ```
 * 0101928     ← 逗號運算子
 * 123         ← 多變數宣告
 * 78          ← map 存取
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const PRELUDE = '#include <iostream>\n#include <map>\n#include <string>\nusing namespace std;\n'

function lift(body: string): SemanticNode {
  const tree = treeParser.parse(`${PRELUDE}int main(){ ${body} return 0; }`)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

async function run(body: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(lift(body))
  return interp.getOutput().join('')
}

function collect(node: SemanticNode, id: string): SemanticNode[] {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (!n) return
    if (n.conceptId === id) out.push(n)
    for (const list of Object.values(n.children ?? {})) for (const c of list ?? []) walk(c as SemanticNode)
  }
  walk(node)
  return out
}

// ─── cpp_comma_expr ───────────────────────────────────────────────────

describe('cpp_comma_expr — 逗號運算子', () => {
  const 程式 = 'for (int i = 0, j = 10; i < 3; i++, j--) cout << i << j;'

  it('身分：辨識得出 cpp_comma_expr', () => {
    expect(
      collect(lift(程式), 'cpp_comma_expr').length,
      '零個 → 這個概念沒有辨識路徑到得了，那它是死的',
    ).toBeGreaterThan(0)
  })

  it('執行：g++ 說是 0101928', async () => {
    expect(await run(程式)).toBe('0101928')
  })

  it('產生：逗號產得回去', () => {
    const code = generateCode(lift(程式), 'cpp', apcs as never)
    expect(code).toContain('i++, j--')
    expect(code).not.toContain('⟨')
  })
})

// ─── var_declarator ───────────────────────────────────────────────────

describe('var_declarator — 多變數宣告', () => {
  const 程式 = 'int a = 1, b = 2, c; c = a + b; cout << a << b << c;'

  it('身分：三個宣告子都在樹裡，而且各自是完整的宣告概念', () => {
    // ⚠️ **具名斷言**——只驗輸出的話，這個概念可以完全不存在而測試照樣綠。
    // 「測試通過卻什麼都沒測到」在這個專案發生過（五支假的通過）。
    //
    // 而這一支第一版斷言的是 `var_declarator`，**立刻紅**——那個概念
    // 有執行器、有抽取器、有定義，而**沒有任何辨識路徑產出過它**。
    // 它假設所有宣告子都是純名字，但 `int a, *p, arr[3];` 的三個宣告子是
    // 三個**不同**的概念。系統做對了，模型錯了。已進墓碑。
    const 外層 = collect(lift(程式), 'var_declare').filter((n) => (n.children?.declarators ?? []).length > 0)
    expect(外層).toHaveLength(1)
    expect(外層[0].children!.declarators).toHaveLength(3)
  })

  it('負向：不同形狀的宣告子拿到**不同**的概念', () => {
    const 樹 = lift('int a = 1, *p = nullptr, arr[3];')
    const 外層 = collect(樹, 'var_declare').filter((n) => (n.children?.declarators ?? []).length > 0)[0]
    const ids = (外層.children!.declarators as SemanticNode[]).map((d) => d.conceptId)
    expect(new Set(ids).size, '全部同一個概念 → 指標與陣列的形狀資訊掉了').toBeGreaterThan(1)
  })

  it('執行：g++ 說是 123', async () => {
    expect(await run(程式)).toBe('123')
  })

  it('產生：三個變數都在', () => {
    const code = generateCode(lift(程式), 'cpp', apcs as never)
    for (const v of ['a', 'b', 'c']) {
      expect(code, `變數 ${v} 掉了——多變數宣告只產出第一個是既有的已知缺陷形狀`).toContain(v)
    }
    expect(code).not.toContain('⟨')
  })

  it('負向：沒有初始值的那個不得被塞一個預設值', async () => {
    // `int a = 1, b;` 的 b 未初始化。C++ 的未初始化值不確定，
    // 所以這裡只驗**它沒有被當成 0 印出來**——那會是靜默的假資料。
    const code = generateCode(lift('int a = 1, b; cout << a;'), 'cpp', apcs as never)
    expect(code).not.toContain('b = 0')
  })
})

// ─── cpp_map_access ───────────────────────────────────────────────────

describe('cpp_map_access — map 的鍵存取', () => {
  const 程式 = 'map<string, int> m; m["x"] = 7; m["y"] = m["x"] + 1; cout << m["x"] << m["y"];'

  it('身分：讀取位置辨識得出 cpp_map_access', () => {
    expect(
      collect(lift(程式), 'cpp_map_access').length,
      '零個 → 這顆元件五路齊備、進了工具箱與兩份課程清單，卻沒有任何路徑到得了它',
    ).toBeGreaterThan(0)
  })

  it('執行：g++ 說是 78', async () => {
    expect(await run(程式)).toBe('78')
  })

  it('產生：`m["x"]` 產得回去', () => {
    const code = generateCode(lift(程式), 'cpp', apcs as never)
    expect(code).toContain('m["x"]')
    expect(code).not.toContain('⟨')
  })
})
