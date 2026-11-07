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
      const task = lesson.tasks.find((t: { id: string }) => f.endsWith(`/${t.id}.c`))
      const stdin = ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
      const { cpp, converted, kept } = await toCpp(src)
      expect(converted, `一行都沒換：\n${cpp}`).toBeGreaterThan(0)
      expect(kept, `有保留的行：\n${cpp}`).toBe(0)
      expect(cpp).not.toMatch(/\b(printf|scanf)\s*\(/)
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
      name: '%f（printf 印 6 位小數、cout 印 %g）',
      src: 'int main() {\n    double x = 1.5;\n    printf("%f\\n", x);\n    return 0;\n}\n',
      kept: 1, still: /printf\("%f\\n", x\)/,
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

  it('同一支程式裡換得動的照換：printf("%d\\n") 換、printf("%.1f") 留', async () => {
    const src = 'int main() {\n    int n = 3;\n    double avg = 2.5;\n    printf("n = %d\\n", n);\n    printf("%.1f\\n", avg);\n    return 0;\n}\n'
    const { cpp, converted, kept } = await toCpp(src)
    expect([converted, kept]).toEqual([1, 1])
    expect(cpp).toContain('cout << "n = " << n << endl;')
    expect(cpp).toContain('#include <cstdio>')
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
