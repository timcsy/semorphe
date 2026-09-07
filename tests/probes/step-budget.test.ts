/** 探針：訂 `stepBudget` 之前，先量那一題真的跑幾步。 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { stepsOf } from '../../src/core/steps'
import { REPO_ROOT } from '../helpers/guardrail'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${REPO_ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${REPO_ROOT}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

const H = '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n'

async function steps(code: string): Promise<number> {
  const tree = createTestLifter().lift(parser.parse(H + code)!.rootNode as never) as SemanticNode
  const it = new SemanticInterpreter()
  await it.execute(tree, [])
  return stepsOf(it.getVisitCounts())
}

describe('探針：那一題跑幾步', () => {
  it('量 O(n log n) 與 O(n²) 兩版', async () => {
    const sorted = await steps(`int main() {
    vector<int> v = {5, 2, 8, 1};
    sort(v.begin(), v.end());
    int best = v[1] - v[0];
    for (int i = 2; i < 4; i++) {
        int d = v[i] - v[i - 1];
        if (d < best) best = d;
    }
    cout << best << endl;
    return 0;
}`)
    const naive = await steps(`int main() {
    vector<int> v = {5, 2, 8, 1};
    int best = 999;
    for (int i = 0; i < 4; i++) {
        for (int j = i + 1; j < 4; j++) {
            int d = v[j] - v[i];
            if (d < 0) d = -d;
            if (d < best) best = d;
        }
    }
    cout << best << endl;
    return 0;
}`)
    console.log(`\n【排序版】${sorted} 步\n【兩兩比】${naive} 步\n【倍數】${(naive / sorted).toFixed(2)}\n`)
    expect(sorted).toBeGreaterThan(0)
  }, 120_000)
})
