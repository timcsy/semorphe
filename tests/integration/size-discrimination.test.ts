/**
 * **`.size()` 的辨識與靜默回退**（`specs/110`）。
 *
 * 兩個病疊在一起，而第二個讓第一個看不見：
 *
 * ```
 * s.length()  →  cpp:string_size{obj:s}   ✅
 * s.size()    →  cpp:vector_size{obj:s}   ← 身分錯
 *                cpp:vector_size 對非陣列回 0  ← 讓上面那行看不見
 * ```
 *
 * 後果：`for (int i = 0; i < s.size(); i++)` **一次都不跑**，
 * 字串原樣輸出，而沒有任何地方說出錯了。19 筆誤差裡的 5 筆整叢是這個。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n'
async function run(bodyText: string): Promise<string> {
  const tree = parser.parse(H + bodyText)
  const t = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(t)
  return i.getOutput().join('')
}

describe('`.size()` 在字串上要與 `.length()` 同義', () => {
  it('★ s.size() 回字元數', async () => {
    expect(await run(`int main(){ string s="abc"; cout << s.size(); }`)).toBe('3')
  })

  it('★ 對照組：s.length() 本來就對，不得回歸', async () => {
    expect(await run(`int main(){ string s="abc"; cout << s.length(); }`)).toBe('3')
  })

  it('★ 用 size() 當迴圈條件要跑滿（這是那 5 筆的形狀）', async () => {
    expect(
      await run(`int main(){ string s="abc"; for(int i=0;i<s.size();i++) cout<<s[i]; }`),
    ).toBe('abc')
  })

  it('★ 對照組：真的容器的 size() 不得回歸', async () => {
    expect(await run(`int main(){ vector<int> v={1,2,3}; cout << v.size(); }`)).toBe('3')
  })

  it('★ 對照組：空容器的 size() 仍然是 0（FR-004，反向不可省）', async () => {
    // 沒有這一支，「一律丟錯」也會通過「非容器要出聲」那一條。
    expect(await run(`int main(){ vector<int> v; cout << v.size(); }`)).toBe('0')
  })
})
