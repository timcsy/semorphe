/**
 * **模糊測試：類別的前置宣告**（元件管線 313，2026-11-06）
 *
 * 十支程式由隔離的出題者寫（不知道 semorphe 的實作），預期輸出由本機 clang（專案的標頭墊片）跑出來、存在
 * `tests/fixtures/fuzz-cpp-oop-class-declare.json`。報告：`tests/reports/fuzz-cpp-oop-class-declare-20261106.md`。
 *
 * - 前置宣告本身：十支、15 處，全部認得（`cpp:class_declare`），零漂移。
 * - 盲測另外掀出一批本來就在、與前置宣告無關的缺陷（R1～R7），**修了的**各一支測試；**類別外定義成員函式**那一族
 *   （類別裡的方法原型、類別外帶 const／建構子／解構子的定義）要一顆新元件——這一刀先改成【誠實降級】（原文保留、編得過），
 *   路線圖〈類別外定義成員函式〉。課文與 StudyCpp 0 處（2026-11-06 量過）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, runCella } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const PROGS = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-oop-class-declare.json`, 'utf8')) as { id: string; code: string; expected: string }[]
const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const prog = (id: string) => PROGS.find((p) => p.id === id)!
const gen = (code: string) => generateCode(lift(code), 'cpp', S)

/** 刻意的誠實降級（類別外定義成員函式那一族）——其餘的降級一律不准 */
const ALLOWED = /類別裡的方法原型|類別裡的建構子／解構子原型|類別外定義的成員函式/
const COUNT: Record<string, number> = { fuzz_1: 1, fuzz_2: 2, fuzz_3: 1, fuzz_4: 2, fuzz_5: 1, fuzz_6: 1, fuzz_7: 1, fuzz_8: 1, fuzz_9: 1, fuzz_10: 4 }

describe('模糊測試：類別的前置宣告', () => {
  it('入口條件：十支都在、每一支都有預期輸出', () => {
    expect(PROGS).toHaveLength(10)
    expect(PROGS.every((p) => typeof p.expected === 'string' && p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p]))('★ %s：前置宣告都認得（元件身分）、降級只有登記過的那一族、再 lift 不漂移', (id, p) => {
    const t = lift((p as { code: string }).code)
    const nodes = all(t)
    expect(nodes.filter((n) => n.componentId === 'cpp:class_declare')).toHaveLength(COUNT[id as string])
    const bad = nodes.filter((n) => /raw_code|unresolved|raw_expression/.test(n.componentId))
      .map((n) => String(n.metadata?.degradationReason ?? n.metadata?.rawCode ?? ''))
      .filter((why) => !ALLOWED.test(why))
    expect(bad).toEqual([])
    const out = generateCode(t, 'cpp', S)
    expect(shape(lift(out))).toEqual(shape(t))
  })

  it('★ Cella：只用指標、一個從未定義的類別（fuzz_4）判 accept、輸出與 clang 相同', async () => {
    await expectCellaOut(prog('fuzz_4').code, prog('fuzz_4').expected)
  })

  // ── 盲測掀出、這一刀修好的（各一支） ──
  it('🔴 修好的 R1：回傳指標／參照的函式原型不再變成 `Node* ptr;`（fuzz_2、fuzz_9）', () => {
    const out = gen('struct Node;\nNode* pushFront(Node* head, int v);\nconst Node* findTag(const Node* head, int k);\nint& at(int i);\nint* p;\nvoid (*fp)(int);\nint main() {\n}\n')
    expect(out).toContain('Node* pushFront(Node* head, int v);')
    expect(out).toContain('const Node* findTag(const Node* head, int k);')
    expect(out).toContain('int& at(int i);')
    expect(out).toContain('int* p;')
    expect(out).toContain('void (*fp)(int);')
    expect(out).not.toContain('ptr')
  })
  it('🔴 修好的 R2：new Node{v, head} 的大括號初始化不再丟掉（fuzz_2、fuzz_5）', () => {
    const out = gen('struct Node {\n    int v;\n    Node* next;\n};\nint main() {\n    Node* a = new Node{1, nullptr};\n    Node* b = new Node{};\n    int* c = new int(5);\n    int* d = new int();\n    int* e = new int;\n}\n')
    for (const s of ['new Node{1, nullptr}', 'new Node{}', 'new int(5)', 'new int()', 'new int;']) expect(out).toContain(s)
  })
  it('🔴 修好的 R6：回傳指標的覆寫方法保留 const 與 override（fuzz_10：原本 Green 成了抽象類別）', () => {
    const t = lift('class S {\npublic:\n    virtual const char* nm() const = 0;\n};\nclass G : public S {\npublic:\n    const char* nm() const override {\n        return "G";\n    }\n};\nint main() {\n}\n')
    const ov = all(t).find((n) => n.componentId === 'cpp:method_override')
    expect(ov?.properties).toMatchObject({ return_type: 'const char*', name: 'nm', is_const: 'true' })
    expect(generateCode(t, 'cpp', S)).toContain('const char* nm() const override {')
  })

  // ── 第 322 刀（類別外定義成員函式）：原本誠實降級的這一族轉正——原型與類別外的定義各是一顆元件，本體接回類別成員 ──
  it('🟢 類別裡的方法／建構子／解構子原型、類別外的定義（含 const、建構子、解構子）——六顆元件、原文一字不差', () => {
    const src = 'class A {\npublic:\n    int v;\n    A();\n    ~A();\n    int get() const;\n    void set(int x);\n    virtual const char* nm() const = 0;\n};\nA::A() {\n    v = 0;\n}\nA::~A() {\n}\nint A::get() const {\n    return v;\n}\nint main() {\n}\n'
    const t = lift(src)
    const ids = all(t).map((n) => n.componentId)
    for (const id of ['cpp:constructor_declare', 'cpp:destructor_declare', 'cpp:method_declare', 'cpp:constructor_def_outside', 'cpp:destructor_def_outside', 'cpp:method_def_outside']) expect(ids, id).toContain(id)
    // 回傳指標的純虛擬函式第 386 刀轉正——這一段不再有降級
    expect(all(t).filter((n) => n.componentId.includes('raw_code'))).toHaveLength(0)
    const out = generateCode(t, 'cpp', S)
    for (const s of ['    A();', '    ~A();', '    int get() const;', '    void set(int x);', 'A::A() {', 'A::~A() {', 'int A::get() const {']) expect(out).toContain(s)
    expect(out).not.toMatch(/int f\(\);|void A::~A|int A\(\);/)
  })

  it('🟢 Cella：類別外定義成員函式（fuzz_1 互相指到的類別）判 accept、輸出與 clang 相同', async () => {
    await expectCellaOut(prog('fuzz_1').code, prog('fuzz_1').expected)
  })
  // 🔴 2026-11-09：fuzz_7 的 `for (size_t i = 0; …)` 原本被我們改成 int 才判 accept（計數迴圈那顆吃掉型別）。照實送 size_t 之後，
  //    只引入 <iostream> 時「標頭有沒有宣告 size_t 取決於函式庫」——Cella 誠實的 unsupported
  it('🟡 Cella：fuzz_7（觀察者）的 size_t 迴圈變數照實送——判 unknown（標頭是否宣告 size_t 取決於函式庫）', async () => {
    const r = await runCella(prog('fuzz_7').code)
    expect(r.verdict).toBe('unknown')
    expect(r.problems.map((x) => x.reason ?? '').join(' ')).toMatch(/size_t/)
  })
})
