/**
 * 執行期值的呈現（091）——四個「印出來不對」的缺陷
 *
 * ## 起點是六支 todo，阻斷者各不相同
 *
 * `cpp_char_literal`、`cpp_cast`、`cpp_sizeof`、`cpp_enum`、`print` 各自被
 * 標成阻斷者。**四個追下去是同一類**：值算對了，**印出來或表示成別的東西**。
 *
 * | 缺陷 | 直譯器 | g++ |
 * |---|---|---|
 * | 布林 | `true` | **`1`** —— C++ 預設不是 boolalpha |
 * | 字元變數 | `66` | **`B`** |
 * | `(char)66` | `66`（int） | **`B`** |
 * | `sizeof(a)` | `4`（一律預設） | **陣列的總位元組數** |
 * | 列舉常數 | **未宣告變數** | `5` |
 *
 * **前四個都是「跑完、印出東西、而它是錯的」**——最難發現的那種。
 * 第五個至少會中斷。
 *
 * ## 列舉那個特別值得看
 *
 * `cpp_enum` 被宣告成 `declarative`（刻意不執行）。**那個宣告是錯的**——
 * 列舉要把常數放進作用域。「刻意不執行」的理由**經不起一支會用到那些常數
 * 的程式**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

async function run(body: string, decls = ''): Promise<string> {
  const src = `#include <iostream>\n#include <cstdlib>\nusing namespace std;\n${decls}\nint main(){ ${body} return 0; }`
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(lifter.lift(tp.parse(src)!.rootNode as never) as never)
  return interp.getOutput().join('')
}

describe('布林印成 1／0，不是 true／false', () => {
  it('★ 比較的結果', async () => {
    expect((await run('int x = 3; cout << (x > 2);')).trim(), 'C++ 預設不是 boolalpha').toBe('1')
  })

  it('★ 假值印 0——只驗真值的話，「一律印 1」也會過', async () => {
    expect((await run('int x = 1; cout << (x > 2);')).trim()).toBe('0')
  })
})

describe('字元印成字元，不是碼值', () => {
  it('★ 從函式回傳的字元', async () => {
    const out = await run("char g = grade(85); cout << g;", "char grade(int s) { if (s >= 90) { return 'A'; } return 'B'; }")
    expect(out.trim(), '字元變數印成了碼值').toBe('B')
  })

  it('★ `(char)66` 轉型的結果是字元', async () => {
    expect((await run('cout << (char)66;')).trim(), '轉型成 char 卻回了 int').toBe('B')
  })

  it('★ `(int)` 轉型不得被影響', async () => {
    expect((await run('cout << (int)3.9;')).trim()).toBe('3')
  })
})

describe('sizeof', () => {
  it('★ 陣列的總位元組數——`sizeof(a)/sizeof(a[0])` 是算長度的慣用寫法', async () => {
    expect(
      (await run('int a[7]; cout << sizeof(a) / sizeof(a[0]);')).trim(),
      'sizeof 一律回預設值 → 這個慣用寫法**永遠回 1**，而 1 看起來像個合理的數字',
    ).toBe('7')
  })

  it('★ 型別名仍然對——只驗變數的話會把型別那條弄壞', async () => {
    expect((await run('cout << sizeof(int);')).trim()).toBe('4')
    expect((await run('cout << sizeof(char);')).trim()).toBe('1')
  })
})

describe('列舉常數', () => {
  it('★ 有明確值的成員', async () => {
    expect(
      (await run('int c = GREEN; cout << c << " " << BLUE;', 'enum Color { RED = 1, GREEN = 5, BLUE = 9 };')).trim(),
      '列舉被宣告成「刻意不執行」→ 常數沒進作用域 → 未宣告變數',
    ).toBe('5 9')
  })

  it('★ 沒寫值的成員從前一個 +1', async () => {
    expect((await run('cout << A << B << C;', 'enum E { A = 3, B, C };')).trim()).toBe('345')
  })

  it('★ 全部沒寫值時從 0 開始', async () => {
    expect((await run('cout << X << Y;', 'enum F { X, Y };')).trim()).toBe('01')
  })
})
