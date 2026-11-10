/**
 * **模糊測試：在類別裡直接寫完本體的 friend**（元件管線 394，2026-11-10）
 *
 * 四支程式由隔離的出題者寫（不知道 semorphe 的實作），預期輸出由 clang++ 跑出來，存在 tests/fixtures/fuzz-cpp-friend-def.json。
 * 產回去的程式碼本機也拿 clang++ 跑過（補上 using namespace std），四支輸出都與原程式相同。
 *
 * 盲測抓到兩個缺陷，都修了，下面各釘一條（結果：4 程式、2 個缺陷已修、零 todo）：
 * ① 類別裡帶名字的巢狀型別，名字被匿名成員那條路清掉，產回去編不過。
 * ② 類別預設的 private 區宣告了型別，產碼把 public 排前面，用到那個型別的成員簽名編不過。
 * ③（②的延伸探針）類別裡的 enum Color { RED }; 與 class B { … }; 被編出一個叫 x 的欄位。
 *
 * 等 Cella 的 mbFriendDef：四支現在都是 untranslated（照實說翻不出）；Cella 發版後這裡改成比輸出。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const PROGS = JSON.parse(readFileSync(process.cwd() + '/tests/fixtures/fuzz-cpp-friend-def.json', 'utf8')) as { id: string; code: string; expected: string }[]
const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => process.cwd() + '/public/' + s })
  parser = new Parser()
  parser.setLanguage(await Language.load(process.cwd() + '/public/tree-sitter-cpp.wasm'))
  registerCppLanguage()
}, 120_000)
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, o: SemanticNode[] = []): SemanticNode[] => { o.push(n); for (const k of Object.values(n.slots ?? {})) for (const c of k) all(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const count = (t: SemanticNode, id: string) => all(t).filter((n) => n.componentId === id).length

const FRIENDS: Record<string, number> = { fuzz_1: 6, fuzz_2: 4, fuzz_3: 10, fuzz_4: 6 }
const WRITES: Record<string, number> = { fuzz_1: 2, fuzz_2: 3, fuzz_3: 2, fuzz_4: 3 }

describe('模糊測試：帶本體的 friend', () => {
  it('入口條件：四支都在、每一支都有預期輸出', () => {
    expect(PROGS.map((p) => p.id)).toEqual(['fuzz_1', 'fuzz_2', 'fuzz_3', 'fuzz_4'])
    expect(PROGS.every((p) => p.expected.length > 0)).toBe(true)
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('★ %s：認得帶本體的 friend、再 lift 不漂移', (id, p) => {
    const t = lift(p.code)
    expect(count(t, 'cpp:friend_def')).toBe(FRIENDS[id])
    expect(count(t, 'cpp:stream_write')).toBe(WRITES[id])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  it('只有 fuzz_2 有降級，而且是已知的陣列欄位', () => {
    const raws = (id: string) => all(lift(PROGS.find((p) => p.id === id)!.code)).filter((n) => n.componentId.endsWith('raw_code'))
    expect(raws('fuzz_1').length + raws('fuzz_3').length + raws('fuzz_4').length).toBe(0)
    expect(raws('fuzz_2').length).toBe(1)
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('%s：Cella 那側照實說翻不出（等 mbFriendDef）', async (_id, p) => {
    const r = await runCella(p.code) as { verdict: string; untranslated?: { reason: string }[] }
    expect(r.verdict).toBe('untranslated')
    expect((r.untranslated ?? []).length).toBeGreaterThan(0)
  })

  it('① 帶名字的巢狀型別留住名字；匿名成員的名字仍是空的', () => {
    const named = lift('class L { struct Node { int v; }; Node* h; };\nint main() { return 0; }')
    expect(all(named).filter((n) => n.componentId === 'cpp:struct_declare').map((n) => n.properties.name)).toEqual(['Node'])
    expect(generateCode(named, 'cpp', S)).toContain('struct Node {')
    const anon = lift('struct P { union { int a; char b; }; };\nint main() { return 0; }')
    expect(all(anon).filter((n) => n.componentId === 'cpp:union_declare').map((n) => n.properties.name)).toEqual([''])
  })

  it('③ 類別裡的 enum／class 宣告不多出欄位；匿名 enum 照實降級', () => {
    const e = lift('class L {\n  enum Color { RED };\npublic:\n  int f() { return RED; }\n};\nint main() { return 0; }')
    expect(count(e, 'cpp:enum')).toBe(1)
    expect(generateCode(e, 'cpp', S)).not.toMatch(/\}\s*x;/)
    const c = lift('class L {\n  class B { public: int x; };\n  B b;\n};\nint main() { return 0; }')
    expect(count(c, 'cpp:class_def')).toBe(2)
    expect(generateCode(c, 'cpp', S)).toContain('class B {')
    const anon = lift('class L {\n  enum { A };\n};\nint main() { return 0; }')
    expect(all(anon).filter((n) => n.componentId.endsWith('raw_code')).length).toBe(1)
  })

  it('② private 區宣告了型別時排在 public 前面；沒有型別時順序不變', () => {
    const gen = (c: string) => generateCode(lift(c), 'cpp', S)
    const withType = gen('class L {\n  struct Node { int v; };\npublic:\n  int f(Node* p) { return p->v; }\n};\nint main() { return 0; }')
    expect(withType).toContain('private:')
    expect(withType.indexOf('private:')).toBeLessThan(withType.indexOf('public:'))
    const withEnum = gen('class L {\n  enum Color { RED };\npublic:\n  Color c() { return RED; }\n};\nint main() { return 0; }')
    expect(withEnum.indexOf('private:')).toBeLessThan(withEnum.indexOf('public:'))
    const plain = gen('class L {\n  int x;\npublic:\n  int f() { return x; }\n};\nint main() { return 0; }')
    expect(plain).toContain('private:')
    expect(plain.indexOf('public:')).toBeLessThan(plain.indexOf('private:'))
  })
})
