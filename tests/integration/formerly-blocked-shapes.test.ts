/**
 * 從 `describe.skip` 轉正的五個形狀（2026-10-31 大掃除）。
 *
 * 它們原本是 fuzz 檔裡的空本體 skip，標著 `[BLOCKED:…]`——而探針實測五個都早就好了，
 * 只是沒有人把 skip 拿掉，於是**它們修好之後沒有任何測試守著**。
 *
 * 而驗的時候多抓到一個真缺陷：`cout << (a && b)` 產回 `cout << ((a && b))`
 * ——使用者的括號被 `generateExpression` 補了一次，`needsParensInCout` 又補一次。
 * 與 `precedence.ts` 的 `genChild` 是同一條，`<<` 那一路漏了。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { createTestLifter } from '../helpers/setup-lifter'
import { runCella, describeCellaResult } from '../helpers/cella-run'
// 🔴 spec 202（重構 6c-2d）：執行判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）——判不出、翻不出、判定有錯都丟出說得出原因的錯。
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const gen = (t: SemanticNode): string => generateCode(t, 'cpp', apcs as unknown as StylePreset)
const ids = (n: SemanticNode, o: string[] = []): string[] => {
  o.push(n.componentId)
  for (const k of Object.values(n.slots ?? {})) for (const c of k) ids(c, o)
  return o
}
const run = async (c: string): Promise<string> => {
  const r = await runCella(c)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

const HEAD = '#include <iostream>\nusing namespace std;\n'
// [名字, 程式, 產回的程式碼必須包含的一行, 跑出來的輸出]
const CASES: Array<[string, string, string, string]> = [
  ['cout 裡的括號布林運算式', `${HEAD}int main(){ int a=1,b=0; double f=-1; cout << (a && b) << (f < 0) << endl; }`,
    'cout << (a && b) << (f < 0) << endl;', '01\n'],
  ['初始值裡的後綴遞增', `${HEAD}int main(){ int a=5; int b = a++; cout << a << b << endl; }`, 'int b = a++;', '65\n'],
  ['switch 沒有 break 會往下掉', `${HEAD}int main(){ int x=1; switch(x){ case 1: cout << "a"; case 2: cout << "b"; break; default: cout << "c"; } }`,
    'case 2:', 'ab'],
  ['char 字面的 case 標籤', `${HEAD}int main(){ char c='b'; switch(c){ case 'a': cout << 1; break; case 'b': cout << 2; break; } }`,
    "case 'a':", '2'],
  ['陣列的初始值串列', `${HEAD}int main(){ int arr[] = {1, 2, 3}; cout << arr[0] + arr[2]; }`, 'int arr[] = {1, 2, 3};', '4'],
]

describe('從 skip 轉正的形狀', () => {
  it.each(CASES)('★ %s：lift 不落殘差、產回原樣、來回穩定', (_name, src, line) => {
    const t = lift(src)
    expect(ids(t)).not.toContain('cpp:raw_code')
    const once = gen(t)
    expect(once).toContain(line)
    expect(gen(lift(once))).toBe(once)
  })

  it.each(CASES)('★ %s：原文與產回的程式跑出同樣的東西', async (_name, src, _line, out) => {
    expect(await run(src)).toBe(out)
    expect(await run(gen(lift(src)))).toBe(out)
  })

  it('★ 使用者的括號不被括第二次——修之前是 cout << ((a && b))', () => {
    expect(gen(lift(`${HEAD}int main(){ int a=1,b=0; cout << (a && b) << (a < b); }`))).not.toContain('((')
  })
})
