/**
 * C 方言下，補丁器補的是 C 的標頭（2026-10-31，cella 比對 判決綁定語料時指出）。
 *
 * 🔴 修之前：補丁器不知道自己在補 C，C 程式被補上 `#include <cstdio>`（C 編譯器不收）；
 * `malloc`／`free` 也沒宣告 `requires`，`<stdlib.h>` 從來補不到。
 * 修之後課文 c-bridge 8 份解答用 clang -std=c11 檢查 0 份編不過（這支不依賴編譯器）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { generateCode } from '../../../src/core/projection/code-generator'
import { createCppCodePatcher, computeAutoIncludes, autoIncludeNodes } from '../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../src/languages/cpp/std'
import cStyle from '../../../src/languages/cpp/styles/c.json'
import type { StylePreset, SemanticNode } from '../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const SRC = 'int main() { int n; scanf("%d", &n); n = abs(n); int *a = (int*)malloc(n * sizeof(int)); printf("%d\\n", n); free(a); return 0; }'
const patched = (styleId?: string): string => {
  const tree = createTestLifter().lift(parser.parse(SRC)!.rootNode as never) as SemanticNode
  const raw = generateCode(tree, 'cpp', cStyle as unknown as StylePreset)
  return createCppCodePatcher(createPopulatedRegistry() as never)(raw, tree, 'explicit', 1, 'main', styleId) ?? raw
}

describe('補丁器：C 方言', () => {
  it('🔴 C 風格補 <stdio.h> 與 <stdlib.h>，不補 C++ 的 <cstdio>／<cstdlib>', () => {
    const code = patched('c')
    expect(code).toContain('#include <stdio.h>')
    expect(code).toContain('#include <stdlib.h>')
    expect(code).not.toMatch(/<cstdio>|<cstdlib>/)
  })

  it('🔴 C 方言不加 std::（C 沒有命名空間）——`abs(n)` 照原樣', () => {
    const code = patched('c')
    expect(code).toContain('abs(n)')
    expect(code).not.toContain('std::')
  })

  it('★ C++ 風格照舊是 <cstdio>／<cstdlib>', () => {
    const code = patched('google')
    expect(code).toContain('<cstdio>')
    expect(code).toContain('<cstdlib>')
  })

  it('🔴 骨架積木（也是交給 formalize 的那幾顆）與文字同一份：C 方言是 stdio.h／stdlib.h', () => {
    const tree = createTestLifter().lift(parser.parse(SRC)!.rootNode as never) as SemanticNode
    const edges = computeAutoIncludes(tree, createPopulatedRegistry() as never)
    const headers = (c: boolean): string[] => autoIncludeNodes(edges, 'explicit', c).map((n) => String(n.properties.header))
    expect(headers(true).sort()).toEqual(['stdio.h', 'stdlib.h'])
    expect(headers(false).sort()).toEqual(['cstdio', 'cstdlib'])
  })
})
