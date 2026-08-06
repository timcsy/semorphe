/**
 * 陣列初始化列表的完整程式（090）
 *
 * ## 這批 todo 的阻斷者早就過期
 *
 * 13 支 todo 寫著「陣列初始化列表在辨識時遺失（pre-existing lifter
 * limitation）」。**082 已經證明那個阻斷者不存在了**——050 修好了它，
 * 而沒有人回頭看。
 *
 * 這一刀把它們變成真的測試：**完整的程式、真的斷言、執行結果由 g++ 決定**。
 *
 * ## 為什麼要驗執行結果，不只驗來回轉換
 *
 * 初始值全部變成 0 的話，來回轉換仍然產得出 `{0, 0, 0}`——**看起來像
 * 一段合法程式**。只有跑起來比對輸出才分得出來。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

let tp: Parser
let lifter: Lifter
const style = apcs as unknown as StylePreset

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (src: string) => lifter.lift(tp.parse(src)!.rootNode as never)
const roundTrip = (src: string): string => generateCode(lift(src) as never, 'cpp', style)

async function run(src: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 200000 })
  await interp.execute(lift(src) as never)
  return interp.getOutput().join('')
}

/** 每一支的期望輸出都是 g++ 實際編譯執行出來的 */
const PROGRAMS: [string, string, string][] = [
  [
    '函式鏈與分類：初始值含負數與零',
    `#include <iostream>
#include <cstdlib>
using namespace std;
int classify(int v) {
    if (v < 0) { return -1; }
    if (v == 0) { return 0; }
    return 1;
}
int main() {
    int data[6] = {-20, 5, 0, 15, -8, 30};
    int neg = 0;
    int zero = 0;
    int pos = 0;
    for (int i = 0; i < 6; i++) {
        int c = classify(data[i]);
        if (c < 0) { neg = neg + 1; }
        else if (c == 0) { zero = zero + 1; }
        else { pos = pos + 1; }
    }
    cout << neg << zero << pos << endl;
    return 0;
}`,
    '213',
  ],
  [
    '求最大值與總和',
    `#include <iostream>
using namespace std;
int main() {
    int scores[5] = {50, 65, 30, 95, 45};
    int best = scores[0];
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total = total + scores[i];
        if (scores[i] > best) { best = scores[i]; }
    }
    cout << best << " " << total << endl;
    return 0;
}`,
    '95 285',
  ],
]

describe('陣列初始化列表：完整程式', () => {
  for (const [title, code, expected] of PROGRAMS) {
    describe(title, () => {
      it('★ 初始化列表在來回轉換後仍在', () => {
        expect(roundTrip(code), '初始化列表在辨識時被丟掉了').toMatch(/\{[^}]*,[^}]*\}/)
      })

      it('★ 執行結果與 g++ 一致——**初始值全變 0 的話，來回轉換仍然會過**', async () => {
        expect((await run(code)).replace(/\s+/g, ' ').trim()).toBe(expected)
      })
    })
  }

  it('★ 反面：初始值真的被讀進去了，不是碰巧', async () => {
    // 沒有這支的話，一個「初始值全填 0」的實作在某些程式上也可能碰巧對
    const out = await run(
      '#include <iostream>\nusing namespace std;\nint main(){ int a[3] = {7,8,9}; cout << a[0] << a[1] << a[2]; return 0; }',
    )
    expect(out.trim(), '初始值沒有進到陣列裡').toBe('789')
  })
})
