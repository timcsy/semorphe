/**
 * explicit 風格的 `std::` 限定（`src/languages/cpp/std-qualify.ts`）。
 */
import { describe, it, expect } from 'vitest'
import { qualifyStd } from '../../../src/languages/cpp/std-qualify'

describe('qualifyStd', () => {
  it('★ 標準函式庫的名字加 std::', () => {
    expect(qualifyStd('vector<string> v;\ncout << v.size() << endl;'))
      .toBe('std::vector<std::string> v;\nstd::cout << v.size() << std::endl;')
  })

  it('★ 成員存取、已限定的不動；冪等', () => {
    const once = qualifyStd('std::sort(v.begin(), v.end()); p->first; a::max;')
    expect(once).toBe('std::sort(v.begin(), v.end()); p->first; a::max;')
    expect(qualifyStd(once)).toBe(once)
  })

  it('★ 字串、字元、註解、前置處理行不動', () => {
    const src = '#include <string>\n// cout here\ncout << "vector" << \'s\'; /* endl */'
    expect(qualifyStd(src)).toBe('#include <string>\n// cout here\nstd::cout << "vector" << \'s\'; /* endl */')
  })

  it('🔴 學生自己宣告的名字不動（`int count = 0;` 不是 std::count）', () => {
    expect(qualifyStd('int count = 0; count++; cout << count;', new Set(['count'])))
      .toBe('int count = 0; count++; std::cout << count;')
  })

  it('★ 跳脫的引號不會讓字串提早結束', () => {
    expect(qualifyStd('cout << "a\\"cin" << cin;')).toBe('std::cout << "a\\"cin" << std::cin;')
  })
})

/**
 * 產品路徑（產生器 → 補丁器）：explicit 風格的產出要帶 `std::`，而 using 風格不得帶。
 * 🔴 修之前課文 86 份 C++ 解答用 google 風格產回來 70 份編不過（2026-10-31，用 clang 量的；這支不依賴編譯器）。
 */
import { beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { generateCode } from '../../../src/core/projection/code-generator'
import { createCppCodePatcher } from '../../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../src/languages/cpp/std'
import google from '../../../src/languages/cpp/styles/google.json'
import apcs from '../../../src/languages/cpp/styles/apcs.json'
import type { StylePreset, SemanticNode } from '../../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

describe('產生器 → 補丁器：explicit 風格', () => {
  // ⚠️ 不寫 `using namespace std;`——學生自己寫的那一行是語義樹裡的節點，照樣保留（那是他的程式）
  const SRC = '#include <iostream>\n#include <vector>\nint count(int x) { return x; }\nint main() { vector<int> v; v.push_back(count(1)); sort(v.begin(), v.end()); cout << v.size() << endl; }'
  const run = (style: StylePreset, ns: 'using' | 'explicit'): string => {
    const tree = createTestLifter().lift(parser.parse(SRC)!.rootNode as never) as SemanticNode
    const raw = generateCode(tree, 'cpp', style)
    return createCppCodePatcher(createPopulatedRegistry() as never)(raw, tree, ns, 1, 'main') ?? raw
  }

  it('🔴 google：std 的名字都帶 std::，學生自己的 count 不帶', () => {
    const code = run(google as unknown as StylePreset, 'explicit')
    expect(code).toContain('std::vector<int> v;')
    expect(code).toContain('std::sort(v.begin(), v.end());')
    expect(code).toMatch(/std::cout << v\.size\(\) << std::endl;/)
    expect(code).toContain('v.push_back(count(1));')
    expect(code).not.toContain('using namespace std')
  })

  it('★ apcs（using）：不加 std::', () => {
    const code = run(apcs as unknown as StylePreset, 'using')
    expect(code).not.toContain('std::')
  })
})
