/**
 * **Round-trip：`cpp:class_declare`**（元件管線 313，2026-11-06）——類別的前置宣告。
 *
 * 每支程式量四件：① 語義樹裡真的有 `cpp:class_declare`、沒有降級（元件身分）② 產碼一字不差 ③ 產出的碼再 lift 是同一棵樹
 * ④ Cella 判 accept 且輸出相同（預期輸出用本機 clang 對過）。
 * 另外照 Cella 給的不完整型別規則（cella 2026-11-06）量兩邊：只有前置宣告時，指標可以宣告、比較、互相指派；
 * 解參照、取成員、以值宣告變數要判 reject。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, runCella } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

const lift = (code: string): SemanticNode => createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode
function find(n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) find(k, id, out)
  return out
}
function shape(n: SemanticNode): unknown {
  return [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
}

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const CASES: [string, string, string, number][] = [
  ['互相指到的兩個類別', 'class B;\nclass A {\npublic:\n    B* other;\n    int v;\n};\nclass B {\npublic:\n    A* other;\n    int w;\n};\nint main() {\n    A a;\n    B b;\n    a.other = &b;\n    b.other = &a;\n    b.w = 3;\n    a.v = 4;\n    cout << a.other->w << b.other->v << endl;\n    return 0;\n}\n', '34\n', 1],
  ['從未定義，只拿來宣告指標', 'class Helper;\nint main() {\n    Helper* p = nullptr;\n    Helper* q = p;\n    cout << (q == nullptr) << endl;\n    return 0;\n}\n', '1\n', 1],
  ['先宣告兩次再定義', 'struct N;\nstruct N;\nstruct N {\n    int v;\n};\nint main() {\n    N n;\n    n.v = 5;\n    cout << n.v << endl;\n    return 0;\n}\n', '5\n', 2],
  ['鏈結串列的節點先宣告', 'struct Node;\nint length(Node* head);\nstruct Node {\n    int v;\n    Node* next;\n};\nint length(Node* head) {\n    int n = 0;\n    while (head != nullptr) {\n        n++;\n        head = head->next;\n    }\n    return n;\n}\nint main() {\n    Node c;\n    c.v = 3;\n    c.next = nullptr;\n    Node b;\n    b.v = 2;\n    b.next = &c;\n    Node a;\n    a.v = 1;\n    a.next = &b;\n    cout << length(&a) << endl;\n    return 0;\n}\n', '3\n', 1],
  ['指標當參數、定義在呼叫之後', 'class Counter;\nvoid bump(Counter* c);\nclass Counter {\npublic:\n    int n;\n};\nvoid bump(Counter* c) {\n    c->n = c->n + 1;\n}\nint main() {\n    Counter k;\n    k.n = 9;\n    bump(&k);\n    bump(&k);\n    cout << k.n << endl;\n    return 0;\n}\n', '11\n', 1],
]

describe('round-trip：cpp:class_declare', () => {
  it.each(CASES)('★ %s：元件身分、產碼一字不差、不動點', (_name, body, _out, n) => {
    const src = H + body
    const tree = lift(src)
    expect(find(tree, 'cpp:class_declare'), '元件身分').toHaveLength(n)
    expect(find(tree, 'raw_code').concat(find(tree, 'unresolved')), '降級了').toEqual([])
    const out = generateCode(tree, 'cpp', S)
    expect(out.trim()).toBe(src.trim())
    expect(shape(lift(out))).toEqual(shape(tree))
  })

  it.each(CASES)('★ %s：Cella 判 accept、輸出相同', async (_name, body, expected) => {
    await expectCellaOut(H + body, expected)
  })
})

describe('不完整型別（只有前置宣告、沒有定義）：Cella 的規則', () => {
  const NEG: [string, string][] = [
    ['取成員', 'struct Box;\nint main() {\n    Box* p = nullptr;\n    int x = p->v;\n    return x;\n}\n'],
    ['以值宣告變數', 'class Helper;\nint main() {\n    Helper h;\n    return 0;\n}\n'],
  ]
  it.each(NEG)('★ %s：判 reject（不是 accept、也不是我們這側翻不出）', async (_name, body) => {
    const r = await runCella(H + body)
    expect(r.untranslated, '我們這側要翻得出').toEqual([])
    expect(r.verdict, JSON.stringify(r.problems.map((p) => p.kind + '｜' + (p.reason ?? '')))).toBe('reject')
  })
})

describe('不完整型別：Cella 該拒絕而放過的', () => {
  // 🟢 原本是 Cella 的已知缺陷（2026-11-06 量到、回報）：函式【定義】的參數以值用不完整型別，Cella 判 accept。
  //    cella 0.1.202611060800 修好（reason 用 clang 的說法：variable has incomplete type）
  it('★ void take(Helper h) {} 判 reject', async () => {
    const r = await runCella(H + 'class Helper;\nvoid take(Helper h) {\n}\nint main() {\n    return 0;\n}\n')
    expect(r.untranslated).toEqual([])
    expect(r.verdict).toBe('reject')
  })
})

describe('不完整型別：照標準【合法】的那一邊（clang 也收）', () => {
  // `*p` 只產生一個左值——對不完整型別合法；要把值讀出來（左值轉右值）才不合法（[conv.lval]）。
  // 函式沒被呼叫，所以也沒有執行期的問題。Cella 2026-11-06 說「解參照」要拒絕——這一支量的是它有沒有把合法的那一半也拒絕掉
  // 🟢 原本是 Cella 的已知缺陷（2026-11-06 量到、回報）：判 reject「dereferencing a pointer to an incomplete type」——說一支合法的程式有錯。
  //    cella 0.1.202611060800 修好（*p 只是左值，讀值才要完整型別）
  it('★ 沒被呼叫的函式裡 *p; 判 accept', async () => {
    const r = await runCella(H + 'class Helper;\nvoid touch(Helper* p) {\n    *p;\n}\nint main() {\n    cout << 1 << endl;\n    return 0;\n}\n')
    expect(r.untranslated).toEqual([])
    expect(r.verdict, JSON.stringify(r.problems.map((p) => p.kind + '｜' + (p.reason ?? '')))).toBe('accept')
  })
})
