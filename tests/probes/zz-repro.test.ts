import { it, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { runCppDetailed } from '../helpers/run-cpp'
import type { SemanticNode } from '../../src/core/types'
const ROOT = process.cwd()
let p: Parser, lifter: ReturnType<typeof createTestLifter>
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  p = new Parser(); p.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter(); registerCppLanguage()
}, 120_000)
const CASES: [string, string][] = [
  ['deque push_back/front', `deque<int> dq; dq.push_back(3); dq.push_back(5); cout << dq.front() << dq.size();`],
  ['deque pop_front', `deque<int> dq; dq.push_back(3); dq.push_back(5); dq.pop_front(); cout << dq.front();`],
  ['deque empty', `deque<int> dq; cout << dq.empty(); dq.push_back(1); cout << dq.empty();`],
  ['deque back', `deque<int> dq; dq.push_back(3); dq.push_back(5); cout << dq.back();`],
  ['deque push_front', `deque<int> dq; dq.push_back(3); dq.push_front(9); cout << dq.front();`],
  ['set insert/count', `set<int> st; st.insert(3); st.insert(3); cout << st.size() << st.count(3);`],
  ['set 走訪', `set<int> st; st.insert(5); st.insert(1); for(int x:st) cout<<x;`],
  ['set lower_bound', `set<int> st; st.insert(1); st.insert(5); auto it=st.lower_bound(3); cout << (it!=st.end()) << *it;`],
  ['set erase', `set<int> st; st.insert(3); st.erase(3); cout << st.size();`],
  ['multiset insert', `multiset<int> ms; ms.insert(3); ms.insert(3); cout << ms.size();`],
  ['map count/erase', `map<int,int> m; m[1]=2; cout << m.count(1); m.erase(1); cout << m.size();`],
]
it('重現', async () => {
  for (const [name, body] of CASES) {
    const src = `#include <iostream>\n#include <deque>\n#include <set>\n#include <map>\n#include <vector>\nusing namespace std;\nint main(){ ${body} return 0; }\n`
    const ref = runCppDetailed(src)
    let got = ''
    try {
      const tree = lifter.lift(p.parse(src).rootNode as never) as SemanticNode
      const out: string[] = []
      const i2 = new SemanticInterpreter({ maxSteps: 300_000 })
      i2.setOutputCallback((x) => out.push(x)); await i2.execute(tree, [])
      got = out.join('')
    } catch (e) { got = `(拋錯 ${String(e).slice(0, 58)})` }
    const refOut = ref.ok ? ref.output : `(${ref.stage} 失敗)`
    console.log(`${refOut === got ? '🟢' : '🔴'} ${name.padEnd(20)} g++=${JSON.stringify(refOut)}  我們=${JSON.stringify(got)}`)
  }
}, 300_000)
