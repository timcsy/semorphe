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

const files = fs.readdirSync('lessons/cpp-beginner', { recursive: true }).map(String)
  .filter((f) => f.endsWith('.cpp') && f.includes('/solutions/')).sort().map((f) => `lessons/cpp-beginner/${f}`)

const stdinOf = (f: string): string => {
  const lesson = JSON.parse(fs.readFileSync(f.replace(/solutions\/.*/, 'lesson.json'), 'utf8'))
  const task = lesson.tasks.find((t: { id: string }) => t.id === path.basename(f, '.cpp').split('~')[0])
  return ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
}

/** Cella 的 Python 家族少帶 libm 的假設（sqrt）——修好時這幾支會紅 */
const KNOWN_ASSUMES_GAP = new Set(['06-算一算/solutions/rebuild.cpp'])

describe('C++ → Python：cpp-beginner 課文的解答', () => {
  const tally = { converted: [] as string[], kept: new Map<string, string[]>() }

  it('入口：讀到了課文的 C++ 解答', () => {
    expect(files.length).toBeGreaterThanOrEqual(60)
  })

  for (const f of files) {
    it(f.replace('lessons/cpp-beginner/', ''), async () => {
      const src = fs.readFileSync(f, 'utf8')
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
      if (KNOWN_ASSUMES_GAP.has(f.replace('lessons/cpp-beginner/', ''))) await knownCellaGap(/correctlyRounded/, () => sameVerdict(src, r.code!, stdinOf(f)))
      else await sameVerdict(src, r.code, stdinOf(f))
      // SC-005／research R7 的第二道檢查：換出來的碼由 Python 自己的 lift 認得乾淨（沒有照原文），產碼回來同一支程式
      const back = await liftPython(r.code)
      expect(componentIdsOf(back).filter((c) => /raw|unresolved/.test(c)), `Python 的 lift 認不出來：\n${r.code}`).toEqual([])
      expect(generatePython(back).trimEnd(), `走一趟 Python 積木回來不一樣：\n${r.code}`).toBe(r.code.trimEnd())
    }, 60_000)
  }

  it('★ 報表與門檻：換過去的至少一半（SC-001）；兩份加起來等於解答總數', () => {
    const kept = files.length - tally.converted.length
    console.log(`C++ → Python：換過去 ${tally.converted.length} 支／保留 ${kept} 支｜原因分佈 ${[...tally.kept].map(([k, v]) => `${k}:${v.length}`).join(' ')}`)
    expect(tally.converted.length, '換過去的不到一半').toBeGreaterThanOrEqual(Math.ceil(files.length / 2))
  })
})

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
    // 64 位元的整數：值可以超過 2^53，浮點不再精確 ⟹ int(a / b)、math.fmod 都不保證相同（spec 224 順手修：除法原本也收 long long）
    ['64 位元整數的取餘數', '    long long a = -7, b = 2;\n    cout << a % b << endl;\n', 'modulo'],
    // `i++` 這個運算式在 Python 沒有對應——不因為取餘數改用小函式就放行
    ['取餘數的一邊是 i++', '    int i = 7;\n    cout << i++ % 3 << " " << i << endl;\n', 'outside-subset'],
    ['main 中途 return 非零', '    int a = 1;\n    if (a > 0) {\n        return 1;\n    }\n    cout << a << endl;\n', 'outside-subset'],
    ['二維陣列的初值沒寫滿', '    int g[2][2] = {{1}, {2, 3}};\n    cout << g[0][1] << endl;\n', 'outside-subset'],
    ['64 位元整數的除法', '    long long a = 9007199254740993LL, b = 1;\n    cout << a / b << endl;\n', 'division'],
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
