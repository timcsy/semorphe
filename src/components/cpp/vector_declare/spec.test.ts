/**
 * `cpp:vector_declare` 的**自證測**——人寫的，講這顆元件的**語義**
 *
 * ## 這裡放什麼、不放什麼
 *
 * 共同測（五路齊備、符合性、來回轉換是不動點）**不放這裡**——它們從
 * `component.json` 推導，一份就夠。500 份長得一樣的共同測 = 複製了 500 份
 * 同一個真相，而且會漂移：改了協定，改不到的那幾份會安靜地繼續綠。
 *
 * 這裡放的是**推導不出來的**：`vector<int> v = f()` 必須是**複製**不是共用。
 *
 * ## 兩條機械後設檢查（膠囊契約 §三 Part 2）
 *
 * 1. **必須證明它真的碰到這顆元件**——語義樹裡出現 `cpp:vector_declare`，
 *    不只驗輸出字串。前例：五支「通過」是假的，被測的概念根本沒出現在樹裡
 *    （用 `static_cast` 代測 `dynamic_cast`），加上這條之後通過數 17 → 12。
 * 2. **強制正負兩向**。只有正向的話，一個過寬的實作會全綠——095 若沒有
 *    「`num >> 1` 必須仍是位移」那支負向，一條把所有位移都認領走的規則
 *    會通過全部測試。
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
  for (const kids of Object.values(n.children ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

async function run(code: string): Promise<string> {
  const tree = lift(code)
  const interp = new SemanticInterpreter()
  await interp.execute(tree!, [])
  return interp.getOutput().join('')
}

describe('cpp:vector_declare 自證測', () => {
  // ── 後設檢查：這支測試真的碰到這顆元件了嗎 ──────────────
  it('★ 這顆元件真的出現在語義樹裡（不只是輸出字串對）', () => {
    expect(ids(lift('int main() { vector<int> v; }'))).toContain('cpp:vector_declare')
  })

  // ── 正向 ───────────────────────────────────────────────
  it('正向：宣告 ＋ 初始化列表，來回轉換是不動點', () => {
    const src = 'int main() { vector<int> v = {3, 1, 4}; }'
    const out = generateCode(lift(src)!, 'cpp', style)
    expect(out).toContain('vector<int> v = {3, 1, 4};')
    // 不動點：把產出的碼再走一次，結果必須一樣
    expect(generateCode(lift(out)!, 'cpp', style)).toBe(out)
  })

  it('正向：型別是參數，不是身分——六種型別都是同一顆元件', () => {
    for (const t of ['int', 'double', 'char', 'long long']) {
      const tree = lift(`int main() { vector<${t}> v; }`)
      expect(ids(tree), `vector<${t}>`).toContain('cpp:vector_declare')
      expect(generateCode(tree!, 'cpp', style)).toContain(`vector<${t}> v;`)
    }
  })

  it('★ 語義：運算式初始值是**複製**不是共用（推導不出來的那一條）', async () => {
    // 這是這顆元件唯一真正的語義主張。`vector<int> b = a;` 之後改 b 不得動到 a。
    expect(
      await run(
        'int main() { vector<int> a = {1, 2}; vector<int> b = a; b.pop_back(); ' +
          'cout << a.size() << "," << b.size() << endl; }',
      ),
    ).toBe('2,1\n')
  })

  // ── 負向（不可省）────────────────────────────────────────
  it('負向：其他容器不得被認領成 vector', () => {
    for (const [code, shouldBe] of [
      ['stack<int> s;', 'cpp:stack_declare'],
      ['queue<int> q;', 'cpp:queue_declare'],
      ['set<int> s;', 'cpp:set_declare'],
      ['pair<int, int> p;', 'cpp:pair_declare'],
    ] as const) {
      const got = ids(lift(`int main() { ${code} }`))
      expect(got, `${code}：lift 失敗的話下一條會空過`).toContain(shouldBe)
      expect(got, `${code} 被誤認成 vector`).not.toContain('cpp:vector_declare')
    }
  })

  it('負向：固定長度陣列不是 vector', () => {
    const got = ids(lift('int main() { int a[3]; }'))
    // ⚠️ **先釘正向錨點。** 只寫 `not.toContain` 的話，`lift` 回傳 null
    // （集合是空的）也會通過——那是一支**空過**的測試，而它與健康的長得一樣。
    expect(got, 'lift 失敗的話這條會空過').toContain('cpp:array_declare')
    expect(got).not.toContain('cpp:vector_declare')
  })

  // ── 已知缺陷（有本體、被關掉，修好就能開回來）─────────────
  // ⚠️ 標題與 `() =>` **必須寫在同一行**——缺陷帳的掃描是逐行的
  // （`hasBody` 靠同一行有沒有 `=>` 判斷）。拆成多行它會**完全看不見**，
  // 而一筆看不見的缺陷與一筆不存在的缺陷在報表上長得一模一樣。
  it.skip('[BLOCKED:cpp:vector_declare] 初始值走得過積木投影（render → extract）', () => {
      // 🔴 **既有缺陷，2026-08-10 由 spec 104 的瀏覽器實測找到。**
      //
      //   ① lift 後 children:      ["values"]
      //   ② 直接產生:              "vector<int> v = {3, 1, 4};"
      //   ③ render 出的 block:     inputs: {}        ← 掉在這裡
      //   ④ extract 回來 children: []
      //   ⑤ 再產生:                "vector<int> v;"
      //
      // 在 `git worktree` 的 58d64eb（元件化動工前）跑同一支探針，
      // **輸出逐字相同**——不是搬家造成的。
      //
      // **根因是符合性**：`component.json` 宣告了 `values`／`source` 兩個接點，
      // 而積木形態的 `args0` 只有 `TYPE`／`NAME` 兩個 **field**，一個 input 都沒有。
      // 積木**在結構上表達不出**一個帶初始值的 vector。
      //
      // ⚠️ **使用者看得到**：任何一次工作區重新序列化（切語言、切風格、
      // 存檔重載）都會走 render→extract，於是 `= {3,1,4}` 靜靜地消失。
      //
      // **修法不是一行**：`values` 是變長列表（`min: 0`，無上限），
      // 要像 `cpp_print` 那樣做成帶 ＋／− 的動態積木；`source` 是單一運算式，
      // 可以用 `input_value`。兩者是不同的形狀，要分開處理。
      //
      // 同一個缺陷 generate 與 execute 兩路**都修過並留下註解**，
      // render／extract 沒有——**五路裡修了三路，剩下兩路沒有人回頭掃。**
    expect(true).toBe(false)
  })

  it('負向：`vector` 只是變數名時不算宣告', () => {
    const got = ids(lift('int main() { int vector = 3; }'))
    expect(got, 'lift 失敗的話這條會空過').toContain('cpp:var_declare')
    expect(got).not.toContain('cpp:vector_declare')
  })
})
