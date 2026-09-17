/**
 * `cpp:deque_declare` 的**自證測**——人寫的，講這顆元件的**語義**
 *
 * ## 這顆元件推導不出來的那一條
 *
 * **它記得住元素型別。** 在此之前 `deque` 沒有主人，於是
 * `deque<pair<int,int>> q;` 掉進一般的變數宣告，`type` 裝著一整串
 * `deque<pair<int,int>>`——那個容器因此沒有 `elemType`，
 * 而 `q.push_back({1,2})` 放進去的是一串普通的格子，`q[0].first`
 * 說「（不是一個結構）」。
 *
 * > **一個容器如果不知道自己裝什麼，`{1,2}` 就只能變成「兩個數字」
 * > ——而那在畫面上與「一對」長得一模一樣。**
 *
 * ⚠️ 兩條機械後設檢查（膠囊契約 §三 Part 2）：證明真的碰到這顆元件、正負兩向。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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

function ids(n: SemanticNode | null, out = new Set<string>()): Set<string> {
  if (!n) return out
  out.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

async function run(code: string): Promise<string> {
  const interp = new SemanticInterpreter()
  await interp.execute(lift(code)!, [])
  return interp.getOutput().join('')
}

describe('cpp:deque_declare 自證測', () => {
  // ── 後設檢查：這支測試真的碰到這顆元件了嗎 ──────────────
  it('★ 這顆元件真的出現在語義樹裡（不只是輸出字串對）', () => {
    expect(ids(lift('int main() { deque<int> d; }'))).toContain('cpp:deque_declare')
  })

  // ── 正向 ───────────────────────────────────────────────
  it('正向：宣告 ＋ 初始化列表，來回轉換是不動點', () => {
    const src = 'int main() { deque<int> d = {3, 1, 4}; }'
    const out = generateCode(lift(src)!, 'cpp', style)
    expect(out).toContain('deque<int> d = {3, 1, 4};')
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })

  it('正向：型別是參數，不是身分', () => {
    for (const t of ['int', 'double', 'char', 'long long']) {
      const tree = lift(`int main() { deque<${t}> d; }`)
      expect(ids(tree), `deque<${t}>`).toContain('cpp:deque_declare')
      expect(generateCode(tree!, 'cpp', style)).toContain(`deque<${t}> d;`)
    }
  })

  it('正向：建構子引數 `deque<int> d(3)` 產得回去，而且真的有三格', async () => {
    const src = 'int main() { deque<int> d(3); cout << d.size() << d[0]; }'
    expect(generateCode(lift(src)!, 'cpp', style)).toContain('deque<int> d(3);')
    expect(await run(src)).toBe('30')
  })

  it('★ 語義：它記得住元素型別（推導不出來的那一條）', async () => {
    // 🔴 沒有這顆元件的話 `{1,2}` 只是「兩個數字」，而 `.first` 說「不是一個結構」
    expect(await run(
      'int main() { deque<pair<int,int>> q; q.push_back({1,2}); cout << q[0].first << q.front().second; }',
    )).toBe('12')
  })

  it('★ 語義：運算式初始值是**複製**不是共用', async () => {
    expect(await run(
      'int main() { deque<int> a = {1, 2}; deque<int> b = a; b.pop_back(); cout << a.size() << b.size(); }',
    )).toBe('21')
  })

  // ── 負向（不可省）────────────────────────────────────────
  it('負向：其他容器不得被認領成雙端佇列', () => {
    for (const [code, shouldBe] of [
      ['vector<int> v;', 'cpp:vector_declare'],
      ['queue<int> q;', 'cpp:queue_declare'],
      ['stack<int> s;', 'cpp:stack_declare'],
      ['set<int> s;', 'cpp:set_declare'],
    ] as const) {
      const got = ids(lift(`int main() { ${code} }`))
      expect(got, `${code}：lift 失敗的話下一條會空過`).toContain(shouldBe)
      expect(got, `${code} 被誤認成雙端佇列`).not.toContain('cpp:deque_declare')
    }
  })

  it('負向：兩端的進出不是宣告的事——那兩顆元件仍然各自在', () => {
    const got = ids(lift('int main() { deque<int> d; d.push_front(1); d.pop_front(); }'))
    expect(got, '正向錨點：宣告要先被認出來').toContain('cpp:deque_declare')
    expect(got).toContain('cpp:container_push_front')
    expect(got).toContain('cpp:container_pop_front')
  })
})
