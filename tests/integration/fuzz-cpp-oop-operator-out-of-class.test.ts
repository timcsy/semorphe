/**
 * **模糊測試：運算子的原型與類別外定義**（第 331 刀，元件管線的階段四）
 *
 * 八支程式由資訊隔離的出題者寫（不知道實作），期望輸出是 g++ -std=c++17 跑出來的：`tests/fixtures/fuzz-cpp-oop-operator-out-of-class.json`。
 * 運算子這一族（走「宣告方法／類別外定義方法」兩顆，名字 `operator⊕`）八支全部認得；判決那一側的狀態逐支釘住——
 * 修好的那天這裡會紅，提醒把那一支轉正。報告：`tests/reports/fuzz-cpp-operator-out-of-class-20261107.md`。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { runCella, expectCellaOut } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

interface Prog { id: string; code: string; expected: string }
const PROGS = JSON.parse(readFileSync('tests/fixtures/fuzz-cpp-oop-operator-out-of-class.json', 'utf8')) as Prog[]

const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const all = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) all(k, out)
  return out
}
const shape = (n: SemanticNode): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as SemanticNode[]).map(shape)])) })

/** 這一族之外、已知的降級（每一條都是另一刀） */
const ALLOWED_DEGRADE = [
  /類別裡的多維陣列欄位（或帶初值的陣列欄位）尚未支援/, // fuzz_3 的 `long long a[2][2]`
  /成員初始化列裡有多個引數或大括號串列/,               // fuzz_3／4 的 `: a{{…}}`、`: c{0, …}`——等 Cella 的 minit 收 Init
]

/**
 * 判決那一側的狀態——逐支釘住（原因變了或修好了都會紅）：
 * - accept：輸出要等於 g++
 * - unknown：只准是「實作相依」那幾種，而印出來的仍要等於 g++
 * - reject：都是 Cella 的誤判，已附最小重現回報（2026-11-07）——1526 修好之後已經沒有 reject
 * - untranslated：原因只准是登記過的缺口
 */
const VERDICT: Record<string, { verdict: 'accept' | 'unknown' | 'reject' | 'untranslated'; why?: RegExp }> = {
  // 🔴 2026-11-09：`for (size_t i = 0; …)` 原本被計數迴圈那顆接走、型別被我們改成 int——Cella 看到的是一支學生沒寫的程式（判 accept）。
  //    修好之後照實送 size_t：只引入 <iostream> 時「標頭有沒有宣告 size_t 取決於函式庫」——Cella 誠實的 unsupported（不是我們翻錯）
  fuzz_1: { verdict: 'unknown', why: /^unsupported$/ },
  // Cella ④ 轉換建構子的隱式轉換（h -= 3）在 1526 修好（原本誤判 reject）；剩下的是引數之間的求值次序——標準未指定，誠實的 unknown，印出來仍等於 g++
  // Cella 0.1.202611080134 轉 accept：函式庫呼叫的副作用改看引數實際寫到哪裡——原本的 orderUncompared 是把沒有衝突的兩個呼叫當成有衝突（輸出照樣等於 g++）
  fuzz_2: { verdict: 'unknown', why: /^unsupported$/ },   // 同 fuzz_1：size_t 的迴圈變數
  // 上面的降級（多維陣列欄位、`: a{{…}}`／`: c{0, 0, 0, 0, 0}`）——連帶：被降級的建構子定義讓類別裡那一行原型「找不到定義」
  fuzz_3: { verdict: 'untranslated', why: /這顆(類別成員|頂層元件)還沒有對應到 Cella 的建構子|類別裡宣告了建構子，而類別外找不到它的定義/ },
  fuzz_4: { verdict: 'untranslated', why: /這顆(類別成員|頂層元件)還沒有對應到 Cella 的建構子|類別裡宣告了建構子，而類別外找不到它的定義/ },
  fuzz_5: { verdict: 'unknown', why: /^ubElide$/ },                                        // 具名回傳值的複製省略——實作相依
  fuzz_6: { verdict: 'accept' },                                                           // Cella ② 多載 `<<` 串接的定序：1526 修好（C++17 起是定的）
  fuzz_7: { verdict: 'unknown', why: /^unsupported$/ },                                    // 同 fuzz_1：size_t 的迴圈變數（迭代器區間建構子 1526 修好那一項仍在）
  fuzz_8: { verdict: 'accept' },                                                           // 同 fuzz_2：Cella 0134 轉 accept
}

describe('模糊測試：運算子的類別外定義（第 331 刀）', () => {
  it('入口條件：八支都在、每一支都有預期輸出與判決釘子', () => {
    expect(PROGS).toHaveLength(8)
    for (const p of PROGS) {
      expect(p.expected.length, p.id).toBeGreaterThan(0)
      expect(VERDICT[p.id], p.id).toBeDefined()
    }
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('★ %s：運算子都認得（名字 operator⊕）、降級只有登記過的、再 lift 不漂移', (_id, p) => {
    const t = lift(p.code)
    const nodes = all(t)
    const ops = nodes.filter((n) => /^cpp:method_(declare|def_outside)$/.test(n.componentId) && String(n.properties.name).startsWith('operator'))
    expect(ops.length, '運算子的原型與定義').toBeGreaterThanOrEqual(20)
    const bad = nodes.filter((n) => /raw_code|unresolved/.test(n.componentId))
      .map((n) => String(n.metadata?.rawCode ?? '').split('\n')[0])
      .filter((why) => !ALLOWED_DEGRADE.some((re) => re.test(why)))
    expect(bad).toEqual([])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  it.each(PROGS.map((p) => [p.id, p] as const))('🟡 %s：判決的狀態與釘住的一致', async (_id, p) => {
    const want = VERDICT[p.id]
    const r = await runCella(p.code)
    expect(r.verdict, `${p.id} 的判決變了——看是修好了（轉正）還是換了一個問題`).toBe(want.verdict)
    // unsupported 停在半路，沒有完整的輸出可比；其餘的 unknown（實作相依、未指定的次序）跑完了，印出來的要等於 g++
    if (r.verdict === 'accept' || (r.verdict === 'unknown' && !r.problems.some((x) => x.kind === 'unsupported'))) expect(r.out, '印出來的要等於 g++').toBe(p.expected)
    if (r.verdict === 'unknown') expect(r.problems.map((x) => x.kind).every((k) => want.why!.test(k))).toBe(true)
    if (r.verdict === 'reject') expect(r.problems.map((x) => x.reason).join(' | ')).toMatch(want.why!)
    if (r.verdict === 'untranslated') expect(r.untranslated.every((u) => want.why!.test(u.reason))).toBe(true)
    // 🟠 逾時放寬是暫時的（2026-11-09）：cella 0954 起 fuzz_8 的判決從 10 秒變 100 秒（多載很多的類別＋sort；已回報）；修好之後拿掉這個數字
  }, 240_000)

  // ── 盲測掀出、這一刀修好的（各一支） ──
  it('🔴 修好：`const Vec k(5, 6);` 原本走一趟變 `const Vec k = 5;`，Cella 用預設參數補上第二個、印出別的值（fuzz_1、8）', async () => {
    const code = `#include <iostream>
using namespace std;
class V {
public:
    int x, y;
    V(int a = 0, int b = 0) : x(a), y(b) {
    }
};
int main() {
    const V k(5, 6);
    cout << k.x + k.y << endl;
    return 0;
}`
    expect(generateCode(lift(code), 'cpp', S)).toBe(code)
    await expectCellaOut(code, '11\n')
  })

  it('🔴 修好：成員初始化列的大括號串列原本只留第一個（`c{1, 2, 3}` 走一趟變 `c(1)`）——現在照實降級、原文一字不差（fuzz_4）', () => {
    const code = `#include <iostream>
using namespace std;
class P {
public:
    P() : c{1, 2, 3} {}
private:
    int c[3];
};
int main() {
    P p;
    return 0;
}`
    const t = lift(code)
    expect(all(t).some((n) => n.componentId === 'cpp:raw_code' && /成員初始化列裡有多個引數/.test(String(n.metadata?.rawCode ?? '')))).toBe(true)
    expect(generateCode(t, 'cpp', S)).toBe(code)
  })

  it('🔴 修好：`to_string` 原本沒有 formalize（fuzz_2、6、8 整支翻不出）', async () => {
    await expectCellaOut('#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s = to_string(42) + "!";\n    cout << s << endl;\n    return 0;\n}', '42!\n')
  })
})
