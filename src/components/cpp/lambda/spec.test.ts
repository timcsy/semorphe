/**
 * `cpp:lambda` 的自證測——2026-11-08：lambda 的參數原本沒有進作用域，於是本體裡 `r < M && c > -1` 這種寫法
 * 被 tree-sitter 剖成樣板時，misparse 的修補（「宣告過的變數不可能是樣板」）認不出 `r` 是變數 ⟹ 整段降級、程式翻不出
 * （學生語料 w/APCS/o713：BFS 的邊界檢查寫在 lambda 裡）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

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
const ids = (n: SemanticNode, acc: string[] = []): string[] => { acc.push(n.componentId); Object.values(n.slots ?? {}).flat().forEach((k) => ids(k, acc)); return acc }

const SRC = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int M = 3, N = 4;
    auto ok = [&](int r, int c) {
        return r > -1 && r < M && c > -1 && c < N;
    };
    cout << ok(1, 2) << ok(3, 0) << ok(0, -1) << endl;
    return 0;
}
`

describe('cpp:lambda：參數在本體裡是變數', () => {
  it('🔴 `r < M && c > -1`（參數 r、c）不被當成樣板：沒有降級，產碼一字不差', () => {
    const t = lift(SRC)
    expect(ids(t)).toContain('cpp:lambda')
    expect(ids(t)).not.toContain('unresolved')
    expect(generateCode(t, 'cpp', apcs as StylePreset)).toContain('return r > -1 && r < M && c > -1 && c < N;')
  })

  it('執行：判得出、印 100', async () => {
    await expectCellaOut(SRC, '100\n')
  })

  it('參數名不洩漏到外面：同名的外層變數照舊', () => {
    const t = lift('int main() {\n    int r = 5;\n    auto f = [](int r) { return r * 2; };\n    return f(r);\n}\n')
    expect(ids(t)).not.toContain('unresolved')
  })
})
