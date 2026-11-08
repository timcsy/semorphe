/**
 * `cpp:array_declare` 的自證測——初值的三種寫法（第 394 刀起）。
 *
 * 🔴 字元陣列用一個字串字面量初始化時不加大括號（`char s[20] = "Semorphe";`）；
 *    在此之前產成 `{"Semorphe"}`，那不是學生寫的那份，formalize 也因此被 Cella 判型別不合。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import { expectCellaOut, runCella } from '../../../../tests/helpers/cella-run'
import type { StylePreset } from '../../../core/types'

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  registerCppLanguage()
})

const decl = (type: string, values: ReturnType<typeof createNode>[] | undefined): string =>
  generateCode(createNode('cpp:program', {}, { body: [
    createNode('cpp:array_declare', { type, name: 'a' }, { size: [createNode('cpp:literal_number', { value: '20' })], ...(values ? { values } : {}) }),
  ] }), 'cpp', apcs as unknown as StylePreset)
const str = (v: string): ReturnType<typeof createNode> => createNode('cpp:literal_string', { value: v })

describe('膠囊自證：cpp:array_declare', () => {
  it('🔴 字元陣列的字串初值：不加大括號', () => {
    expect(decl('char', [str('Semorphe')])).toContain('char a[20] = "Semorphe";')
  })

  it('★ 字串的陣列、數字的陣列：照舊是大括號', () => {
    expect(decl('string', [str('a')])).toContain('string a[20] = {"a"};')
    expect(decl('int', [createNode('cpp:literal_number', { value: '1' }), createNode('cpp:literal_number', { value: '2' })])).toContain('int a[20] = {1, 2};')
  })

  it('★ 沒有初值：不產 `= {}`', () => {
    expect(decl('int', undefined)).toContain('int a[20];')
  })
})

/**
 * 🟢 **長度是運算式：交給 Cella 判**（2026-11-06，cella 0.1.202611060800 的 `tArrE`）。
 * 我們只在長度是整數字面時自己送 `tArr`；其餘原樣交出去，由 Cella 判它是常數還是 VLA（C 與 C++ 不同）。
 */
describe('Cella 0759／1710 接上的構造：陣列長度運算式、tuple、long double', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  it('★ 常數運算式（const int 與算式）、二維、區域的 VLA：判 accept、輸出對', async () => {
    await expectCellaOut(H + 'const int N = 105;\nint a[N * 2 + 1];\nint g[N][N];\nint main() {\n    int n = 3;\n    int d[n];\n    d[0] = 7;\n    a[200] = 2;\n    g[104][104] = 9;\n    cout << a[200] << d[0] << g[104][104] << endl;\n}\n', '279\n')
  }, 120_000)
  it('★ 檔案範圍用變數當長度：判 reject（以前是我們這側標翻不出）', async () => {
    const r = await runCella(H + 'int n = 3;\nint bad[n];\nint main() {\n}\n')
    expect(r.untranslated).toEqual([])
    expect(r.verdict).toBe('reject')
  }, 120_000)
  it('★ 沒寫長度、用字串初始化（`char w[] = "…"`）：送 tArrU，長度由 Cella 照 C11 6.7.9p14 定（跳脫照實算、含結尾 NUL）——以前是我們這側標翻不出', async () => {
    const C = '#include <stdio.h>\n'
    await expectCellaOut(C + 'int main(void) {\n    char word[] = "hello";\n    char w[] = "a\\tb\\n";\n    printf("%d %s %d\\n", (int)sizeof(word), word, (int)sizeof(w));\n    return 0;\n}\n', '6 hello 5\n', { lang: 'c' })
    await expectCellaOut(H + 'int main() {\n    char w[] = "abc";\n    cout << sizeof(w) << endl;\n}\n', '4\n')
  }, 120_000)
  it('★ 沒長度也沒初值（`int a[];`）：照樣送出、由 Cella 判 reject（不完整型別）', async () => {
    const r = await runCella('int main(void) {\n    int a[];\n    return 0;\n}\n', { lang: 'c' })
    expect(r.untranslated).toEqual([])
    expect(r.verdict).toBe('reject')
  }, 120_000)
  it('★ long double：型別與 L 後綴的字面量（tLongDouble；判決帶 x86-64-sysv／longDouble.x87Extended 的假設——cella 0.1.202611061710）', async () => {
    const r = await expectCellaOut(H + 'int main() {\n    long double x = 1.0L / 3;\n    cout << sizeof(long double) << endl;\n    cout << fixed << setprecision(10) << x << endl;\n}\n', '16\n0.3333333333\n')
    expect(r.assumes).toContainEqual({ implementation: 'x86-64-sysv', choice: 'longDouble.x87Extended' })
  }, 120_000)
  it('★ tuple：get<N> 讀寫、queue 裝 tuple、結構化繫結（eCallT，同一版）', async () => {
    await expectCellaOut(H + 'int main() {\n    tuple<int, int, int> t = make_tuple(1, 2, 3);\n    get<1>(t) = 5;\n    cout << get<0>(t) << get<1>(t) << get<2>(t) << endl;\n    queue<tuple<int, int, int>> q;\n    q.push({4, 5, 6});\n    auto [r, c, d] = q.front();\n    cout << r + c + d << endl;\n}\n', '153\n15\n')
  }, 120_000)
})
