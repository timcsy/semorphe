/**
 * 字串搜尋的起點與 npos（092）
 *
 * ## 起點是三支阻斷者不同的 todo，而它們共用一個根因
 *
 * `var_assign`（掃描迴圈）、`print`（括號布林運算式）、逗號運算子——
 * 三個標記各不相同。實測之後：
 *
 * | | 結果 |
 * |---|---|
 * | 括號布林運算式 | **早就正確**（091 修好布林輸出之後） |
 * | 逗號運算子 | **早就正確** |
 * | 掃描迴圈 | **真的壞** —— 兩個 bug 疊在一起 |
 *
 * ## 兩個 bug
 *
 * | 缺陷 | 後果 |
 * |---|---|
 * | 搜尋的**起點參數被丟掉** | `s.find("X", pos)` 永遠從頭找 → **無限迴圈** |
 * | 找不到時回 `4294967295` | 使用者寫 `!= -1` 的話，那個比較**永遠成立** |
 *
 * 兩個湊在一起的症狀是**爆步數上限**——離現場很遠，而且看起來像「程式太複雜」。
 *
 * ## 為什麼回 -1 而不是 npos
 *
 * C++ 的 `string::npos` 是 `size_t(-1)`，而**使用者常寫 `!= -1` 來比**。
 * 這個直譯器沒有把 npos 表示成一個常數，所以回 -1 讓兩種寫法都對。
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
  const src = `#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ ${body} return 0; }`
  const interp = new SemanticInterpreter({ maxSteps: 50000 })
  await interp.execute(lifter.lift(tp.parse(src)!.rootNode as never) as never)
  return interp.getOutput().join('')
}

describe('搜尋的起點', () => {
  it('★ 從指定位置往後找', async () => {
    expect(
      (await run('string s = "aXbXc"; cout << s.find("X", 2);')).trim(),
      '起點被丟掉 → 永遠從頭找 → 掃描迴圈**無限跑**',
    ).toBe('3')
  })

  it('★ 沒給起點時從頭找——只驗有起點的話，「一律用起點 0」也會過', async () => {
    expect((await run('string s = "aXbXc"; cout << s.find("X");')).trim()).toBe('1')
  })
})

describe('找不到時的回傳值', () => {
  it('★ 回 -1，讓使用者常寫的 `!= -1` 成立', async () => {
    expect(
      (await run('string s = "abc"; cout << s.find("X");')).trim(),
      '回 4294967295 的話 `!= -1` 永遠成立，迴圈停不下來',
    ).toBe('-1')
  })
})

describe('掃描迴圈——兩個 bug 疊起來的實際症狀', () => {
  it('★ 數出所有出現次數（期望值由 g++ 決定）', async () => {
    const out = await run(`string s = "aXbXc";
    int pos = 0;
    int n = 0;
    while ((pos = s.find("X", pos)) != -1) {
        n = n + 1;
        pos = pos + 1;
    }
    cout << n;`)
    expect(out.trim(), '兩個 bug 湊起來的症狀是**爆步數上限**——離現場很遠').toBe('2')
  })
})

describe('順帶驗證：兩個過期的阻斷者', () => {
  it('★ 括號布林運算式（091 之後早就正確）', async () => {
    expect((await run('int a = 3; int b = 7; cout << (a < b) << (a > b) << ((a < b) && (b < 10));')).trim()).toBe('101')
  })

  it('★ 逗號運算子（早就正確）', async () => {
    expect((await run('int i; int t; for (i = 0, t = 0; i < 4; i++) { t = t + i; } cout << t;')).trim()).toBe('6')
  })
})
