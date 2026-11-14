/**
 * **C++ → Python 沒有失真**——跨語言互轉第二對的驗收（spec 219）。
 *
 * ```
 * C++ 原文 ──lift──▶ 語意樹 ──convertCppToPython（型別由 Cella 給）──▶ Python 原始碼
 *   └──────────── Cella（lang cpp）                                  Cella（lang python）──┘
 *                              判決、輸出、assumes 相同
 * ```
 *
 * 整支換或不換（契約 C1）：課文的每一支解答不是「換過去且判決相同」就是「保留且附原因」——沒有第三種。
 * ⚠️ 正向錨點：「換過去」那一份要夠多（SC-001：至少一半），否則「全部保留」也會是綠的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { convertCppToPython } from '../../src/languages/cpp/cpp-to-python'
import { runCella, cellaTypesOfTree, knownCellaGap } from '../helpers/cella-run'
import type { SemanticNode } from '../../src/core/types'
import { liftPython, componentIdsOf, generatePython } from '../helpers/python-lift'

let parser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

async function toPython(src: string, stdin = ''): Promise<ReturnType<typeof convertCppToPython>> {
  const tree = lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
  // 同產品：型別與判決的問題都來自同一次判決（溢位那一類要換法知道，T017）
  const v = await runCella(src, { lang: 'cpp', stdin })
  return convertCppToPython(tree, await cellaTypesOfTree(tree, { lang: 'cpp' }), (v.problems ?? []).map((p) => ({ kind: p.kind, at: p.at })))
}

async function sameVerdict(src: string, py: string, stdin: string): Promise<void> {
  const a = await runCella(src, { lang: 'cpp', stdin })
  const b = await runCella(py, { lang: 'python', stdin })
  const show = `\n--- Python ---\n${py}--- C++: ${a.verdict} ${JSON.stringify(a.out)} / Python: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}`
  expect(a.verdict, `C++ 那一側本身就不是 accept${show}`).toBe('accept')
  expect(b.verdict, show).toBe(a.verdict)
  expect(b.out, show).toBe(a.out)
  expect(b.assumes ?? [], `${show}\nassumes：C++ ${JSON.stringify(a.assumes ?? [])} / Python ${JSON.stringify(b.assumes ?? [])}`).toEqual(a.assumes ?? [])
}

const filesOf = (track: string): string[] => fs.readdirSync(`lessons/${track}`, { recursive: true }).map(String)
  .filter((f) => f.endsWith('.cpp') && f.includes('/solutions/')).sort().map((f) => `lessons/${track}/${f}`)

const stdinOf = (f: string): string => {
  const lesson = JSON.parse(fs.readFileSync(f.replace(/solutions\/.*/, 'lesson.json'), 'utf8'))
  const task = lesson.tasks.find((t: { id: string }) => t.id === path.basename(f, '.cpp').split('~')[0])
  return ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
}

/**
 * cpp-advanced 的解答不寫標頭（產品替學生補）——這裡補上它用到的那幾個（不用 `<bits/stdc++.h>`：Cella 會多帶 header.contents 的假設）
 */
const withHeaders = (src: string): string => src.includes('#include') ? src
  : '#include <iostream>\n#include <vector>\n#include <algorithm>\n#include <map>\n#include <set>\nusing namespace std;\n\n' + src

/** Cella 的 Python 家族少帶 libm 的假設（sqrt）——修好時這幾支會紅 */
const KNOWN_ASSUMES_GAP = new Set(['06-算一算/solutions/rebuild.cpp'])

/**
 * 一門課一組（447 加 cpp-advanced）。`minConverted`：換過去的下限——cpp-beginner 是 SC-001 的「至少一半」，
 * cpp-advanced 是棘輪（容器、指標、struct 還沒有 Python 的寫法，只准上升）
 */
function lessonSuite(track: string, minFiles: number, minConverted: (total: number) => number): void {
  const files = filesOf(track)
  describe(`C++ → Python：${track} 課文的解答`, () => {
    const tally = { converted: [] as string[], kept: new Map<string, string[]>() }

    it('入口：讀到了課文的 C++ 解答', () => {
      expect(files.length).toBeGreaterThanOrEqual(minFiles)
    })

    for (const f of files) {
      const rel = f.replace(`lessons/${track}/`, '')
      it(rel, async () => {
        const src = withHeaders(fs.readFileSync(f, 'utf8'))
        const r = await toPython(src, stdinOf(f))
        if (r.code === null) {
          // 保留：每一筆都要有原因類別與說明（不是無原因的失敗）
          expect(r.reasons.length).toBeGreaterThan(0)
          for (const x of r.reasons) expect(x.detail.length, JSON.stringify(x)).toBeGreaterThan(0)
          for (const x of r.reasons) tally.kept.set(x.kind, [...(tally.kept.get(x.kind) ?? []), path.basename(path.dirname(path.dirname(f)))])
          return
        }
        tally.converted.push(f)
        // 🟠 Cella 那側的不一致（2026-11-09 回報）：C++ 的 sqrt 判決帶 assumes math.correctlyRounded（libm）、Python 的 math.sqrt 沒帶——
        //    CPython 的 math.sqrt 同樣是 C 函式庫的薄包裝，兩邊應該帶同一個假設。這一支之前因為 % 被保留，沒走到這裡（spec 224 換過去之後露出來）
        if (track === 'cpp-beginner' && KNOWN_ASSUMES_GAP.has(rel)) await knownCellaGap(/correctlyRounded/, () => sameVerdict(src, r.code!, stdinOf(f)))
        else await sameVerdict(src, r.code, stdinOf(f))
        // SC-005／research R7 的第二道檢查：換出來的碼由 Python 自己的 lift 認得乾淨（沒有照原文），產碼回來同一支程式
        const back = await liftPython(r.code)
        expect(componentIdsOf(back).filter((c) => /raw|unresolved/.test(c)), `Python 的 lift 認不出來：\n${r.code}`).toEqual([])
        expect(generatePython(back).trimEnd(), `走一趟 Python 積木回來不一樣：\n${r.code}`).toBe(r.code.trimEnd())
      }, 180_000) // 冷算判決：cpp-advanced 02-排序 ex1 的 C++ 那一側在負載 37–52 下 72–80 秒（Cella 的 sort 慢，cella 排在 11-14 晚那輪修；修好後收回 60 秒）
    }

    it('★ 報表與門檻：換過去的不少於下限；兩份加起來等於解答總數', () => {
      const kept = files.length - tally.converted.length
      console.log(`C++ → Python（${track}）：換過去 ${tally.converted.length} 支／保留 ${kept} 支｜原因分佈 ${[...tally.kept].map(([k, v]) => `${k}:${v.length}`).join(' ')}`)
      expect(tally.converted.length, '換過去的少於下限').toBeGreaterThanOrEqual(minConverted(files.length))
    })
  })
}

lessonSuite('cpp-beginner', 60, (n) => Math.ceil(n / 2))
lessonSuite('cpp-advanced', 20, () => 9)

// ── US2／SC-003：意思會變的地方照實保留（或換成意思相同的寫法，由判決證明）──
describe('C++ → Python：意思會變的反例', () => {
  const H = '#include <iostream>\nusing namespace std;\n'
  it('🟢 接收者的括號：相加的結果再取字元，括號不能掉；判決相同（372 同類）', async () => {
    const src = H + '#include <string>\nint main() {\n    string s = "ab";\n    string t = "cd";\n    cout << (s + t)[2] << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code).not.toBeNull()
    expect(r.code).toContain('(s + t)[2]')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 負數的整數除法：換成 int(a / b)（向零截斷，同 C++）、不是 //；判決相同', async () => {
    const src = H + 'int main() {\n    int a = -7, b = 2;\n    cout << a / b << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code).toContain('int(a / b)')
    expect(r.code).not.toContain('//')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 取餘數的一般用法：照 C++ 的定義換成 a - int(a / b) * b（向零截斷、正負號跟被除數）、不是 %；判決相同（spec 224）', async () => {
    // 巢狀在別的運算裡（`a % b * 3`）要有括號——由外層的 paren() 加
    const src = H + 'int main() {\n    int a = -7, b = 2;\n    int c = 17;\n    c %= -5;\n    cout << a % b << " " << 7 % -2 << " " << c << " " << a % b * 3 << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code).toContain('a - int(a / b) * b')
    expect(r.code).toContain('c = c - int(c / -5) * -5')
    expect(r.code).not.toMatch(/[^"]%[^"]/)
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 取餘數的兩邊有運算式：小函式 trunc_mod，每邊只算一次；判決相同（381）', async () => {
    const src = H + 'int bump(int& x) {\n    x = x + 1;\n    return x;\n}\nint main() {\n    int a = -7;\n    int n = 0;\n    cout << (a + 1) % 4 << " " << bump(n) % 5 << " " << n << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    if (r.code === null) { expect(r.reasons.length).toBeGreaterThan(0); return }  // 參考參數換不過去時照實保留
    expect(r.code).toContain('trunc_mod(a + 1, 4)')
    await sameVerdict(src, r.code, '')
  }, 60_000)
  it('🟢 main 中途結束：raise SystemExit，後面的不跑；判決相同（381）', async () => {
    const src = H + 'int main() {\n    int a = 1;\n    if (a > 0) {\n        cout << "x" << endl;\n        return 0;\n    }\n    cout << "y" << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).toContain('raise SystemExit')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  for (const [name, body, kind] of [
    // 64 位元的整數：456 起改用整數運算的小函式 trunc_div／trunc_mod64（見下面 456 那一段）；無號的照舊保留
    ['無號整數的取餘數', '    unsigned long long a = 7, b = 2;\n    cout << a % b << endl;\n', 'modulo'],
    // `<<`：C++ 溢位會繞回（C++20）或未定義，Python 的整數不會溢位（456）
    ['左移', '    int a = 3;\n    cout << (a << 2) << endl;\n', 'outside-subset'],
    ['無號整數的位元運算（與負數混用時 C++ 先轉成無號）', '    unsigned int a = 6;\n    int b = -1;\n    cout << (a & b) << endl;\n', 'outside-subset'],
    // `i++` 這個運算式在 Python 沒有對應——不因為取餘數改用小函式就放行
    ['取餘數的一邊是 i++', '    int i = 7;\n    cout << i++ % 3 << " " << i << endl;\n', 'outside-subset'],
    ['main 中途 return 非零', '    int a = 1;\n    if (a > 0) {\n        return 1;\n    }\n    cout << a << endl;\n', 'outside-subset'],
    ['二維陣列的初值沒寫滿', '    int g[2][2] = {{1}, {2, 3}};\n    cout << g[0][1] << endl;\n', 'outside-subset'],
    // `s[0] = 'z'` 由「陣列元素指定」那顆接——365 接上它的 Python 寫法時差點把這一支換過去（這支反例抓到）
    ['改字串裡的一個字元（Python 的字串不能改）', '    string s = "abc";\n    s[0] = \'z\';\n    cout << s << endl;\n', 'char'],
    ['char 的 ++（Python 的字串不能加 1）', '    char c = \'a\';\n    c++;\n    cout << c << endl;\n', 'char'],
    ['指標', '    int x = 3;\n    int* p = &x;\n    cout << *p << endl;\n', 'outside-subset'],
    ['無號整數的除法（`sum / v.size()`，負數時 C++ 會繞回）', '    vector<int> v;\n    v.push_back(-4);\n    int s = -4;\n    cout << s / v.size() << endl;\n', 'division'],
  ] as const) {
    it(`🔴 保留：${name}`, async () => {
      const r = await toPython(`${H}int main() {\n${body}    return 0;\n}\n`)
      expect(r.code, '換了——意思會變').toBeNull()
      expect(r.reasons.map((x) => x.kind)).toContain(kind)
    }, 60_000)
  }
  it('🟢 char 參與運算 → ord()；整數放進 char 變數 → chr()；char 照印（364）；判決相同', async () => {
    const src = H + 'int main() {\n    string s = "b";\n    char c = \'a\';\n    char d = c + 2;\n    cout << s[0] - \'a\' << " " << c << d << endl;\n    if (d > \'b\') {\n        cout << "late" << endl;\n    }\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code).toContain('ord(s[0]) - ord("a")')
    expect(r.code).toContain('d = chr(ord(c) + 2)')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 `n % 2 == 0`：與 0 比較時正負號不影響 ⟹ 換；判決相同', async () => {
    const src = H + 'int main() {\n    int n = -4;\n    if (n % 2 == 0) {\n        cout << "even" << endl;\n    }\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  // ── 447：vector 的複製與共用 ──
  const V = '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n'
  for (const [name, code, must] of [
    // 之前換出來是 `b = a`：Python 的 b 與 a 是同一個 list，改 b 會改到 a（C++ 印 1、Python 印 5）——靜默失真
    ['vector 的指定是複製：`b = a` 之後改 b 不影響 a', 'int main() {\n    vector<int> a = {1, 2};\n    vector<int> b;\n    b = a;\n    b[0] = 5;\n    cout << a[0] << endl;\n    return 0;\n}\n', 'b = list(a)'],
    ['用另一個 vector 初始化也是複製', 'int main() {\n    vector<int> a = {1, 2};\n    vector<int> b = a;\n    b[0] = 5;\n    cout << a[0] << b[0] << endl;\n    return 0;\n}\n', 'b = list(a)'],
    ['參照參數：改元素、push_back 都改到呼叫端那一個（Python 的 list 本來就是同一個）', 'void f(vector<int>& a) {\n    a[0] = 9;\n    a.push_back(3);\n}\n\nint main() {\n    vector<int> a = {1, 2};\n    f(a);\n    cout << a[0] << a.size() << endl;\n    return 0;\n}\n', 'def f(a):'],
    ['const 參照參數', 'int g(const vector<int>& a) {\n    return a[1];\n}\n\nint main() {\n    vector<int> a = {1, 2};\n    cout << g(a) << endl;\n    return 0;\n}\n', 'def g(a):'],
    ['二維：推進去的是複製的一份，之後改來源不影響', 'int main() {\n    vector<int> r = {1};\n    vector<vector<int>> g;\n    g.push_back(r);\n    r[0] = 7;\n    cout << g[0][0] << endl;\n    return 0;\n}\n', 'g.append(list(r))'],
    ['二維：給個數時每一格是各自的 list', 'int main() {\n    vector<vector<int>> g(3);\n    g[0].push_back(4);\n    cout << g[1].size() << g[0].size() << endl;\n    return 0;\n}\n', 'for _ in range(3)'],
    ['以值走訪二維：每一圈拿到的是複製的一份', 'int main() {\n    vector<vector<int>> g(2);\n    g[0].push_back(1);\n    for (vector<int> row : g) {\n        row.push_back(9);\n    }\n    cout << g[0].size() << endl;\n    return 0;\n}\n', 'row = list(row)'],
    // 相等、-0.0、NaN：兩邊都回傳第一個（只在後者嚴格較大／較小時換）
    ['max／min（相等、-0.0 時回傳同一個）', 'int main() {\n    double z = -0.0;\n    cout << max(z, 0.0) << " " << min(0.0, z) << " " << max(3, 7) << min(3, 7) << endl;\n    return 0;\n}\n', 'max(z, 0.0)'],
  ] as const) {
    it(`🟢 ${name}；判決相同（447）`, async () => {
      const src = V + code
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code).toContain(must)
      await sameVerdict(src, r.code!, '')
    }, 60_000)
  }
  for (const [name, code] of [
    // C++ 的 `a = c` 把 c 複製進呼叫端那一個；Python 的 `a = …` 只換掉函式裡的名字
    ['參照參數在函式裡被整個重新指定', 'void f(vector<int>& a) {\n    vector<int> c = {7};\n    a = c;\n}\n\nint main() {\n    vector<int> a = {1, 2};\n    f(a);\n    cout << a[0] << endl;\n    return 0;\n}\n'],
    // 傳值會複製一份：函式裡改它不影響呼叫端
    ['vector 傳值（不是 const）', 'void f(vector<int> a) {\n    a[0] = 9;\n}\n\nint main() {\n    vector<int> a = {1, 2};\n    f(a);\n    cout << a[0] << endl;\n    return 0;\n}\n'],
  ] as const) {
    it(`🔴 保留：${name}（447）`, async () => {
      const r = await toPython(V + code)
      expect(r.code, '換了——意思會變').toBeNull()
      expect(r.reasons.map((x) => x.detail).join()).toContain('傳遞方式')
    }, 60_000)
  }
  // ── 448：stack、empty、`**` 的括號 ──
  const S = '#include <iostream>\n#include <cmath>\n#include <vector>\n#include <stack>\n#include <queue>\nusing namespace std;\n'
  for (const [name, code, must] of [
    ['stack → list：push／pop／top／size／empty', 'int main() {\n    stack<int> s;\n    s.push(1);\n    s.push(-2);\n    cout << s.top() << s.size() << s.empty() << endl;\n    s.pop();\n    if (!s.empty()) cout << s.top() << endl;\n    return 0;\n}\n', 's[-1]'],
    ['empty 也收 string 與 vector', 'int main() {\n    string t = "";\n    vector<int> v;\n    v.push_back(3);\n    cout << t.empty() << v.empty() << endl;\n    return 0;\n}\n', 'len(t) == 0'],
    ['stack 的指定是複製', 'int main() {\n    stack<int> s;\n    s.push(1);\n    stack<int> t;\n    t = s;\n    t.push(5);\n    cout << s.size() << t.size() << endl;\n    return 0;\n}\n', 't = list(s)'],
    // 之前 `pow(-2, 2)` 換成 `-2 ** 2`：`**` 比一元負號綁得緊，C++ 印 4、Python 印 -4——靜默失真
    ['pow 的底數是負數或運算式時加括號', 'int main() {\n    int a = -2;\n    cout << pow(-2, 2) << " " << pow(a, 2) << " " << pow(a + 1, 2) << endl;\n    return 0;\n}\n', '(-2) ** 2'],
  ] as const) {
    it(`🟢 ${name}；判決相同（448）`, async () => {
      const src = S + code
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code).toContain(must)
      // pow 那一條：C++ 的 pow 帶 libm 的 correctlyRounded、Python 的 ** 不帶（同 KNOWN_ASSUMES_GAP，已回報 cella）——只比判決與輸出
      if (code.includes('pow(')) {
        const a = await runCella(src, { lang: 'cpp' }), b = await runCella(r.code!, { lang: 'python' })
        expect([b.verdict, b.out]).toEqual([a.verdict, a.out])
      } else await sameVerdict(src, r.code!, '')
    }, 60_000)
  }
  for (const [name, code, detail] of [
    ['stack 傳值（複製一份）', 'void f(stack<int> s) {\n    s.push(9);\n}\n\nint main() {\n    stack<int> s;\n    f(s);\n    cout << s.size() << endl;\n    return 0;\n}\n', '傳遞方式'],
    // ⏳ 寫法已經寫好（collections.deque／heapq，最大堆存負數）；Cella 的 Python 支援這兩個模組之前照實保留——發版後這兩條改成換過去
    ['queue（等 Cella 支援 collections.deque）', 'int main() {\n    queue<int> q;\n    q.push(3);\n    cout << q.front() << endl;\n    return 0;\n}\n', 'collections.deque'],
    ['priority_queue（等 Cella 支援 heapq）', 'int main() {\n    priority_queue<int> q;\n    q.push(-3);\n    cout << q.top() << endl;\n    return 0;\n}\n', 'heapq'],
  ] as const) {
    it(`🔴 保留：${name}（448）`, async () => {
      const r = await toPython(S + code)
      expect(r.code, '換了').toBeNull()
      expect(r.reasons.map((x) => x.detail).join()).toContain(detail)
    }, 60_000)
  }
  // ── 450：有序的 map／set、pair 的成員、浮點加進整數的截斷 ──
  const K = '#include <iostream>\n#include <map>\n#include <set>\n#include <string>\nusing namespace std;\n'
  for (const [name, code, must] of [
    // m[k] 讀一個沒有的鍵：C++ 先補上預設值（之後走訪看得到）⟹ setdefault；先讀再改（++、+=）先補一句 setdefault；走訪照鍵排序 ⟹ sorted
    ['map → dict：++／+=／讀沒有的鍵／複製／指定／count／size／結構化繫結／const 參考走訪', 'int main() {\n    map<string, int> m;\n    m["a"]++;\n    m["b"] += 2;\n    ++m["c"];\n    m["a"] -= 5;\n    int z = m["zz"];\n    map<string, int> m2 = m;\n    m2["a"] = 100;\n    map<string, int> m3;\n    m3 = m;\n    m3["q"] = 1;\n    set<int> s;\n    s.insert(3); s.insert(1); s.insert(3);\n    cout << m.size() << " " << s.size() << " " << m.count("a") << s.count(3) << s.count(7) << z << endl;\n    for (auto [k, v] : m) cout << k << "=" << v << ";";\n    cout << endl;\n    for (const auto& p : m2) cout << p.first << p.second << " ";\n    cout << m3.size() << endl;\n    for (int x : s) cout << x;\n    cout << endl;\n    return 0;\n}\n', 'for k, v in sorted(m.items()):'],
    ['set → set：insert／count／複製／走訪照大小', 'int main() {\n    set<int> a;\n    a.insert(7);\n    a.insert(2);\n    a.insert(7);\n    set<int> b = a;\n    b.insert(5);\n    for (int x : a) cout << x << b.count(x);\n    cout << a.size() << b.size() << endl;\n    set<int> s;\n    s.insert(-3);\n    s.insert(10);\n    for (int x : s) cout << x << " ";\n    cout << endl;\n    return 0;\n}\n', 'for x in sorted(s):'],
    // ⚠️ 原本是一例，冷算判決（C++ 與 Python 各一次）在負載 35 下要 77–87 秒 ⟹ 拆成兩例（2026-11-14，450 長測試逾時）
    ['全域的 map 在函式裡改；值是 double', 'map<int, int> g;\nvoid add(int k) { g[k]++; }\nint main() {\n    add(5); add(2); add(5);\n    for (auto e : g) cout << e.first << ":" << e.second << endl;\n    map<int, double> d;\n    d[1] += 2.5;\n    d[0] = 1.5;\n    for (auto e : d) cout << e.first << " " << e.second << endl;\n    return 0;\n}\n', 'def add(k):'],
    ['值是 string；浮點放進整數的 map 要截斷', 'int main() {\n    map<int, string> t;\n    t[3] = "x";\n    cout << t[4].size() << t.size() << endl;\n    map<string, int> ii;\n    ii["a"] = 2.7;\n    cout << ii["a"] << endl;\n    return 0;\n}\n', 'ii["a"] = int(2.7)'],
    // 之前（450 量到）：`x += 2.5` 照寫，x 變成浮點——C++ 算完截斷回整數（C++ 印 4、Python 印 5.25）
    ['浮點加進整數（x += 2.5）：算完截斷', 'int main() {\n    int x = 1;\n    x += 2.5;\n    x *= 1.5;\n    map<string, int> m;\n    m["a"] += 2.7;\n    cout << x << " " << m["a"] << endl;\n    return 0;\n}\n', 'x = int(x + 2.5)'],
  ] as const) {
    it(`🟢 ${name}；判決相同（450）`, async () => {
      const src = K + code
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code).toContain(must)
      await sameVerdict(src, r.code!, '')
    }, 180_000) // 兩次冷算判決：本機負載 35 下最重的一例 39 秒（判決快取熱的時候是幾秒——CI 是冷的）
  }
  for (const [name, code, detail] of [
    ['map 的元素先讀再改、鍵有副作用（m[f(1)]++：補預設值與改要寫兩次鍵）', 'int f(int x) { return x; }\nint main() {\n    map<int, int> m;\n    m[f(1)]++;\n    cout << m.size() << endl;\n    return 0;\n}\n', '有副作用'],
    ['以參考走訪 map 而改值（tuple 改不了）', 'int main() {\n    map<int, int> m;\n    m[1] = 2;\n    for (auto& p : m) p.second = 5;\n    cout << m[1] << endl;\n    return 0;\n}\n', '以參考走訪'],
    ['char 當鍵（大於 127 的字元兩邊順序不同）', 'int main() {\n    map<char, int> m;\n    m[\'a\'] = 1;\n    cout << m.size() << endl;\n    return 0;\n}\n', 'map<char, int>'],
    // ⏳ 等 Cella：走訪時包了 sorted，而 Cella 對裝字串的 set 仍帶 str.hash 的假設（450 回報）——收斂後改成換過去、cpp-advanced 下限 9 → 10
    ['set<string>（等 Cella 收斂 str.hash 假設）', 'int main() {\n    set<string> a;\n    a.insert("b");\n    for (string x : a) cout << x;\n    return 0;\n}\n', 'str.hash'],
    ['unordered_map、multiset（走訪順序、重複鍵）', 'int main() {\n    unordered_map<int, int> m;\n    m[1] = 2;\n    multiset<int> ms;\n    cout << m.size() << endl;\n    return 0;\n}\n', 'unordered_map'],
  ] as const) {
    it(`🔴 保留：${name}（450）`, async () => {
      const r = await toPython(K + code)
      expect(r.code, '換了').toBeNull()
      expect(r.reasons.map((x) => x.detail).join()).toContain(detail)
    }, 60_000)
  }
  // ── 451：函式裡重新指定全域變數 ──
  // 之前：`int g = 0; void f() { g = 5; }` 換成 `def f():\n    g = 5`——Python 把 g 當成新的區域變數，C++ 印 5、Python 印 0，
  // **兩邊都 accept**（靜默失真）；`g++`、`total += x` 則是 UnboundLocalError。Python 的作用域看 Python 的文字定 ⟹ 問印出來的行
  for (const [name, code, stdin, must, mustNot] of [
    ['函式裡 =、++、+= 全域變數', 'int g = 0;\nint total = 0;\nvoid f() { g = 5; }\nvoid add(int x) { total += x; g++; }\nint main() {\n    f();\n    add(3);\n    add(4);\n    cout << g << " " << total << endl;\n    return 0;\n}\n', '', '    global total\n    global g', ''],
    ['cin 讀進全域變數', 'int n, best = -1;\nvoid read() { cin >> n; if (n > best) best = n; }\nint main() {\n    read();\n    read();\n    cout << n << " " << best << endl;\n    return 0;\n}\n', '3\n7\n', '    global n', ''],
    ['只讀全域變數、參數與全域同名：不寫 global', 'int g = 2;\nint x = 1;\nint f(int k) { return k * 3 + g; }\nvoid h(int x) { x = 9; }\nint main() {\n    h(2);\n    cout << f(1) << x << endl;\n    return 0;\n}\n', '', 'def h(x):', 'global'],
  ] as const) {
    it(`🟢 ${name}；判決相同（451）`, async () => {
      const src = H + code
      const r = await toPython(src, stdin)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code).toContain(must)
      if (mustNot) expect(r.code).not.toContain(mustNot)
      await sameVerdict(src, r.code!, stdin)
    }, 60_000)
  }
  for (const [name, code] of [
    ['函式裡宣告了與全域同名的變數', 'int g = 1;\nvoid f() { int g = 2; g++; cout << g; }\nint main() {\n    f();\n    cout << g << endl;\n    return 0;\n}\n'],
    // 攤平到頂層之後 main 的 n 就是全域的 n：f 讀到 3（C++ 讀到 5）
    ['main 裡宣告了與全域同名的變數', 'int n = 5;\nvoid f() { cout << n << endl; }\nint main() {\n    int n = 3;\n    f();\n    cout << n << endl;\n    return 0;\n}\n'],
  ] as const) {
    it(`🔴 保留：${name}（451）`, async () => {
      const r = await toPython(H + code)
      expect(r.code, '換了').toBeNull()
      expect(r.reasons.map((x) => x.detail).join()).toContain('同名')
    }, 60_000)
  }
  // ── 453：字面量裡的跳脫序列 ──
  // 之前：語義樹存的是寫法（`'\n'` 的 char 是兩個字），直接 JSON.stringify ⟹ Python 寫成 "\\n"、印出字面的 \n——
  // **兩邊都 accept**（靜默失真）。學生語料 StudyCpp 跑 C++ → Python 時看到的
  for (const [name, code, must] of [
    ["字元 '\\n'、'\\t'", "int main() {\n    cout << 4 << '\\n' << 5 << '\\t' << 'x' << '\\n';\n    return 0;\n}\n", '"\\t"'],
    ['字串 "\\n"、"\\\\"、"\\""', 'int main() {\n    cout << "a\\nb\\\\c\\"d\\n";\n    cout << "\\x41\\101\\n";\n    return 0;\n}\n', '"a\\nb\\\\c\\"d\\n"'],
  ] as const) {
    it(`🟢 ${name}；判決相同（453）`, async () => {
      const src = H + code
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code).toContain(must)
      expect(r.code).not.toMatch(/\\\\[nt]/)
      await sameVerdict(src, r.code!, '')
    }, 60_000)
  }
  // 數字字面量（453）：`10'0000'0000` 原樣搬過去是不合法的 Python（StudyCpp 7_5_TLE 判 untranslated）；`017` 是八進位
  it("🟢 數字分隔符號 10'0000'0000 → 10_0000_0000、八進位 017 → 0o17；判決相同（453）", async () => {
    const src = H + "int main() {\n    const int oo = 10'0000'0000;\n    int m = 017;\n    cout << oo << \" \" << m << endl;\n    return 0;\n}\n"
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('10_0000_0000')
    expect(r.code, r.code!).toContain('0o17')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  // 註解（453）：StudyCpp 218 支裡 120 支被「cpp:comment 還沒有 Python 的寫法」擋住；只剩註解的本體要補 pass
  it('🟢 單行、區塊註解 → #；只有註解的本體補 pass；判決相同（453）', async () => {
    const src = H + '// 頂層\n/* 兩行\n   第二行 */\nint main() {\n    int n = 3; // 行尾\n    if (n > 5) {\n        // 什麼都不做\n    }\n    cout << n << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code).toContain('# 頂層')
    expect(r.code, r.code!).toMatch(/# 什麼都不做\n\s+pass/)
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 空的 if／while 本體寫成 pass（頂層原本把縮排的 pass 一起濾掉）；判決相同（453）', async () => {
    const src = H + 'int main() {\n    int n = 3;\n    if (n > 5) {}\n    while (n > 9) {}\n    cout << n << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toMatch(/if n > 5:\n {4}pass/)
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 ios::sync_with_stdio(0),cin.tie(0) 不寫（只影響速度）、逗號敘述逐個寫；判決相同（453）', async () => {
    const src = H + 'int main() {\n    ios::sync_with_stdio(0),cin.tie(0);\n    int a, b;\n    cin >> a >> b;\n    a++, b--;\n    cout << a << " " << b << endl;\n    return 0;\n}\n'
    const r = await toPython(src, '3 9\n')
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).not.toMatch(/sync|tie/)
    await sameVerdict(src, r.code!, '3 9\n')
  }, 60_000)
  // 型別別名（453）：StudyCpp 55 支有 #define，43 支是 `#define ll long long`——展開之後 `ll x = 3.7` 照 long long 截斷
  for (const [name, head] of [
    ['#define ll long long', '#define ll long long\n#define MAXN 5\n'],
    ['typedef long long ll', 'typedef long long ll;\nconst int MAXN = 5;\n'],
    ['using ll = long long', 'using ll = long long;\nconst int MAXN = 5;\n'],
  ] as const) {
    it(`🟢 ${name}：展開成型別、整數照截斷；判決相同（453）`, async () => {
      const src = H + head + 'int main() {\n    ll x = 3.7;\n    ll a[MAXN] = {0};\n    a[2] = x * 1000000000LL;\n    cout << x << " " << a[2] << " " << a[0] << endl;\n    return 0;\n}\n'
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code, r.code!).toContain('x = int(3.7)')
      await sameVerdict(src, r.code!, '')
    }, 60_000)
  }
  it('🔴 保留：記號替換巨集 #define F first（453）', async () => {
    const r = await toPython(H + '#define F first\nint main() {\n    pair<int, int> p = {1, 2};\n    cout << p.F << endl;\n    return 0;\n}\n')
    expect(r.code, '換了').toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('巨集「F」')
  }, 60_000)
  it('🟢 v.back()、v.pop_back() → v[-1]、v.pop()；判決相同（453）', async () => {
    const src = H + 'int main() {\n    vector<int> v;\n    v.push_back(3);\n    v.push_back(8);\n    cout << v.back() << endl;\n    v.back() = 5;\n    v.pop_back();\n    cout << v.back() << " " << v.size() << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('v.pop()')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🔴 保留：字串的 pop_back、元素是 vector 的 back（453）', async () => {
    for (const body of ['string s = "ab";\n    s.pop_back();\n    cout << s;', 'vector<vector<int>> g(2);\n    vector<int> b = g.back();\n    cout << b.size();']) {
      const r = await toPython(H + `int main() {\n    ${body}\n    return 0;\n}\n`)
      expect(r.code, body).toBeNull()
    }
  }, 60_000)
  it('🟢 (int)、(double)、(long long) 轉型；判決相同（453）', async () => {
    const src = H + 'int main() {\n    double d = -3.7;\n    int a = 7, b = 2;\n    char c = \'A\';\n    cout << (int)d << " " << (double)a / b << " " << (int)c << " " << (long long)a * 1000000000 << " " << static_cast<double>(b) / a << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('int(d)')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🔴 保留：窄化轉型 (int) long long、(float)（453）', async () => {
    for (const body of ['long long x = 5000000000LL;\n    cout << (int)x;', 'double d = 0.1;\n    cout << (float)d;']) {
      const r = await toPython(H + `int main() {\n    ${body}\n    return 0;\n}\n`)
      expect(r.code, body).toBeNull()
    }
  }, 60_000)
  it('🟢 auto 的初值是純量；容器照實保留；判決相同（453）', async () => {
    const src = H + 'int main() {\n    int a = 7;\n    auto b = a * 2;\n    auto d = a / 2.0;\n    cout << b << " " << d << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    await sameVerdict(src, r.code!, '')
    const kept = await toPython(H + 'int main() {\n    vector<int> v(3);\n    auto w = v;\n    w[0] = 1;\n    cout << v[0] << endl;\n    return 0;\n}\n')
    expect(kept.code, '換了——w 會變成 v 的別名').toBeNull()
  }, 60_000)
  it('🟢 大括號初始化 int x{}、long long s{5}；判決相同（453）', async () => {
    const src = H + 'int main() {\n    int n, c{}, m{};\n    long long s{5};\n    cin >> n;\n    c += n;\n    cout << c << " " << m << " " << s << endl;\n    return 0;\n}\n'
    const r = await toPython(src, '4\n')
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('c = 0')
    await sameVerdict(src, r.code!, '4\n')
  }, 60_000)
  // 計次迴圈（453）：之前一律 range(n)——上界只算一次、迴圈變數每圈重設；C++ 每圈重算上界。
  // `if (i == 1) n = 3` C++ 印 012、Python 印 01234，**兩邊都 accept**（靜默失真）。本體提到上界或迴圈變數 ⟹ 寫成 while
  for (const [name, body] of [
    ['上界在本體裡被改', 'int n = 5;\n    for (int i = 0; i < n; i++) {\n        if (i == 1) n = 3;\n        cout << i;\n    }'],
    ['上界是 v.size()，本體 push_back', 'vector<int> v(2);\n    for (int i = 0; i < v.size(); i++) {\n        if (i < 3) v.push_back(i);\n        cout << i;\n    }'],
    ['本體改迴圈變數', 'for (int i = 0; i <= 9; i++) {\n        cout << i;\n        i += 2;\n    }'],
  ] as const) {
    it(`🟢 計次迴圈：${name} ⟹ while；判決相同（453）`, async () => {
      const src = H + `int main() {\n    ${body}\n    cout << endl;\n    return 0;\n}\n`
      const r = await toPython(src)
      expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
      expect(r.code, r.code!).toContain('while i <')
      await sameVerdict(src, r.code!, '')
    }, 60_000)
  }
  it('🟢 計次迴圈：本體沒提到上界 ⟹ 照舊 range（453）', async () => {
    const src = H + 'int main() {\n    int n = 4, s = 0;\n    for (int i = 0; i < n; i++) s += i;\n    cout << s << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, r.code ?? '').toContain('for i in range(n):')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🔴 保留：上界可能被改而本體有 continue（453）', async () => {
    const r = await toPython(H + 'int main() {\n    int n = 5;\n    for (int i = 0; i < n; i++) {\n        if (i == 1) { n = 3; continue; }\n        cout << i;\n    }\n    return 0;\n}\n')
    expect(r.code, r.code ?? '').toBeNull()
  }, 60_000)
  it('🔴 保留：\\xff（位元組，不是碼點）（453）', async () => {
    const r = await toPython(H + 'int main() {\n    cout << "\\xff" << endl;\n    return 0;\n}\n')
    expect(r.code, '換了').toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('位元組')
  }, 60_000)
  // ── 455：三元運算子、abs、swap（StudyCpp 擋最多、又不等 Cella 的三顆：16、9、9 支）──
  it('🟢 c ? a : b → (a if c else b)；整數分支放進浮點的結果補 float()；判決相同（455）', async () => {
    const src = H + 'int main() {\n    int n;\n    cin >> n;\n    int m = n > 3 ? n * 2 : n - 1;\n    double d = n > 3 ? 1 : 2.5;\n    cout << m << " " << d / 4 << " " << (n % 2 == 0 ? "even" : "odd") << endl;\n    return 0;\n}\n'
    const r = await toPython(src, '5\n')
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('(n * 2 if n > 3 else n - 1)')
    expect(r.code, r.code!).toContain('float(1)')
    await sameVerdict(src, r.code!, '5\n')
    await sameVerdict(src, r.code!, '2\n')
  }, 60_000)
  it('🟢 abs(x)、swap(a, b) → abs(x)、a, b = b, a（含陣列元素、全域變數）；判決相同（455）', async () => {
    const src = H + 'int g = 1, h = 2;\nvoid flip() {\n    swap(g, h);\n}\nint main() {\n    int a[3] = {3, -7, 5};\n    swap(a[0], a[2]);\n    flip();\n    int x = -4, y = 9;\n    swap(x, y);\n    cout << a[0] << a[2] << " " << abs(a[1]) << " " << x << y << " " << g << h << " " << abs(-2.5) << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('a[0], a[2] = a[2], a[0]')
    expect(r.code, r.code!).toMatch(/global g/)
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 計次迴圈本體 swap 了上界 → while（swap 宣告它寫哪兩個）；判決相同（455）', async () => {
    const src = H + 'int main() {\n    int n = 5, k = 2;\n    for (int i = 0; i < n; i++) {\n        if (i == 1) swap(n, k);\n        cout << i;\n    }\n    cout << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).not.toContain('range(')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it("🔴 保留：分支型別不同而 C++ 會轉型的條件運算式（c ? 'a' : 66 的結果是 int）（455）", async () => {
    const r = await toPython(H + "int main() {\n    int n = 1;\n    cout << (n > 0 ? 'a' : 66) << endl;\n    return 0;\n}\n")
    expect(r.code, '換了').toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('條件運算式')
  }, 60_000)
  it('🔴 保留：交換字串裡的字元（455）', async () => {
    const r = await toPython(H + '#include <string>\nint main() {\n    string s = "ab";\n    swap(s[0], s[1]);\n    cout << s << endl;\n    return 0;\n}\n')
    expect(r.code, '換了').toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('字串')
  }, 60_000)
  // ── 456：64 位元的除法與取餘數、位元運算、取負號、max／min 的大括號串列、一般的 for、內層與外層同名 ──
  it('🟢 64 位元整數的 / 與 %（含 /=、%=）→ trunc_div／trunc_mod64，超過 2^53 也精確；判決相同（456）', async () => {
    const src = H + 'int main() {\n    long long a = 9000000000000003LL, b = -7;\n    long long x = -17, y = -17;\n    x /= 5;\n    y %= 5;\n    cout << a / b << " " << a % b << " " << (-a) / 3 << " " << (-a) % 3 << " " << x << " " << y << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('trunc_div(a, b)')
    expect(r.code, r.code!).toContain('y = trunc_mod64(y, 5)')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 有號整數的 &、|、^、>>（含 &= 一類）、取負號、max／min({…})；判決相同（456）', async () => {
    const src = H + 'int main() {\n    int a = -12, b = 10, c = 6;\n    c &= 3;\n    c |= 8;\n    c >>= 1;\n    double d = 2.5;\n    int m = max({a, b, c});\n    int k = min({b, -a, c});\n    cout << (a & b) << " " << (a | b) << " " << (a ^ b) << " " << (a >> 2) << " " << c << " " << -d << " " << -(a + 1) << " " << m << k << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('max(a, b, c)')
    expect(r.code, r.code!).toContain('min(b, -a, c)')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 一般的 for → while（兩個迴圈變數、逗號更新、沿用外面的變數、位移的更新）；判決相同（456）', async () => {
    const src = H + 'int main() {\n    int s = 0, i;\n    for (int l = 0, r = 9; l < r; l++, r--) s += r - l;\n    for (i = 0; i < 3; i++) {\n        if (s > 100) break;\n    }\n    long long t = 0;\n    for (long long jp = 1e12; jp > 0; jp >>= 1) t++;\n    cout << s << " " << i << " " << t << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('while l < r:')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🔴 保留：一般的 for 本體有 continue（寫成 while 會跳過更新）（456）', async () => {
    const r = await toPython(H + 'int main() {\n    int s = 0;\n    for (int i = 1; i < 20; i = i + 2) {\n        if (i == 5) continue;\n        s += i;\n    }\n    cout << s << endl;\n    return 0;\n}\n')
    expect(r.code, '換了').toBeNull()
    expect(r.reasons.map((x) => x.detail).join()).toContain('continue')
  }, 60_000)
  // 之前換得過去而兩邊印的不同（C++ 100、Python 2）——計次迴圈 `for i in range` 改到外層的 i：靜默失真
  it('🔴 保留：內層宣告了與外層同名的變數（Python 一個函式只有一層作用域）（456）', async () => {
    for (const body of ['    int i = 100;\n    for (int i = 0; i < 3; i++) {\n    }\n    cout << i << endl;\n', '    int i = 100;\n    if (i > 0) {\n        int i = 5;\n        cout << i;\n    }\n    cout << i << endl;\n']) {
      const r = await toPython(`${H}int main() {\n${body}    return 0;\n}\n`)
      expect(r.code, `換了：${body}`).toBeNull()
      expect(r.reasons.map((x) => x.detail).join()).toContain('同名的變數「i」')
    }
    // 正向錨點：並排的兩個 for (int i…) 不算（前一個的作用域已經結束）
    const ok = await toPython(H + 'int main() {\n    int s = 0;\n    for (int i = 0; i < 3; i++) s += i;\n    for (int i = 0; i < 2; i++) s += i;\n    cout << s << endl;\n    return 0;\n}\n')
    expect(ok.code, JSON.stringify(ok.reasons)).not.toBeNull()
  }, 60_000)
  it('🔴 保留：放不進 JSON 數字的十進位字面量（9000000000000000001）——Cella 那一側照實翻不出，不送一個被捨入的值（456）', async () => {
    const src = H + 'int main() {\n    long long a = 9000000000000000001LL;\n    cout << a % 7 << endl;\n    return 0;\n}\n'
    const v = await runCella(src, { lang: 'cpp' })
    expect(v.verdict).toBe('untranslated')
  }, 60_000)
  // ── 457：運算式裡的 ++／--（拆到這一句的前後）、while (n--) ──
  it('🟢 運算式裡的 ++／--：a[k++] = b[j++]、j = i++、j = ++i、宣告的初值、函式引數；判決相同（457）', async () => {
    const src = H + 'int f(int x) { return x * 10; }\nint main() {\n    int a[5] = {0}, b[5] = {1, 2, 3, 4, 5};\n    int k = 0, j = 1, i = 3;\n    a[k++] = b[j++];\n    a[k++] = b[j++];\n    int p = i++;\n    int q = ++i;\n    int r = f(j--);\n    cout << a[0] << a[1] << " " << k << j << " " << p << q << i << " " << r << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('a[k] = b[j]\nk += 1\nj += 1')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🟢 while (n--)：先判舊值、再減、離開時 n 停在 -1；本體有 continue 也對；判決相同（457）', async () => {
    const src = H + 'int main() {\n    int n, s = 0, t = 4;\n    cin >> n;\n    while (n--) {\n        if (n == 2) continue;\n        s += n;\n    }\n    while (t--) s++;\n    cout << s << " " << n << " " << t << endl;\n    return 0;\n}\n'
    const r = await toPython(src, '5\n')
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('while n != 0:')
    await sameVerdict(src, r.code!, '5\n')
  }, 60_000)
  it('🟢 計次迴圈的大括號起始值 for (int i{}; …)、for (int i{1}; …)；上界是浮點（i < 1e1）寫成 while（range 只收整數）；判決相同（457）', async () => {
    const src = H + 'int main() {\n    long long s{};\n    for (int i{}; i < 3; i++) cout << i;\n    for (int i{1}; i <= 4; i++) s += i;\n    for (int i{}; i < 1e1; i++) s += i;\n    cout << " " << s << endl;\n    return 0;\n}\n'
    const r = await toPython(src)
    expect(r.code, JSON.stringify(r.reasons)).not.toBeNull()
    expect(r.code, r.code!).toContain('for i in range(3):')
    await sameVerdict(src, r.code!, '')
  }, 60_000)
  it('🔴 保留：拆開之後意思會變的 ++／--（同一句又用到、條件裡、&& 裡、return 之後、while (n--) 裡有 break）（457）', async () => {
    const cases: [string, string, string][] = [
      ['同一句又用到', '    int i = 1, a[3] = {0};\n    a[i] = i++;\n    cout << a[1] << i << endl;\n', '又用到「i」'],
      ['if 的條件', '    int i = 0;\n    if (i++ == 0) cout << 1 << endl;\n', '條件或迴圈'],
      ['&& 裡', '    int i = 0, c = 0;\n    bool b = c > 0 && i++ > 0;\n    cout << b << i << endl;\n', '&&'],
      ['while (n--) 有 break', '    int n = 5;\n    while (n--) {\n        if (n == 2) break;\n    }\n    cout << n << endl;\n', 'break'],
    ]
    for (const [what, body, why] of cases) {
      const r = await toPython(`${H}int main() {\n${body}    return 0;\n}\n`)
      expect(r.code, `換了：${what}\n${r.code}`).toBeNull()
      expect(r.reasons.map((x) => x.detail).join(), what).toContain(why)
    }
    const g = await toPython(H + 'int c = 0;\nint g() { return c; }\nint h() {\n    return c++;\n}\nint main() {\n    int x = h();\n    cout << x << c << endl;\n    return 0;\n}\n')
    expect(g.code, `換了：return 之後\n${g.code}`).toBeNull()
    expect(g.reasons.map((x) => x.detail).join()).toContain('離開')
  }, 60_000)
  it('🔴 保留：類別', async () => {
    const r = await toPython(H + 'class P {\npublic:\n    int x;\n};\nint main() {\n    P p;\n    p.x = 1;\n    cout << p.x << endl;\n    return 0;\n}\n')
    expect(r.code).toBeNull()
    expect(r.reasons.length).toBeGreaterThan(0)
  }, 60_000)
  it('🔴 保留：整數溢位（C++ 未定義行為、Python 不溢位）——換法從判決知道（T017）', async () => {
    const r = await toPython(H + 'int main() {\n    int a = 2147483647;\n    a = a + 1;\n    cout << a << endl;\n    return 0;\n}\n')
    expect(r.code, '換了——意思會變').toBeNull()
    expect(r.reasons.map((x) => x.kind)).toContain('overflow')
  }, 60_000)
})
