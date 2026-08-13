import { describe, it, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from './helpers/setup-lifter'
import { registerCppLanguage } from '../src/languages/cpp/generators'
import { SemanticInterpreter } from '../src/interpreter/interpreter'
import type { SemanticNode } from '../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\n#include <vector>\n#include <map>\n#include <queue>\n#include <string>\nusing namespace std;\n'
const S: Record<string, string> = {
  mapIter: `int main(){ map<string,int> m; m["a"]=1; for(auto& kv : m) cout << kv.first << kv.second; }`,
  vec2d: `int main(){ vector<vector<int>> g(2, vector<int>(3, 7)); cout << g[1][2]; }`,
  vec2dPush: `int main(){ vector<vector<int>> g; vector<int> r; r.push_back(5); g.push_back(r); cout << g[0][0]; }`,
  minHeap: `int main(){ priority_queue<int, vector<int>, greater<int>> pq; pq.push(3); pq.push(1); cout << pq.top(); }`,
  maxHeap: `int main(){ priority_queue<int> pq; pq.push(3); pq.push(1); cout << pq.top(); }`,
  braceInit: `struct P { int x; }; int main(){ P a{3}; cout << a.x; }`,
}

const walk = (n: SemanticNode, out: string[] = [], d = 0): string[] => {
  const raw = n.conceptId === 'raw_code' || n.conceptId === 'unresolved'
    ? ` ⟪${String(n.metadata?.rawCode ?? '').slice(0, 40)}⟫` : ''
  out.push(`${'  '.repeat(d)}${n.conceptId}${raw} ${JSON.stringify(n.properties ?? {}).slice(0, 90)}`)
  for (const b of Object.values(n.children ?? {})) for (const c of b ?? []) walk(c, out, d + 1)
  return out
}

describe('probe', () => {
  for (const [name, body] of Object.entries(S)) {
    it(name, async () => {
      const st = createTestLifter().lift(parser.parse(H + body)!.rootNode as never) as SemanticNode
      const i = new SemanticInterpreter({ maxSteps: 100000 })
      let out = ''
      try { await i.execute(st); out = i.getOutput().join('') } catch (e) { out = `✘ ${(e as Error).message}` }
      const main = st.children.body?.find(n => n.properties?.name === 'main')
      console.log(`\n━━ ${name}  OUT ${JSON.stringify(out)}\n${walk(main ?? st).slice(0, 22).join('\n')}`)
    })
  }
})
