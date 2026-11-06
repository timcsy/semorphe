/**
 * `cpp:this` 自證測——「這個物件自己」。
 *
 * 量到的缺口（2026-11-06）：`this->x` 整段降級成看不懂的程式碼（`->` 的接收者 `this` 沒有元件認得）。
 * `this->x`、`this->f()`、`*this` 由既有的元件組出來；這顆只負責 `this` 本身。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { formalize } from '../../../providers/cella/formalize'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'
import apcs from '../../../languages/cpp/styles/apcs.json'

const style = apcs as unknown as StylePreset
let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function ids(n: SemanticNode | null, out: string[] = []): string[] {
  if (!n) return out
  out.push(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const GET = 'struct P {\n    int x;\n    int get() {\n        return this->x;\n    }\n};\n'
const run = (code: string, expected: string) => expectCellaOut(H + code, expected)

describe('cpp:this 自證測', () => {
  it('★ 這顆元件真的出現在語義樹裡，而且沒有降級', () => {
    const t = ids(lift(`${GET}int main() { P p; p.x = 7; cout << p.get(); }`))
    expect(t).toContain('cpp:this')
    expect(t.filter((i) => /raw_code|unresolved/.test(i)), '降級了').toEqual([])
  })

  it('正向：四種寫法產回去一字不差，而且是不動點', () => {
    for (const line of ['return this->x;', 'this->x = x;', 'return this->twice();', 'return *this;']) {
      const src = `struct P {\n    int x;\n    int twice() {\n        return 2 * x;\n    }\n    P& f(int x) {\n        ${line}\n    }\n};\n`
      const out = generateCode(lift(src)!, 'cpp', style)
      expect(out, line).toContain(line)
      expect(generateCode(lift(out)!, 'cpp', style), `${line} 不動點`).toBe(out)
    }
  })

  it('🔴 明寫的 this->x 與隱含的 x 各自保留（產碼不互換）', () => {
    const explicit = generateCode(lift(`${GET}`)!, 'cpp', style)
    expect(explicit).toContain('return this->x;')
    const implicit = generateCode(lift('struct P {\n    int x;\n    int get() {\n        return x;\n    }\n};\n')!, 'cpp', style)
    expect(implicit).toContain('return x;')
    expect(implicit).not.toContain('this')
  })

  it('交給 Cella：明寫的是 eArrow(eThis)，隱含的送名字（eName——由 Cella 依作用域解析成 eSelf，cella 0.1.202611052225）', () => {
    const explicit = JSON.stringify(formalize(lift(H + GET + 'int main() { P p; cout << p.get(); }')!, {}).program)
    expect(explicit).toContain('"k":"eThis"')
    expect(explicit).toMatch(/"k":"eArrow"[^}]*"a":\{"k":"eThis"/)
    const implicit = JSON.stringify(formalize(lift(H + 'struct P { int x; int get() { return x; } };\nint main() { P p; cout << p.get(); }')!, {}).program)
    // 名字交給 Cella 解析（「意思歸 Cella」）：我們送寫出來的名字，它在方法裡查到類別的欄位就換成 eSelf
    expect(implicit).toMatch(/"k":"eName","n":"[^"]+","name":"x"/)
    expect(implicit).not.toContain('eThis')
  })

  it('積木：畫得出「這個物件」那一顆', () => {
    const state = JSON.stringify(renderToBlocklyState(lift(`${GET}`)!))
    expect(state).toContain('"type":"cpp_this"')
  })

  it('執行：this->x 讀到的是這個物件的欄位', async () => {
    await run(`${GET}int main() { P p; p.x = 7; cout << p.get(); }`, '7')
  })
  it('執行：建構子裡 this->x = x（參數遮蔽成員）', async () => {
    await run('struct P {\n    int x;\n    P(int x) { this->x = x; }\n};\nint main() { P p(5); cout << p.x; }', '5')
  })
  it('執行：this->方法()', async () => {
    await run('struct P {\n    int x;\n    int twice() { return 2 * x; }\n    int g() { return this->twice(); }\n};\nint main() { P p; p.x = 4; cout << p.g(); }', '8')
  })
  it('執行：return *this 串接呼叫', async () => {
    await run('struct P {\n    int x;\n    P& inc() { x++; return *this; }\n};\nint main() { P p; p.x = 1; p.inc().inc(); cout << p.x; }', '3')
  })
})
