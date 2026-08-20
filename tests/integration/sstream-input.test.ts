/**
 * `istringstream` — 從字串讀值。五路都要在：辨識／渲染／抽取／產生／執行。
 *
 * 期望值全部來自實際 `g++` 編譯執行的輸出，不是推想出來的。
 *
 * ⚠️ **這個檔案存在的主要理由是那條負向斷言。**
 * `in >> a`（串流讀取）與 `num >> 1`（位元位移）**語法完全相同**，
 * 唯一分得出來的依據是根變數的型別。一條「根是任意識別字就當串流」的
 * 規則會把所有位移運算一起認領走——那正是 P3 說的「在執行時碰運氣」。
 * 沒有負向斷言的話，那種過寬的實作會讓正向測試全綠。
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

const PRELUDE = '#include <iostream>\n#include <sstream>\n#include <string>\nusing namespace std;\n'

function lift(body: string): SemanticNode {
  const lifter = createTestLifter()
  const src = `${PRELUDE}int main(){ ${body} return 0; }`
  const tree = treeParser.parse(src)
  if (!tree) throw new Error('parse 失敗')
  return lifter.lift(tree.rootNode as never) as SemanticNode
}

async function run(body: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(lift(body))
  return interp.getOutput().join('')
}

/** 蒐集整棵樹裡符合條件的節點——用來斷言概念身分，不只斷言輸出字串 */
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

describe('istringstream 執行（期望值來自 g++）', () => {
  it('連續讀三個整數', async () => {
    const out = await run('istringstream in("10 20 30"); int a; int b; int c; in >> a >> b >> c; cout << a+b+c;')
    expect(out).toBe('60')
  })

  it('讀字串，且順序正確', async () => {
    // 讀反了的話會是 alphabeta——所以這條同時釘住順序
    const out = await run('istringstream words("alpha beta"); string s1; string s2; words >> s1 >> s2; cout << s2 << s1;')
    expect(out).toBe('betaalpha')
  })

  it('同一個串流可以混讀不同型別', async () => {
    const out = await run('istringstream mixed("7 hi"); int n; string w; mixed >> n >> w; cout << n << w;')
    expect(out).toBe('7hi')
  })

  it('只讀一個值時，串流仍是串流（不是位移）', async () => {
    const out = await run('istringstream one("42"); int v; one >> v; cout << v;')
    expect(out).toBe('42')
  })
})

describe('負向：`>>` 在非串流變數上仍是位元位移', () => {
  it('int 的 `>>` 不得被改判成串流讀取', async () => {
    const out = await run('int num = 8; cout << (num >> 1);')
    expect(out).toBe('4')
  })

  it('位移的概念身分是 arithmetic，不是 input', () => {
    const tree = lift('int num = 8; int r = num >> 1; cout << r;')
    const inputs = collect(tree, (n) => n.componentId === 'cpp:input')
    expect(inputs).toHaveLength(0)
    const shifts = collect(tree, (n) => n.componentId === 'cpp:arithmetic' && n.properties?.operator === '>>')
    expect(shifts).toHaveLength(1)
  })

  it('cin 讀取不帶 from（cin 是標準輸入，不是具名串流）', () => {
    const tree = lift('int x; cin >> x; cout << x;')
    const inputs = collect(tree, (n) => n.componentId === 'cpp:input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].properties?.from).toBeUndefined()
  })
})

describe('概念身分與五路', () => {
  it('串流讀取升成 input，且記得來源與全部目標', () => {
    const tree = lift('istringstream in("10 20 30"); int a; int b; int c; in >> a >> b >> c;')
    const inputs = collect(tree, (n) => n.componentId === 'cpp:input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].properties?.from).toBe('in')
    // 只收到第一個目標曾經是實際的缺陷（走訪停太早），這條釘住它
    expect((inputs[0].children?.values ?? []).map((v) => (v as SemanticNode).properties?.name)).toEqual(['a', 'b', 'c'])
  })

  it('宣告升成 cpp_istringstream_declare，來源掛在 source 底下', () => {
    const tree = lift('istringstream in("10 20 30");')
    const decls = collect(tree, (n) => n.componentId === 'cpp:istringstream_declare')
    expect(decls).toHaveLength(1)
    expect(decls[0].properties?.name).toBe('in')
    expect((decls[0].children?.source ?? []).length).toBe(1)
  })

  it('產生路徑：宣告與讀取都產得回來，且不是無法產生的退路', () => {
    const tree = lift('istringstream in("10 20 30"); int a; int b; in >> a >> b;')
    const code = generateCode(tree, 'cpp', apcs as never)
    expect(code).toContain('istringstream in("10 20 30");')
    expect(code).toContain('in >> a >> b;')
    // `⟨…⟩` 是「產不出來」的標記——出現就代表某一路是殼
    expect(code).not.toContain('⟨')
  })
})
