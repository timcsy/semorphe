/**
 * `cpp:var_declare_const` 的自證測——**const 參照不得被安靜地變成 const 拷貝**（第 238 刀）。
 *
 * `const int &c = x;` 走 const 那條 lift 時，參照宣告那顆沒有宣告「我的型別要接一個 `&`」（`typeSuffix`），
 * 於是 `&` 被丟掉：來回一趟變成 `const int c = x;`——之後透過 const_cast 寫回原物件，g++ 印 7，我們的程式印 3。
 * 是 const_cast 的測試讓 Cella 判出 ubConstWrite（「寫了一個定義成 const 的物件」）才抓到——判得對，送錯的是我們。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const roundTrip = (code: string): string =>
  generateCode(createTestLifter().lift(parser.parse(code)!.rootNode as never) as SemanticNode, 'cpp', apcs as unknown as StylePreset)

describe('cpp:var_declare_const：const 參照', () => {
  it('🔴 來回一趟保住 &：const int &c = x 不得變成 const int c = x', () => {
    expect(roundTrip('int main() { int x = 3; const int &c = x; return c; }\n')).toContain('const int& c = x;')
  })
  it('★ 一般的 const 照舊', () => {
    expect(roundTrip('int main() { const int N = 5; return N; }\n')).toContain('const int N = 5;')
  })
  it('★ 執行：經 const 參照看到的物件，拿掉 const 之後寫得回去（g++ 印 7）', async () => {
    await expectCellaOut('#include <iostream>\nusing namespace std;\nint main() { int x = 3; const int &c = x; const_cast<int &>(c) = 7; cout << x << c; }\n', '77')
  }, 300_000)
})
