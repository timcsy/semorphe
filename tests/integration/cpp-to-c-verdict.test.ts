/**
 * **C++ → C 沒有失真**——跨語言互轉第一對的反方向（357，`knowledge/draft/2026-11-07-Lean4課程與跨語言互轉——以Cella為根基.md` 的第 4 條）。
 *
 * 判準與 `c-to-cpp-verdict` 相同：兩邊交給 Cella 判，判決、輸出、`assumes` 相同。
 *
 * ```
 * C++ 原文 ──lift──▶ 語意樹 ──convertCppToC──▶ 新樹 ──產碼（C 風格，型別由 Cella 給 ＋ 補丁器）──▶ C
 *   └──────────── Cella（lang cpp）                                              Cella（lang c）──┘
 * ```
 *
 * 兩組：
 * - **來回一趟**：c-bridge 課文的 C 解答 → C++（`convertCToCpp`）→ 回到 C，和原本的 C 判決相同（兩個方向都齊之後收成護欄，就是那條第 4 條）
 * - **直接從 C++ 來**：new／delete、`std::endl`、字元與浮點的輸出；換了會變意思（或是 UB）的照實保留
 *
 * ⚠️ 正向錨點：來回那一組斷言「真的換回去了」（C 那一側沒有 cout／new）——否則什麼都沒換也會兩邊相同。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode, setDependencyResolver, setExpressionTypes } from '../../src/core/projection/code-generator'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { createCppCodePatcher } from '../../src/languages/cpp/auto-include'
import { convertCToCpp } from '../../src/languages/cpp/c-to-cpp'
import { convertCppToC } from '../../src/languages/cpp/cpp-to-c'
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

const lift = (src: string): SemanticNode => {
  const t = lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
  expect(t, 'lift 回了 null').not.toBeNull()
  return t
}

async function toCpp(src: string): Promise<string> {
  const tree = lift(src)
  const r = convertCToCpp(tree, await cellaTypesOfTree(tree, { lang: 'c' }))
  const code = generateCode(r.tree, 'cpp', apcs as StylePreset)
  return patch(code, r.tree, 'using', 2, 'main', 'apcs') ?? code
}

/** 與產品切換方言同一條：問 Cella 舊程式（C++）的型別 → 樹上換 → 用 C 風格產碼（產生器照型別寫 printf） */
async function toC(cpp: string): Promise<{ c: string; converted: number; kept: number }> {
  const tree = lift(cpp)
  const types = await cellaTypesOfTree(tree, { lang: 'cpp' })
  const r = convertCppToC(tree, types)
  setExpressionTypes(types)
  try {
    const code = generateCode(r.tree, 'cpp', cStyle as StylePreset)
    return { c: patch(code, r.tree, 'explicit', 2, 'main', 'c') ?? code, converted: r.converted, kept: r.kept }
  } finally {
    setExpressionTypes(null)
  }
}

async function sameVerdict(a: { src: string; lang: 'c' | 'cpp' }, c: string, stdin = ''): Promise<void> {
  const x = await runCella(a.src, { lang: a.lang, stdin })
  const y = await runCella(c, { lang: 'c', stdin })
  const show = `\n--- C ---\n${c}\n--- ${a.lang}: ${x.verdict} ${JSON.stringify(x.out)} / C: ${y.verdict} ${JSON.stringify(y.out)} ${JSON.stringify(y.problems?.map((p) => p.reason ?? p.kind))}`
  expect(x.verdict, `原本那一側就不是 accept——測資或原文錯了${show}`).toBe('accept')
  expect(y.verdict, show).toBe(x.verdict)
  expect(y.out, show).toBe(x.out)
  expect(y.assumes ?? [], show).toEqual(x.assumes ?? [])
}

describe('C → C++ → C：c-bridge 課文的解答來回一趟', () => {
  const files = fs.readdirSync('lessons/c-bridge', { recursive: true }).map(String)
    .filter((f) => f.endsWith('.c')).map((f) => `lessons/c-bridge/${f}`)

  it('入口：讀到了課文的 C 解答', () => {
    expect(files.length).toBeGreaterThanOrEqual(8)
  })

  for (const f of files) {
    it(f.replace('lessons/c-bridge/', ''), async () => {
      const src = fs.readFileSync(f, 'utf8')
      const lesson = JSON.parse(fs.readFileSync(f.replace(/solutions\/.*/, 'lesson.json'), 'utf8'))
      const stem = path.basename(f, '.c').split('~')[0]
      const task = lesson.tasks.find((t: { id: string }) => t.id === stem)
      const stdin = ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
      const cpp = await toCpp(src)
      const { c } = await toC(cpp)
      // 正向錨點：C++ 的寫法都換回去了
      expect(c, c).not.toMatch(/\bcout\b|\bcin\b|\bnew\b|\bdelete\b|using namespace|#include <(iostream|cstdio|cstdlib|cstring)>/)
      if (/\bmalloc\s*\(/.test(src)) expect(c, c).toMatch(/\bmalloc\s*\([\s\S]*\bfree\s*\(/)
      await sameVerdict({ src, lang: 'c' }, c, stdin)
    })
  }
})

describe('C++ → C：直接從 C++ 來', () => {
  it('🟢 new[]／delete[] → malloc／free（陣列），new／delete → malloc(sizeof)／free（單一，透過 * 取值）', async () => {
    const cpp = '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 4;\n    int* a = new int[n];\n    double* d = new double;\n    for (int i = 0; i < n; i++) {\n        a[i] = i * 10;\n    }\n    *d = 2.5;\n    cout << a[3] << " " << *d << endl;\n    delete[] a;\n    delete d;\n    return 0;\n}\n'
    const { c, converted, kept } = await toC(cpp)
    expect(c).toContain('int* a = (int*)malloc(n * sizeof(int));')
    expect(c).toContain('double* d = (double*)malloc(sizeof(double));')
    expect(c).toContain('free(a);')
    expect(c).toContain('free(d);')
    expect(c).toContain('#include <stdlib.h>')
    expect([converted, kept]).toEqual([4, 0])
    await sameVerdict({ src: cpp, lang: 'cpp' }, c)
  })

  it('🔴 `std::endl`／`std::cout`（explicit 寫法）：endl 是換行，不是一個值；字元印 %c、浮點印 %g', async () => {
    const cpp = '#include <iostream>\nint main() {\n    int n = 3;\n    char ch = \'Z\';\n    double x = 1.5;\n    std::cout << n << " " << ch << " " << x << std::endl;\n    return 0;\n}\n'
    const { c } = await toC(cpp)
    expect(c).toContain('printf("%d %c %g\\n", n, ch, x);')
    expect(c).not.toContain('std::')
    await sameVerdict({ src: cpp, lang: 'cpp' }, c)
  })

  it('🟢 struct 的單一 new（`P* p = new P;`）→ `struct P* p = (struct P*)malloc(sizeof(struct P));`（C 要寫 struct 標籤）', async () => {
    const cpp = '#include <iostream>\nusing namespace std;\nstruct P {\n    int x;\n};\nint main() {\n    P* p = new P;\n    p->x = 7;\n    cout << p->x << endl;\n    delete p;\n    return 0;\n}\n'
    const { c, converted } = await toC(cpp)
    expect(c, c).toMatch(/\bmalloc\s*\(sizeof\(struct P\)\)/)
    expect(converted).toBe(2)
    await sameVerdict({ src: cpp, lang: 'cpp' }, c)
  })

  for (const k of [
    { name: '別名（`int* q = a; delete[] q;`）：delete 的對象不在名單上 ⟹ 整支不換', body: '    int* a = new int[3];\n    int* q = a;\n    a[0] = 5;\n    cout << q[0] << endl;\n    delete[] q;\n' },
    { name: '有初始值的 new（`new int(5)`）：malloc 不初始化 ⟹ 不換', body: '    int* p = new int(5);\n    cout << *p << endl;\n    delete p;\n' },
    { name: '指標本身被改（`p++`）⟹ 不換', body: '    int* a = new int[3];\n    a[0] = 1;\n    a[1] = 2;\n    int* p = a;\n    p++;\n    cout << *p << endl;\n    delete[] a;\n' },
  ]) {
    it(k.name, async () => {
      const cpp = `#include <iostream>\nusing namespace std;\nint main() {\n${k.body}    return 0;\n}\n`
      const { c, converted, kept } = await toC(cpp)
      expect(converted, c).toBe(0)
      expect(kept, c).toBeGreaterThan(0)
      expect(c, c).toMatch(/\bnew\b/)
      expect(c, c).not.toMatch(/\bmalloc\s*\(/)
      // 保留下來的 new 在 C 裡不合法——Cella 照實說，不是我們替它藏起來
      expect((await runCella(c, { lang: 'c' })).verdict, c).toBe('reject')
    })
  }
})
