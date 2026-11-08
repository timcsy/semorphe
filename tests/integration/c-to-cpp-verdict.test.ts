/**
 * **C → C++ 沒有失真**——跨語言互轉第一對的驗收（`knowledge/draft/2026-11-07-Lean4課程與跨語言互轉——以Cella為根基.md`）。
 *
 * 判準不是「看起來像 C++」，是**兩邊交給 Cella 判，判決相同（含 `assumes`）、印出來的一字不差**：
 *
 * ```
 * C 原文 ──lift──▶ 語意樹 ──convertCToCpp(型別由 Cella 給)──▶ 新樹 ──產碼（C++ 風格 ＋ 補丁器）──▶ C++
 *   └──────────── Cella（lang c）                                                    Cella（lang cpp）──┘
 *                                       判決、輸出、assumes 相同
 * ```
 *
 * ⚠️ **正向錨點**：課文那一組斷言「真的換了」（`converted > 0`、輸出裡沒有 printf）——
 * 否則「什麼都沒換」也會兩邊相同，這支會空過。
 * 而「該保留」那一組斷言**保留了**，而且照樣兩邊相同（保留不等於壞掉）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setDependencyResolver } from '../../src/core/projection/code-generator'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { createCppCodePatcher } from '../../src/languages/cpp/auto-include'
import { convertCToCpp } from '../../src/languages/cpp/c-to-cpp'
import { runCella, cellaTypesOfTree } from '../helpers/cella-run'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
let lifter: Lifter
let patch: ReturnType<typeof createCppCodePatcher>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  const registry = createPopulatedRegistry()
  setDependencyResolver(registry as never)
  patch = createCppCodePatcher(registry as never)
})

async function toCpp(src: string): Promise<{ cpp: string; converted: number; kept: number }> {
  const tree = lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
  expect(tree, 'lift 回了 null').not.toBeNull()
  const types = await cellaTypesOfTree(tree, { lang: 'c' })
  const r = convertCToCpp(tree, types)
  const code = generateCode(r.tree, 'cpp', apcs as StylePreset)
  const cpp = patch(code, r.tree, 'using', 2, 'main', 'apcs') ?? code
  return { cpp, converted: r.converted, kept: r.kept }
}

async function sameVerdict(src: string, cpp: string, stdin = ''): Promise<void> {
  const a = await runCella(src, { lang: 'c', stdin })
  const b = await runCella(cpp, { lang: 'cpp', stdin })
  const show = `\n--- C++ ---\n${cpp}\n--- C: ${a.verdict} ${JSON.stringify(a.out)} / C++: ${b.verdict} ${JSON.stringify(b.out)}`
  expect(a.verdict, `C 那一側本身就不是 accept——測資或原文錯了${show}`).toBe('accept')
  expect(b.verdict, show).toBe(a.verdict)
  expect(b.out, show).toBe(a.out)
  expect(b.assumes ?? [], show).toEqual(a.assumes ?? [])
}

describe('C → C++：c-bridge 課文的解答', () => {
  const files = fs.readdirSync('lessons/c-bridge', { recursive: true }).map(String)
    .filter((f) => f.endsWith('.c')).map((f) => `lessons/c-bridge/${f}`)

  it('入口：讀到了課文的 C 解答', () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  for (const f of files) {
    it(f.replace('lessons/c-bridge/', ''), async () => {
      const src = fs.readFileSync(f, 'utf8')
      const lesson = JSON.parse(fs.readFileSync(f.replace(/solutions\/.*/, 'lesson.json'), 'utf8'))
      // 解讀的解答（`<題目>~<解讀>.c`，spec 218）用的是同一題的測資：題目 id 是 `~` 前面那段
      const stem = path.basename(f, '.c').split('~')[0]
      const task = lesson.tasks.find((t: { id: string }) => t.id === stem)
      const stdin = ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
      const { cpp, converted, kept } = await toCpp(src)
      expect(converted, `一行都沒換：\n${cpp}`).toBeGreaterThan(0)
      // 用到 scanf 回傳值的（`while (scanf(…) == 1)`，讀到結尾的寫法）照第一刀的規則保留——cin >> 沒有那個值；其餘一行都不留
      const usesScanfResult = /scanf\([^;]*\)\s*(==|!=|<|>)/.test(src)
      if (!usesScanfResult) {
        expect(kept, `有保留的行：\n${cpp}`).toBe(0)
        expect(cpp).not.toMatch(/\b(printf|scanf)\s*\(/)
      } else {
        expect(cpp, cpp).toMatch(/scanf\([^;]*\)\s*(==|!=|<|>)/)
      }
      // 第四刀：課文的 malloc／free 換成 new[]／delete[]（c-bridge 第 4 課）
      if (/\bmalloc\s*\(/.test(src)) expect(cpp, cpp).toMatch(/\bnew\b[\s\S]*\bdelete\b/)
      expect(cpp).not.toMatch(/\b(malloc|free)\s*\(/)
      expect(cpp).toContain('using namespace std;')
      await sameVerdict(src, cpp, stdin)
    })
  }
})

describe('C → C++：換了會變意思的，保留', () => {
  const cases: { name: string; src: string; stdin?: string; kept: number; still: RegExp }[] = [
    {
      name: '寬度與精度（cout 要 iomanip）',
      src: 'int main() {\n    double x = 1.5;\n    printf("%5.2f\\n", x);\n    return 0;\n}\n',
      kept: 1, still: /printf\("%5\.2f\\n", x\)/,
    },
    {
      name: '%c 配 int（printf 印字元、cout 會印數字）',
      src: 'int main() {\n    int i = 2;\n    printf("%c\\n", \'A\' + i);\n    return 0;\n}\n',
      kept: 1, still: /printf\("%c\\n"/,
    },
    {
      name: '%g 遇上同一支程式裡換成 fixed 的輸出：cout 的狀態會改它的印法 ⟹ %g 那一行保留（第五刀）',
      src: 'int main() {\n    double x = 1.5, y = 2.25;\n    printf("%.1f\\n", x);\n    printf("%g\\n", y);\n    return 0;\n}\n',
      kept: 1, still: /printf\("%g\\n", y\)/,
    },
    {
      name: 'scanf 的格式裡有逗號（cin 不會跳過它）',
      src: 'int main() {\n    int a, b;\n    scanf("%d,%d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n',
      stdin: '3,4\n', kept: 1, still: /scanf\("%d,%d", &a, &b\)/,
    },
    {
      name: 'scanf 的回傳值有用到（cin >> 沒有那個值）',
      src: 'int main() {\n    int x, s = 0;\n    while (scanf("%d", &x) == 1) {\n        s = s + x;\n    }\n    printf("%d\\n", s);\n    return 0;\n}\n',
      stdin: '1 2 3\n', kept: 0, still: /while \(scanf\("%d", &x\) == 1\)/,
    },
  ]
  for (const c of cases) {
    it(c.name, async () => {
      const { cpp, kept } = await toCpp(c.src)
      expect(cpp, cpp).toMatch(c.still)
      expect(kept).toBe(c.kept)
      await sameVerdict(c.src, cpp, c.stdin ?? '')
    })
  }

  it('同一支程式裡換得動的照換：printf("%d\\n") 換、printf("%5.2f") 留（寬度還沒換）', async () => {
    const src = 'int main() {\n    int n = 3;\n    double avg = 2.5;\n    printf("n = %d\\n", n);\n    printf("%5.2f\\n", avg);\n    return 0;\n}\n'
    const { cpp, converted, kept } = await toCpp(src)
    expect([converted, kept]).toEqual([1, 1])
    expect(cpp).toContain('cout << "n = " << n << endl;')
    expect(cpp).toContain('#include <cstdio>')
    await sameVerdict(src, cpp)
  })

  // ── 第五刀（2026-11-08）：%f／%.Nf → fixed << setprecision(N)，每一次都明寫（不靠前一行留下的狀態）──
  it('🟢 %.2f、%f、%lf、%.0f → fixed << setprecision(N)；之後的整數不受影響', async () => {
    const src = 'int main() {\n    double avg = 2.5, pi = 3.14159;\n    float r = 0.5;\n    int n = 7;\n    printf("avg = %.2f\\n", avg);\n    printf("%f %lf\\n", pi, r);\n    printf("%.0f\\n", pi);\n    printf("%d\\n", n);\n    return 0;\n}\n'
    const { cpp, converted, kept } = await toCpp(src)
    expect([converted, kept]).toEqual([4, 0])
    expect(cpp).toContain('cout << "avg = " << fixed << setprecision(2) << avg << endl;')
    expect(cpp).toContain('cout << fixed << setprecision(6) << pi << " " << fixed << setprecision(6) << r << endl;')
    expect(cpp).toContain('cout << fixed << setprecision(0) << pi << endl;')
    expect(cpp).toContain('#include <iomanip>')
    expect(cpp).not.toMatch(/\bprintf\s*\(/)
    await sameVerdict(src, cpp)
  })

  it('🔴 不轉型的 malloc：C 合法、C++ 不收 ⟹ 換成 C++ 時補上轉型（宣告與指定兩種）', async () => {
    const src = '#include <stdio.h>\n#include <stdlib.h>\nint main() {\n    int n = 3;\n    int *a = malloc(n * sizeof(int));\n    char *s;\n    s = malloc(4);\n    for (int i = 0; i < n; i++) {\n        a[i] = i * i;\n    }\n    s[0] = \'o\';\n    s[1] = \'k\';\n    s[2] = 0;\n    printf("%d %s\\n", a[2], s);\n    free(a);\n    free(s);\n    return 0;\n}\n'
    const { cpp, converted } = await toCpp(src)
    expect(cpp).toContain('int* a = (int*)malloc(n * sizeof(int));')
    expect(cpp).toContain('s = (char*)malloc(4);')
    expect(converted).toBe(3)
    await sameVerdict(src, cpp)
  })

  // ── 第四刀（2026-11-08）：malloc／free → new／delete，整支程式全有或全無 ──
  it('🟢 malloc／free → new[]／delete[]（陣列）與 new／delete（單一，透過 -> 取成員）', async () => {
    const src = '#include <stdio.h>\n#include <stdlib.h>\nstruct P {\n    int x;\n};\nint main() {\n    int n = 4;\n    int *a = (int*)malloc(n * sizeof(int));\n    struct P *p = malloc(sizeof(struct P));\n    for (int i = 0; i < n; i++) {\n        a[i] = i * 10;\n    }\n    p->x = a[3];\n    *a = 7;\n    printf("%d %d\\n", p->x, a[0]);\n    free(a);\n    free(p);\n    return 0;\n}\n'
    const { cpp, converted, kept } = await toCpp(src)
    expect(cpp).toContain('int* a = new int[n];')
    expect(cpp).toContain('P* p = new P;')
    expect(cpp).toContain('delete[] a;')
    expect(cpp).toContain('delete p;')
    expect(cpp).not.toMatch(/\b(malloc|free)\s*\(/)
    expect([converted, kept]).toEqual([5, 0]) // 兩個 malloc、兩個 free、一個 printf
    await sameVerdict(src, cpp)
  })

  for (const c of [
    { name: '別名（`int *q = a; free(q);`）：free 的對象不在名單上 ⟹ 整支不換', body: '    int *a = (int*)malloc(3 * sizeof(int));\n    int *q = a;\n    a[0] = 5;\n    printf("%d\\n", q[0]);\n    free(q);\n' },
    { name: '指標本身被改（`p++`）：delete 會拿到另一個位址 ⟹ 不換', body: '    int *a = (int*)malloc(3 * sizeof(int));\n    a[0] = 1;\n    a[1] = 2;\n    int *p = a;\n    p++;\n    printf("%d\\n", *p);\n    free(a);\n' },
    { name: 'sizeof 的型別與指標的元素對不上（`int *` 配 `sizeof(char)`）⟹ 不換', body: '    int *a = (int*)malloc(16 * sizeof(char));\n    a[0] = 9;\n    printf("%d\\n", a[0]);\n    free(a);\n' },
  ]) {
    it(c.name, async () => {
      const src = `#include <stdio.h>\n#include <stdlib.h>\nint main() {\n${c.body}    return 0;\n}\n`
      const { cpp, kept } = await toCpp(src)
      expect(cpp).toMatch(/\bmalloc\s*\(/)
      expect(cpp).toMatch(/\bfree\s*\(/)
      expect(cpp).not.toMatch(/\bnew\b|\bdelete\b/)
      expect(kept).toBeGreaterThan(0)
      await sameVerdict(src, cpp)
    })
  }

  it('struct 標籤：`struct Point p;` → `Point p;`（型別那幾格；字串字面不碰）', async () => {
    const src = '#include <stdio.h>\nstruct Point {\n    int x;\n    int y;\n};\nint dist2(struct Point p) {\n    return p.x * p.x + p.y * p.y;\n}\nint main() {\n    struct Point ps[2];\n    ps[0].x = 3;\n    ps[0].y = 4;\n    struct Point *q = &ps[0];\n    printf("struct Point %d\\n", dist2(*q));\n    return 0;\n}\n'
    const { cpp } = await toCpp(src)
    expect(cpp).toContain('Point ps[2];')
    expect(cpp).toMatch(/int dist2\(Point p\)/)
    expect(cpp).toMatch(/Point\s*\* ?q = &ps\[0\];/)
    expect(cpp).not.toMatch(/struct Point (ps|p\)|\*)/)
    // 字串字面裡的那兩個字照原樣
    expect(cpp).toContain('"struct Point "')
    // 正向錨點：struct 的定義本身還在
    expect(cpp).toContain('struct Point {')
    await sameVerdict(src, cpp)
  })

  it('原文寫的 C 標頭換成 C++ 的名字', async () => {
    const src = '#include <stdio.h>\n#include <string.h>\nint main() {\n    char s[10] = "abc";\n    printf("%d\\n", (int)strlen(s));\n    printf("%.1f\\n", 2.5);\n    return 0;\n}\n'
    const { cpp } = await toCpp(src)
    expect(cpp).toContain('#include <cstdio>')
    expect(cpp).toContain('#include <cstring>')
    expect(cpp).not.toMatch(/stdio\.h|string\.h/)
    await sameVerdict(src, cpp)
  })
})

describe('C 原文自己來回一趟（C 目標）——轉換的前提', () => {
  it('🔴 帶標籤的參數型別不得掉（`int f(struct Point p)` 曾經變成 `int f(int p)`）', async () => {
    const src = '#include <stdio.h>\nstruct Point {\n    int x;\n};\nenum Color { RED, GREEN };\nint f(struct Point p) {\n    return p.x;\n}\nint g(const struct Point* p) {\n    return p->x;\n}\nint c(enum Color k) {\n    return k;\n}\nint main() {\n    struct Point q;\n    q.x = 4;\n    printf("%d %d %d\\n", f(q), g(&q), c(GREEN));\n    return 0;\n}\n'
    const tree = lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
    const back = generateCode(tree, 'cpp', cStyle as StylePreset)
    for (const sig of ['int f(struct Point p)', 'int g(const struct Point* p)', 'int c(enum Color k)']) expect(back).toContain(sig)
    await expectSame(src, back)
  })
})

async function expectSame(a: string, b: string): Promise<void> {
  const x = await runCella(a, { lang: 'c' })
  const y = await runCella(b, { lang: 'c' })
  expect(x.verdict, JSON.stringify(x.problems?.slice(0, 2))).toBe('accept')
  expect([y.verdict, y.out]).toEqual([x.verdict, x.out])
}
