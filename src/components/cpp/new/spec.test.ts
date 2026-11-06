/**
 * `cpp:new` 的**自證測**——推導不出來的語義（共同測從 `component.json` 推導，不放這裡）
 *
 * 2026-11-07（328）：`new T(a, b)`／`new Node{v, head}` 的引數從**文字屬性**升格成**運算式槽**。
 * 原本那串文字讓 formalize 只能照實回 unknown（不從文字猜結構），兩輪盲測七支卡在這裡
 * （`knowledge/draft/2026-11-07-類別外定義之後的缺口.md`）。
 *
 * 後設檢查兩條：① 樹裡真的有 `cpp:new`，而且引數是**槽裡的節點**（不是一串文字）；② 正負兩向。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function find(n: SemanticNode | null, id: string, out: SemanticNode[] = []): SemanticNode[] {
  if (!n) return out
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) find(k, id, out)
  return out
}

const HEAD = '#include <bits/stdc++.h>\nusing namespace std;\n'
const run = (code: string, expected: string) => expectCellaOut(HEAD + code, expected)
const gen = (code: string): string => generateCode(lift(code)!, 'cpp', style)

describe('cpp:new 自證測', () => {
  it('lift：建構引數是運算式槽，不是一串文字', () => {
    const news = find(lift('struct P { int x, y; P(int a, int b) : x(a), y(b) {} };\nint main() { int k = 2; P* p = new P(k + 1, 4); }'), 'cpp:new')
    expect(news.length, '樹裡要有 cpp:new').toBe(1)
    const args = news[0].slots.args as SemanticNode[]
    expect(args.length).toBe(2)
    expect(args[0].componentId, '第一個引數是一個運算式節點').not.toBe('cpp:raw_code')
    expect(news[0].properties.args, '文字屬性 args 已經退場').toBeUndefined()
  })

  it('lift：大括號初始化的引數也是槽，記著括號的種類', () => {
    const news = find(lift('struct Node { int v; Node* next; };\nint main() { Node* h = nullptr; h = new Node{3, h}; }'), 'cpp:new')
    expect(news.length).toBe(1)
    expect((news[0].slots.args as SemanticNode[]).length).toBe(2)
    expect(news[0].properties.brace).toBe('true')
  })

  it('負向：沒有引數的 new 沒有 args 槽；空括號仍記成值初始化', () => {
    const [plain] = find(lift('int main() { int* p = new int; }'), 'cpp:new')
    const [valued] = find(lift('int main() { int* p = new int(); }'), 'cpp:new')
    expect(plain.slots.args ?? []).toHaveLength(0)
    expect(plain.properties.valueInit).toBeUndefined()
    expect(valued.slots.args ?? []).toHaveLength(0)
    expect(valued.properties.valueInit).toBe('true')
  })

  it('產碼一字不差：小括號、大括號、空括號、陣列', () => {
    for (const e of ['new P(k + 1, 4)', 'new Node{3, h}', 'new int()', 'new int', 'new int[n]', 'new Node{}']) {
      const code = `int main() {\n    auto q = ${e};\n    return 0;\n}\n`
      expect(gen(code), e).toContain(e)
    }
  })

  it('來回不漂移：產出的程式碼再 lift 一次，引數槽相同', () => {
    const code = 'struct P { int x, y; P(int a, int b) : x(a), y(b) {} };\nint main() { int k = 2; P* p = new P(k * 2, k); return 0; }'
    const once = find(lift(code), 'cpp:new')[0]
    const twice = find(lift(gen(code)), 'cpp:new')[0]
    expect((twice.slots.args as SemanticNode[]).map(a => a.componentId)).toEqual((once.slots.args as SemanticNode[]).map(a => a.componentId))
  })

  it('執行：建構子拿到的引數是算出來的值', async () => {
    await run('struct P { int x, y; P(int a, int b) : x(a), y(b) {} };\nint main() { int k = 2; P* p = new P(k + 1, k * 5); cout << p->x << " " << p->y; delete p; return 0; }', '3 10')
  })

  // 🟡 聚合體的 `new Node{…}`：Cella 的 eNew 對沒有自訂建構子的類別判 ubUninit（`new Node()`、`new Node(n)` 也是），
  //    所以 formalize 先照實回 unknown、已附最小重現回報 Cella；修好那天這支會紅——拿掉 knownCellaGap
  it('執行：聚合體的大括號初始化（鏈結串列）——等 Cella', async () => {
    await knownCellaGap(/聚合體/, () => run('struct Node { int v; Node* next; };\nint main() { Node* h = nullptr; for (int i = 1; i <= 3; i++) h = new Node{i, h}; for (Node* p = h; p; p = p->next) cout << p->v; return 0; }', '321'))
  })

  it('執行：有建構子的類別用大括號帶引數（new P{5}）——同樣先回 unknown（formalize 分不出聚合體）', async () => {
    await knownCellaGap(/聚合體/, () => run('struct P { int v; P(int a) : v(a) {} };\nint main() { P* h = new P{5}; cout << h->v; delete h; return 0; }', '5'))
  })

  it('執行：純量的建構引數（new int(7)）', async () => {
    await run('int main() { int* p = new int(7); cout << *p; delete p; return 0; }', '7')
  })
})
