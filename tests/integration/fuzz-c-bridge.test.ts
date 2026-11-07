/**
 * **C 程式盲測回歸**（2026-11-07，component-fuzz：出題的代理不知道我們的實作；10 支 C 程式在 `tests/fixtures/fuzz-c-bridge.json`）。
 *
 * 起因：準備 C → C++ 時連續挖出四個「靜默改寫」，而它們都只在 C 的寫法上露出來——常駐語料（StudyCpp、課文）是 C++。
 * 這一輪又抓到六個（報告 `tests/reports/fuzz-c-bridge-20261107.md`），全部是**形狀層**的：產出的程式碼是另一支程式。
 *
 * 這支測的是「確認層不失真」，不是「判得出」：
 * - 每一支：lift → 產碼 → 再 lift 是同一棵樹；原文與產出交給 Cella 的結果相同（判得出就判決相同，翻不出就兩邊都翻不出）。
 * - 每個抓到的缺陷各一條精確的斷言（產出裡**有**那一行、**沒有**那個錯的寫法）。
 * ⚠️ 不呼叫 gcc：npm test 的判準只剩 Cella（6c-5）。盲測當時用 gcc 對過輸出，記在報告裡。
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
import { runCella, knownCellaGap } from '../helpers/cella-run'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

interface Prog { id: string; code: string; description: string }
const progs: Prog[] = JSON.parse(fs.readFileSync('tests/fixtures/fuzz-c-bridge.json', 'utf8'))

let parser: Parser
let lifter: Lifter
let patch: ReturnType<typeof createCppCodePatcher>
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  const reg = createPopulatedRegistry()
  setDependencyResolver(reg as never)
  patch = createCppCodePatcher(reg as never)
})

const lift = (src: string): SemanticNode => lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode): string => { const g = generateCode(t, 'cpp', cStyle as StylePreset); return patch(g, t, 'explicit', 2, 'main', 'c') ?? g }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)])]
const ids = (n: SemanticNode, acc: string[] = []): string[] => { acc.push(n.componentId); Object.values(n.slots ?? {}).flat().forEach((k) => ids(k, acc)); return acc }
const byId = (id: string): string => progs.find((p) => p.id === id)!.code

describe('C 盲測：每一支來回不走樣、交給 Cella 的結果相同', () => {
  it('入口：讀到 10 支', () => expect(progs.length).toBe(10))
  for (const p of progs) {
    it(`${p.id}：${p.description.slice(0, 40)}`, async () => {
      const t1 = lift(p.code)
      expect(ids(t1)).toContain('cpp:func_def')
      const out = gen(t1)
      expect(JSON.stringify(shape(lift(out))), `走樣：\n${out}`).toBe(JSON.stringify(shape(t1)))
      if (p.id === 'fuzz_1') return // 4[arr]：Cella 誤判，見下面那條釘子
      const a = await runCella(p.code, { lang: 'c' })
      const b = await runCella(out, { lang: 'c' })
      expect([b.verdict, b.out], `原文 ${a.verdict}／產出 ${b.verdict}\n${out}`).toEqual([a.verdict, a.out])
    })
  }
})

describe('C 盲測抓到的靜默改寫——每個一條', () => {
  it('🔴 typedef：認得的照實記，認不得的照原文降級，再也不編出 mytype', () => {
    const src = 'typedef int *IntPtr;\ntypedef const char *CStr;\ntypedef struct Node Node;\ntypedef struct { int x, y; } Point;\ntypedef int (*binop)(int, int);\ntypedef int Arr[10];\nint main() {\n    return 0;\n}\n'
    const out = gen(lift(src))
    for (const line of ['typedef int* IntPtr;', 'typedef const char* CStr;', 'typedef struct Node Node;',
      'typedef struct { int x, y; } Point;', 'typedef int (*binop)(int, int);', 'typedef int Arr[10];']) expect(out).toContain(line)
    expect(out).not.toContain('mytype')
  })

  it('🔴 多維陣列參數：名字與第二維以後的大小都在（`int m[ROWS][COLS]` 曾經變成 `int COLS[]`）', () => {
    const out = gen(lift('#define R 3\n#define C 4\nvoid fill(int m[R][C], int r, int c, int g[r][c]) {\n}\nint main() {\n    return 0;\n}\n'))
    expect(out).toContain('void fill(int m[][C], int r, int c, int g[][c])')
  })

  it('🔴 函式指標與指向陣列的指標參數：照原文（曾經變成 `void map(Node* h, int)`、`int row_sum(int[], int n)`）', () => {
    const out = gen(lift('void map(int *h, int (*f)(int)) {\n}\nint row_sum(int (*row)[4], int n) {\n    return n;\n}\nint main() {\n    return 0;\n}\n'))
    expect(out).toContain('void map(int* h, int (*f)(int))')
    expect(out).toContain('int row_sum(int (*row)[4], int n)')
  })

  it('🔴 使用者自己定義的 map：是呼叫它，不是 Arduino 的 map(value, fromLow, …)（曾經補出 `map(head, twice, , , )`）', () => {
    const t = lift('void map(int *h, int (*f)(int)) {\n}\nint tw(int x) {\n    return x;\n}\nint main() {\n    int a = 1;\n    map(&a, tw);\n    return 0;\n}\n')
    expect(ids(t)).not.toContain('cpp:range_remap')
    expect(gen(t)).toContain('map(&a, tw);')
  })

  it('🔴 被剖成運算式的宣告（`int (*row)[4] = 0;`）照原文降級——曾經變成 `(int)*row[4] = 0;`', () => {
    const out = gen(lift('int main() {\n    int (*row)[4] = 0;\n    return 0;\n}\n'))
    expect(out).toContain('int (*row)[4] = 0;')
    expect(out).not.toContain('(int)*row')
  })

  it('fuzz_3 那一支：區域的 `int (*row)[COLS] = m;` 照原文', () => {
    expect(gen(lift(byId('fuzz_3')))).toContain('int (*row)[COLS] = m;')
  })
})

describe('Cella 那一側的已知缺口', () => {
  it('`4[arr]`（C 允許下標的兩邊對調，[expr.sub]／C11 6.5.2.1）被判 reject——已回報', async () => {
    await knownCellaGap(/subscripted value is not an array or pointer/, async () => {
      const r = await runCella('#include <stdio.h>\nint main() {\n    int arr[] = {1, 2, 3, 4, 5};\n    printf("%d\\n", 4[arr]);\n    return 0;\n}\n', { lang: 'c' })
      expect(r.verdict, JSON.stringify(r.problems?.slice(0, 1))).toBe('accept')
    })
  })
})
