import { it, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
let tp: Parser, lifter: any
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser(); tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
})
it('完整程式（含 include）', () => {
  const src = `#include <iostream>
#include <vector>
using namespace std;
int main() {
int x = 42;
vector<int> v;
v.push_back(x);
for (int i = 0; i < 3; i++) { cout << v[0] << endl; }
return 0;
}`
  const t = lifter.lift(tp.parse(src)!.rootNode as never)
  const ids: string[] = []
  const w = (n: any) => { ids.push(n.conceptId); Object.values(n.children ?? {}).forEach((a: any) => a.forEach(w)) }
  w(t); console.log(ids.join(' | '))
})
