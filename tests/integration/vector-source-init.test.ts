/**
 * `vector<T> v = <運算式>` —— 初始值是一整個運算式，不是元素列表。
 *
 * 期望值來自實際 `g++ -std=c++17` 編譯執行。
 *
 * ## 這一筆的停用標記指錯了方向
 *
 * 它標的是 `[UNSUPPORTED:vector 的初始化列表語法尚無對應概念]`，而**初始化
 * 列表早就支援了**（094 做的）。掉的是**函式呼叫當初始值**。照標記走會去改
 * 一段已經正確的程式碼，而真正的缺口原封不動。
 *
 * 同一批三支停用測試，兩支的標記是過期的（花括號初始化已支援，量過之後直接
 * 開回來就綠），一支的標記方向錯。**三支沒有一支的標記可以直接相信。**
 *
 * ## 症狀為什麼難發現
 *
 * 初始值被丟掉時：變數宣告成空的、**產回去的程式碼也少了那一段**，於是
 * 來回轉換比對「成功」。只有真的跑起來（索引越界）才會露出來。
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

const PRELUDE = '#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n'

function lift(src: string): SemanticNode {
  const tree = treeParser.parse(PRELUDE + src)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

function liftMain(body: string): SemanticNode {
  return lift(`int main(){ ${body} return 0; }`)
}

async function run(tree: SemanticNode): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(tree)
  return interp.getOutput().join('')
}

function collect(node: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode[] {
  const found: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (!n) return
    if (pred(n)) found.push(n)
    for (const list of Object.values(n.children ?? {})) {
      for (const child of list ?? []) walk(child as SemanticNode)
    }
  }
  walk(node)
  return found
}

const funcReturn =
  'vector<int> f() { vector<int> r = {7, 8}; return r; }\n' +
  'int main() { vector<int> v = f(); cout << v[0] << v.size() << endl; return 0; }'

describe('vector 的運算式初始值（期望值來自 g++ -std=c++17）', () => {
  it('函式回傳值當初始值', async () => {
    expect(await run(lift(funcReturn))).toBe('72\n')
  })

  it('另一個 vector 當初始值，且是**複製**不是共用', async () => {
    // 共用的話，push_back 到 w 會讓 v.size() 也變成 3 → 印出 "33"
    const out = await run(liftMain(
      'vector<int> v = {1, 2}; vector<int> w = v; w.push_back(9); cout << v.size() << w.size();',
    ))
    expect(out).toBe('23')
  })
})

describe('概念身分與五路', () => {
  it('初始值掛在 source 底下，且不是被丟掉', () => {
    const tree = liftMain('vector<int> v = f();')
    const decls = collect(tree, (n) => n.componentId === 'cpp:vector_declare')
    expect(decls).toHaveLength(1)
    expect(
      (decls[0].children?.source ?? []).length,
      '初始值被丟掉時，這裡是 0——而產回去的程式碼也會少那一段，' +
        '於是來回轉換比對會「成功」。這條是唯一擋得住它的斷言。',
    ).toBe(1)
  })

  it('產生路徑：初始值產得回來', () => {
    const code = generateCode(liftMain('vector<int> v = f();'), 'cpp', apcs as never)
    expect(code).toContain('vector<int> v = f();')
    expect(code).not.toContain('⟨')
  })

  it('負向：元素列表仍走 values，不得改走 source', () => {
    const decls = collect(liftMain('vector<int> v = {3, 1, 4};'), (n) => n.componentId === 'cpp:vector_declare')
    expect(decls[0].children?.source ?? []).toHaveLength(0)
    expect(decls[0].children?.values ?? []).toHaveLength(3)
  })

  it('負向：`vector<int> v(5)` 是建構子引數，兩個子節點都不得有東西', () => {
    // argument_list 不是初始值運算式——當成 source 的話會產出
    // `vector<int> v = 5;`，那不是合法程式
    const decls = collect(liftMain('vector<int> v(5);'), (n) => n.componentId === 'cpp:vector_declare')
    expect(decls[0].children?.source ?? []).toHaveLength(0)
    expect(decls[0].children?.values ?? []).toHaveLength(0)
  })

  it('pair 的初始值接得住了（2026-08-13 修，釘子已拔）', () => {
    // ✅ **這支曾經是 `it.fails`**，而那個機制照設計運作了一次：
    // 缺陷還在時它綠且出聲；修好的那一刻它變紅，逼人來拔釘子。
    //
    // 當時沒一起修的理由逐字：「`cpp_pair_declare` 的 `children` 是空的且
    // `skipPaths: ['execute']`（理由「declarative」）。要接上初始值就得把
    // 執行那一路也做出來，那是另一個功能」——**而那正是 2026-08-13 做的事**：
    // 🔴 那個 `skipPaths` 是一個**假的「顯式的空」**（`pair<int,int> p;` 當然有
    // 執行語義），它讓完備性護欄綠著而 5 段語料跑不動。
    const decls = collect(
      liftMain('pair<int, string> p = make_pair(42, "hello");'),
      (n) => n.componentId === 'cpp:pair_declare',
    )
    expect(decls[0].children?.source ?? []).toHaveLength(1)
  })

  it('負向：沒有初始值的宣告產出不得多一個 `=`', () => {
    const code = generateCode(liftMain('vector<int> v;'), 'cpp', apcs as never)
    expect(code).toContain('vector<int> v;')
    expect(code).not.toContain('vector<int> v =')
  })
})
