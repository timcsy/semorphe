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
async function run(code: string): Promise<string> {
  const interp = new SemanticInterpreter()
  await interp.execute(lift(code)!, [])
  return interp.getOutput().join('')
}

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

  it('★ 語義：一對值按欄位順序拆，一串值按位置拆', async () => {
    expect(await run(`${H}int main(){ vector<pair<int,int>> v; v.push_back({3,4});`
      + ` auto[a,b] = v[0]; cout << a << b; }`)).toBe('34')
    expect(await run(`${H}int main(){ vector<tuple<int,int,int>> v; v.push_back({1,2,3});`
      + ` auto[a,b,c] = v[0]; cout << a << b << c; }`)).toBe('123')
  })

  it('★ 語義：使用者自己的結構按【宣告順序】拆（語料 2 支）', async () => {
    expect(await run(`${H}struct side{ int u; int v; int w; };`
      + `int main(){ vector<side> s; s.push_back({1,2,3}); auto[u,v,w] = s[0]; cout << u << v << w; }`))
      .toBe('123')
  })

  // ── 負向（不可省）────────────────────────────────────────
  it('負向：一個名字的 `auto` 宣告不得被認領', () => {
    const got = ids(lift(`${H}int main(){ auto x = v[0]; }`))
    expect(got, 'lift 失敗的話下一條會空過').toContain('cpp:var_declare_auto')
    expect(got).not.toContain('cpp:var_declare_sequence')
  })

  it('🔴 負向：格數對不上要出聲，不得補預設值', async () => {
    // `auto [a,b,c] = 一對` 在 C++ 是**編譯錯誤**——我們跑得到它，所以要停下來說明。
    await expect(run(`${H}int main(){ vector<pair<int,int>> v; v.push_back({3,4}); auto[a,b,c] = v[0]; }`))
      .rejects.toThrow(/要拆成 3 格，而右邊有 2 格/)
  })

  it('🔴 負向：拆不開的東西要出聲，不得安靜地綁一堆空名字', async () => {
    await expect(run(`${H}int main(){ int x = 5; auto[a,b] = x; }`))
      .rejects.toThrow(/拆不開/)
  })

  /**
   * 🟠 **還開著的一根釘子**——用 `it.fails` 不用 `it.todo`（修好的那天會紅，逼人來拔）。
   *
   * 🔴 **為什麼不現在修**：`auto& [k, v]` 要能寫回容器裡那一格，前提是
   * 「**一個名字可以指著容器裡的某一格**」——而那個機制今天不存在：
   * 同族只有一個名字的 `auto& e = v[0];` **一樣寫不回去**（實測），
   * 連 `for (auto& e : v) e *= 2;` 也是安靜地不生效。
   * 所以這不是這顆元件的缺陷，是**模型還沒長到那裡**。
   *
   * ⚠️ 而語料量到 `auto&` 的結構化繫結是 **0 處**。
   * 🔴 何時該修：`auto& e = v[0]` 被支援的那一天，或盲測／使用者的程式
   *    出現「透過參考繫結寫回容器」的寫法——**第二個獨立來源就夠了**。
   */
  it.fails('[UNSUPPORTED:一個名字指著容器裡某一格（參考繫結）] `auto&` 的寫入要回到容器裡', async () => {
    expect(await run(`${H}int main(){ map<int,int> m; m[1] = 9; auto& [k,v] = *m.begin();`
      + ` v = 5; cout << m[1]; }`)).toBe('5')
  })
})
