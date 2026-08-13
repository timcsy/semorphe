import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from './helpers/setup-lifter'
import { registerCppLanguage } from '../src/languages/cpp/generators'
import { SemanticInterpreter } from '../src/interpreter/interpreter'
import type { SemanticNode } from '../src/core/types'
let p: Parser, l: ReturnType<typeof createTestLifter>
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  p = new Parser(); p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  l = createTestLifter(); registerCppLanguage()
})
async function run(c: string) { const i = new SemanticInterpreter({ maxSteps: 100000 }); await i.execute(l.lift(p.parse(c)!.rootNode as never) as SemanticNode); return i.getOutput().join('') }
const H = '#include <iostream>\n#include <vector>\nusing namespace std;\n'
describe('template class', () => {
  it('a 非樣板版本', async () => {
    expect(await run(`${H}class C { public: vector<int> data; void add(int x){ data.push_back(x); } int get(int i){ return data[i]; } };\nint main(){ C c; c.add(42); cout << c.get(0) << endl; return 0; }`)).toBe('42\n')
  })
  it('b 樣板版本', async () => {
    expect(await run(`${H}template<typename T>\nclass C { public: vector<T> data; void add(T x){ data.push_back(x); } T get(int i){ return data[i]; } };\nint main(){ C<int> c; c.add(42); cout << c.get(0) << endl; return 0; }`)).toBe('42\n')
  })
})
