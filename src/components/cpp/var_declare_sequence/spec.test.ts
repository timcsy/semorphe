/**
 * `cpp:var_declare_sequence` 的**自證測**——人寫的，講這顆元件的**語義**
 *
 * ## 這顆元件推導不出來的那一條
 *
 * **它綁的是 N 個名字，而 N 是變動的。** 在它之前那一串名字被塞進同族
 * 自動型別宣告的 `name` 那一格，於是執行期真的宣告了一個叫 `[pt,d]` 的變數
 * ——**下一行用到 `pt` 時說「沒有宣告過這個名字」**。
 *
 * > **錯誤指著使用的那一行，而問題在宣告那一行。**
 *
 * ⚠️ 而那顆元件的 `name` 屬性上**早就寫著這件事**（「不保證是單一識別字……
 * 改成 `literal`」）——**把 `identifier` 放寬成 `literal` 是記下了症狀，不是修好它。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut, runCella, knownCellaGap } from '../../../../tests/helpers/cella-run'
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

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function ids(n: SemanticNode | null, out = new Set<string>()): Set<string> {
  if (!n) return out
  out.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}
function firstOf(n: SemanticNode | null, id: string): SemanticNode | null {
  if (!n) return null
  if (n.componentId === id) return n
  for (const kids of Object.values(n.slots ?? {})) {
    for (const k of kids as SemanticNode[]) { const r = firstOf(k, id); if (r) return r }
  }
  return null
}
// spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）
const run = (code: string, expected: string) => expectCellaOut(code, expected)

describe('cpp:var_declare_sequence 自證測', () => {
  // ── 後設檢查：這支測試真的碰到這顆元件了嗎 ──────────────
  it('★ 這顆元件真的出現在語義樹裡（不只是輸出字串對）', () => {
    expect(ids(lift(`${H}int main(){ vector<pair<int,int>> v; auto [a,b] = v[0]; }`)))
      .toContain('cpp:var_declare_sequence')
  })

  it('★ N 個名字真的是 N 個接點，不是一串文字', () => {
    // 🔴 這是這顆元件存在的全部理由。少了它，執行期會宣告一個叫 `[u,v,w]` 的變數。
    const node = firstOf(lift(`${H}int main(){ auto[u,v,w] = f(); }`), 'cpp:var_declare_sequence')
    expect(node, 'lift 失敗的話下一條會空過').not.toBeNull()
    expect((node!.slots.targets ?? []).map((t) => t.properties.name)).toEqual(['u', 'v', 'w'])
  })

  // ── 正向 ───────────────────────────────────────────────
  it('正向：來回轉換是不動點（而語料 15/16 處不寫空格）', () => {
    const src = `${H}int main(){ auto[pt,d] = q.front(); }`
    const out = generateCode(lift(src)!, 'cpp', style)
    expect(out).toContain('auto [pt, d] = q.front();')
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })

  it('正向：`auto&` 是一個參數，不是另一顆元件', () => {
    const node = firstOf(lift(`${H}int main(){ auto& [k,val] = *m.begin(); }`), 'cpp:var_declare_sequence')
    expect(node, 'lift 失敗的話下一條會空過').not.toBeNull()
    expect(node!.properties.binding).toBe('reference')
    expect(generateCode(lift(`${H}int main(){ auto& [k,val] = *m.begin(); }`)!, 'cpp', style))
      .toContain('auto& [k, val] = *m.begin();')
  })

  it('★ 語義：一對值按欄位順序拆', async () => {
    await run(`${H}int main(){ vector<pair<int,int>> v; v.push_back({3,4});`
      + ` auto[a,b] = v[0]; cout << a << b; }`, '34')
  })

  // 🟢 316 接上 tuple（Cella 0.1.202611061710）之後轉正：原本 formalize 回「型別 tuple<int,int,int> 還沒有對應」
  it('★ 語義：一串值按位置拆', async () => {
    await run(`${H}int main(){ vector<tuple<int,int,int>> v; v.push_back({1,2,3});`
      + ` auto[a,b,c] = v[0]; cout << a << b << c; }`, '123')
  })

  it('★ 語義：使用者自己的結構按【宣告順序】拆（語料 2 支）', async () => {
    await run(`${H}struct side{ int u; int v; int w; };`
      + `int main(){ vector<side> s; s.push_back({1,2,3}); auto[u,v,w] = s[0]; cout << u << v << w; }`, '123')
  })

  // ── 負向（不可省）────────────────────────────────────────
  it('負向：一個名字的 `auto` 宣告不得被認領', () => {
    const got = ids(lift(`${H}int main(){ auto x = v[0]; }`))
    expect(got, 'lift 失敗的話下一條會空過').toContain('cpp:var_declare_auto')
    expect(got).not.toContain('cpp:var_declare_sequence')
  })

  it('🔴 負向：格數對不上要出聲，不得補預設值', async () => {
    // `auto [a,b,c] = 一對` 在 C++ 是**編譯錯誤**——我們跑得到它，所以要停下來說明。
    // 換成 Cella 判決：編譯期就擋下（reject），不是跑到一半才停
    const r = await runCella(`${H}int main(){ vector<pair<int,int>> v; v.push_back({3,4}); auto[a,b,c] = v[0]; }`)
    expect(r.verdict).toBe('reject')
    expect(r.out).toBe('')
    expect(r.problems.map((p) => p.kind)).toEqual(['reject'])
    expect(r.problems[0].reason).toMatch(/decomposes into 2 elements, but 3 names/)
  })

  it('🔴 負向：拆不開的東西要出聲，不得安靜地綁一堆空名字', async () => {
    const r = await runCella(`${H}int main(){ int x = 5; auto[a,b] = x; }`)
    expect(r.verdict).toBe('reject')
    expect(r.out).toBe('')
    expect(r.problems.map((p) => p.kind)).toEqual(['reject'])
    expect(r.problems[0].reason).toMatch(/structured binding needs an array, a struct or a class/)
  })

  /**
   * 🟢 **這根釘子在換成 Cella 判決之後拔掉了**：原本是 `it.fails`，因為 JS 直譯器沒有
   * 「一個名字指著容器裡某一格」的機制（`auto& e = v[0]` 也寫不回去）。
   * Cella 有參考語義，真的 C++ 印 5（g++ 實測），Cella 判 accept 且印 5。
   */
  it('★ 語義：`auto&` 的寫入要回到容器裡', async () => {
    await run(`${H}int main(){ map<int,int> m; m[1] = 9; auto& [k,v] = *m.begin();`
      + ` v = 5; cout << m[1]; }`, '5')
  })
})
