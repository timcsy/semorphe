/**
 * 指派是運算式、指標有真假值、以及不會的事要出聲（085）
 *
 * ## 三個修正，都是查 `var_assign` 那批 todo 時撞到的
 *
 * `while ((p = f()) != 0)` 這個寫法**一次都不跑**，而程式照樣跑完、印出後面
 * 的東西。追下去有三層：
 *
 * | 層 | 症狀 |
 * |---|---|
 * | 指派不回傳值 | `(y = 5) != 0` 的左邊是 undefined → 比較恆假 |
 * | 指標轉數字一律 0 | `p != 0` 對**有效的指標**也是假 |
 * | `strchr` 靜默回 0 | 找得到也回 0 —— **安靜的錯答案** |
 *
 * **三層都是靜默降級**：沒有錯誤訊息、沒有例外、輸出看起來像一段跑完的程式。
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

async function run(body: string): Promise<string> {
  const src = `#include <iostream>\n#include <cstring>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lifter.lift(tp.parse(src)!.rootNode as never) as never)
  return interp.getOutput().join('')
}

async function errOf(body: string): Promise<string> {
  try {
    await run(body)
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

describe('指派是一個運算式', () => {
  it('★ 指派求值成被指派的值', async () => {
    expect(
      (await run('int y = 0; if ((y = 5) != 0) { cout << y; }')).trim(),
      '指派不回傳值 → 比較拿到 undefined → 條件恆假，**而迴圈／分支靜靜不跑**',
    ).toBe('5')
  })

  it('★ while 條件裡的指派', async () => {
    expect((await run('int n = 3; int v = 0; while ((v = n) != 0) { cout << v; n = 0; }')).trim()).toBe('3')
  })

  it('★ 指派仍然真的寫進變數——只驗回傳值的話，一個「回傳值但不寫入」的實作也會過', async () => {
    expect((await run('int y = 0; (y = 7); cout << y;')).trim()).toBe('7')
  })
})

describe('指標的真假值', () => {
  it('★ 有效的指標 != 0 為真', async () => {
    expect(
      (await run('int x = 1; int* p = &x; if (p != 0) { cout << "yes"; }')).trim(),
      '指標轉數字一律 0 → 有效的指標也判為空',
    ).toBe('yes')
  })

  it('★ 空指標 != 0 為假——只驗前一支的話，「指標一律為真」也會過', async () => {
    expect((await run('int* p = 0; if (p != 0) { cout << "wrong"; } cout << "done";')).trim()).toBe('done')
  })
})

describe('做不到的事要出聲，不得靜默回 0', () => {
  it('★ strchr 回傳指向陣列中間的指標——這個直譯器表示不了，所以它要說', async () => {
    const 訊息 = await errOf("char s[6] = \"hello\"; char* p = strchr(s, 'l'); cout << (p != 0);")
    expect(
      訊息,
      'strchr 靜默回 0 → `strchr(...) != 0` 對找得到的字元也是假，' +
        '而程式跑完印出後面的東西。**安靜的錯答案比報錯更糟。**',
    ).toContain('cstring_find_char')
  })
})
