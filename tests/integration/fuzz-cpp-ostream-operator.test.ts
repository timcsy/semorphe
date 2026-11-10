/**
 * **模糊測試：自訂 operator<< 與把 ostream 傳來傳去**（元件管線 392，2026-11-10）
 *
 * 四支程式由隔離的出題者寫（不知道 semorphe 的實作），預期輸出由 clang++ 跑出來，存在 tests/fixtures/fuzz-cpp-ostream-operator.json。
 *
 * 盲測抓到四個缺陷，都修了，下面各釘一條（結果：4 程式、4 個缺陷已修、零 todo）：
 * ① 回傳參照的類別內運算子（Point& operator[]）走到一般函式，尾端 const 掉了，const／非 const 兩個多載產回去編不過。
 * ② 類別成員函式的參數沒有登記型別，os << x 認不出是串流，合法程式被判 reject。
 * ③ 參照欄位（ostream& out;）的名字被存成 "& out"，合法程式被判 reject。
 * ④ Logger log(cout); 被當成函式原型，之後的 log.w() 判「未宣告」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut, knownCellaGap, runCella } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const PROGS = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-ostream-operator.json`, 'utf8')) as { id: string; code: string; expected: string }[]
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
const H = '#include <iostream>\n#include <string>\nusing namespace std;\n'
const count = (t: SemanticNode, id: string) => all(t).filter((n) => n.componentId === id).length

/** 每一支裡串流寫入至少幾句；fuzz_3 的 operator<< 全是帶本體的 friend，照實是原文 */
const WRITES: Record<string, number> = { fuzz_1: 6, fuzz_2: 6, fuzz_3: 0, fuzz_4: 7 }

describe('模糊測試：自訂 operator<<', () => {
  it('入口條件：四支都在、每一支都有預期輸出', () => {
    expect(PROGS.map((p) => p.id)).toEqual(['fuzz_1', 'fuzz_2', 'fuzz_3', 'fuzz_4'])
    expect(PROGS.every((p) => p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('★ %s：認得串流寫入、再 lift 不漂移', (id, p) => {
    const t = lift(p.code)
    expect(count(t, 'cpp:stream_write')).toBeGreaterThanOrEqual(WRITES[id])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  // Cella 那一側的缺口（已回報）：翻得過去，它說 operator<< 的候選跨命名空間還不支援。修好時這條會紅，拿掉 knownCellaGap
  it('🟡 Cella：虛擬函式裡寫 ostream、基底的 operator<<（fuzz_2）', async () => {
    await knownCellaGap(/more than one namespace/, () => expectCellaOut(prog('fuzz_2').code.replace(/size_t i/g, 'int i'), prog('fuzz_2').expected))
  })

  it.each([
    ['fuzz_1', /這顆類別成員還沒有對應/, '類別裡帶本體的 static 成員函式'],
    ['fuzz_3', /這顆類別成員還沒有對應/, '帶本體的 friend'],
    ['fuzz_4', /ostringstream|函式呼叫/, 'ostringstream、左端是函式呼叫的串流寫入'],
  ])('🟡 %s 照實翻不出（%s）：%s', async (id, why) => {
    const r = await runCella(prog(id).code)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.some((u) => (why as RegExp).test(u.reason))).toBe(true)
  })
})

describe('盲測抓到的缺陷', () => {
  it('① 回傳參照的 const／非 const operator[] 兩個都留著，產回去一字不差', () => {
    const c = 'struct P {\n    int x;\n};\nclass A {\npublic:\n    P& operator[](int i) {\n        return ps[i];\n    }\n    const P& operator[](int i) const {\n        return ps[i];\n    }\nprivate:\n    P ps[2];\n};\n'
    const t = lift(c)
    const ops = all(t).filter((n) => n.componentId === 'cpp:operator_overload')
    expect(ops.map((n) => [n.properties.return_type, n.properties.is_const])).toEqual([['P&', 'false'], ['const P&', 'true']])
    expect(generateCode(t, 'cpp', S)).toContain('const P& operator[](int i) const {')
  })

  it('① 放不下的運算子照實不收：兩個參數的 operator() 不會少一個', () => {
    const c = 'struct F {\n    int operator()(int a, int b) {\n        return a + b;\n    }\n};\n'
    const t = lift(c)
    expect(count(t, 'cpp:operator_overload')).toBe(0)
    expect(generateCode(t, 'cpp', S)).toContain('(int a, int b)')
  })

  it('① 尾端的 noexcept 不再安靜丟掉', () => {
    const c = 'struct G {\n    int f() const noexcept {\n        return 1;\n    }\n};\n'
    expect(generateCode(lift(c), 'cpp', S)).toContain('const noexcept')
  })

  it('② 成員函式的 ostream 參數：認得、判 accept', async () => {
    const c = H + 'struct Q {\n  string n;\n  void p(ostream& os) const { os << n << endl; }\n};\nint main() { Q q; q.n = "z"; q.p(cout); return 0; }\n'
    expect(count(lift(c), 'cpp:stream_write')).toBe(1)
    await expectCellaOut(c, 'z\n')
  })

  it('③④ 參照欄位、方法寫在欄位前面、Logger log(cout)：判 accept', async () => {
    const c = H + 'class L {\npublic:\n  L(ostream& o) : out(o), k(1) {}\n  void w(int v) { out << v + k << endl; }\nprivate:\n  ostream& out;\n  int k;\n};\nint main() { L l(cout); l.w(3); return 0; }\n'
    const t = lift(c)
    expect(all(t).filter((n) => n.properties?.name === 'out' && n.componentId === 'cpp:var_declare').map((n) => n.properties.type)).toEqual(['ostream&'])
    expect(count(t, 'cpp:stream_write')).toBe(1)
    await expectCellaOut(c, '4\n')
  })

  it('return os << x 等於先寫再回傳串流：判 accept、輸出對', async () => {
    const c = H + 'struct P { int x; };\nostream& operator<<(ostream& os, const P& p) { return os << "(" << p.x << ")"; }\nvoid g(ostream& o, P p) { o << p << "!" << endl; }\nint main() { P a; a.x = 7; g(cout, a); return 0; }\n'
    await expectCellaOut(c, '(7)!\n')
  })

  it('🟡 左端是函式呼叫：程式碼與積木認得，Cella 照實不送（sOut 不會執行那個呼叫，輸出會少字）', async () => {
    const c = H + 'ostream& ind(ostream& os) { os << " "; return os; }\nint main() { ind(cout) << 5 << endl; return 0; }\n'
    expect(count(lift(c), 'cpp:stream_write')).toBe(2)
    const r = await runCella(c)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason)).toEqual(['左端是函式呼叫的串流寫入還沒有對應'])
  })
})
