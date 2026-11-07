/**
 * `cpp:malloc` 的**自證測**——2026-11-07（C → C++ 第二刀前量到）：C 的慣用寫法 `int *a = malloc(n);`（不轉型）
 * lift 成 `type: 'void'`，產生器照寫成 `(void)malloc(n)`——**來回一趟就編不過**；formalize 也翻不出（「型別 void 還沒有對應」）。
 * 改成 `void*` ＝ 沒有轉型：產碼不寫轉型、formalize 不包 eCast，`void*` → `int*` 的隱含轉換合不合法交給 Cella 照語言判。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { runCella, expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import cStyle from '../../../languages/cpp/styles/c.json'

let tsParser: Parser
let lifter: Lifter
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode
const find = (n: SemanticNode, id: string, out: SemanticNode[] = []): SemanticNode[] => {
  if (n.componentId === id) out.push(n)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) find(k, id, out)
  return out
}
const UNCAST = `#include <stdio.h>
#include <stdlib.h>
int main() {
    int *a = malloc(3 * sizeof(int));
    a[0] = 5;
    printf("%d\\n", a[0]);
    free(a);
    return 0;
}`

describe('cpp:malloc 自證測', () => {
  it('lift：不轉型 → type void*；轉型 → 那個指標型別', () => {
    const ms = find(lift(UNCAST), 'cpp:malloc')
    expect(ms.map((m) => m.properties.type)).toEqual(['void*'])
    expect(ms.map((m) => m.properties.sizeof_type)).toEqual(['int'])
    const cast = find(lift('int main() { double *d = (double*)malloc(8); return 0; }'), 'cpp:malloc')
    expect(cast.map((m) => m.properties.type)).toEqual(['double*'])
  })

  it('🔴 引數拆成「個數 × sizeof(型別)」——積木上兩格的形狀（否則走一趟積木大小會變）', () => {
    const t = lift('int main() { int *a = (int*)malloc(3 * sizeof(int)); char *s = (char*)malloc(10); long *l = (long*)malloc(sizeof(long) * 2); return 0; }')
    const ms = find(t, 'cpp:malloc')
    expect(ms.map((m) => m.properties.sizeof_type)).toEqual(['int', 'none', 'none'])
    const out = generateCode(t, 'cpp', cStyle as StylePreset)
    expect(out).toContain('(int*)malloc(3 * sizeof(int))')
    expect(out).toContain('(char*)malloc(10)')
    expect(out).toContain('(long*)malloc(sizeof(long) * 2)')
  })

  it('🔴 產碼：不轉型的照寫 malloc(…)，不寫成 (void)malloc(…)', () => {
    const out = generateCode(lift(UNCAST), 'cpp', cStyle as StylePreset)
    expect(out).toContain('int* a = malloc(3 * sizeof(int));')
    expect(out).not.toContain('(void)')
  })

  it('舊的樹（type: void）照樣不寫轉型', () => {
    const t = lift(UNCAST)
    find(t, 'cpp:malloc')[0].properties.type = 'void'
    expect(generateCode(t, 'cpp', cStyle as StylePreset)).toContain('= malloc(3 * sizeof(int));')
  })

  it('執行（C）：判得出、印出 5', async () => {
    await expectCellaOut(UNCAST, '5\n', { lang: 'c' })
  })

  it('執行（C++）：`void*` 不會隱含轉成 `int*`——不能是 accept', async () => {
    const r = await runCella(UNCAST, { lang: 'cpp' })
    expect(r.verdict, JSON.stringify(r.problems?.slice(0, 2))).not.toBe('accept')
    expect(r.verdict).not.toBe('untranslated')
  })
})
