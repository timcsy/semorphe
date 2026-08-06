/**
 * 回傳指標的函式、指標陣列（084）
 *
 * ## 這兩支原本是 `it.todo`，而阻斷者標記說對了
 *
 * 與陣列初始化列表那批不同（那批的阻斷者早就過期），這兩個是**真的還在**：
 *
 * | 原本 | 產出 |
 * |---|---|
 * | `int* f(int* p)` | **`int f(int* p)()`** —— 星號跑錯位置，還多一對括號 |
 * | `int* a[3];` | **`int* ptr;`** —— 名字與大小都掉了 |
 *
 * 兩個的根因是同一種：**語法樹的 `pointer_declarator` 包了一層**，
 * 而辨識器沒有下鑽。
 *
 * 第二個特別危險：`int* ptr;` **看起來像一段合法程式**——編譯得過、跑得動，
 * 只是不是使用者寫的那一段。
 *
 * ## 期望值由 g++ 決定
 *
 * 兩支的期望輸出都是**真的編譯執行**出來的，不是心算。
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

const roundTrip = (src: string): string =>
  generateCode(lifter.lift(tp.parse(src)!.rootNode as never) as never, 'cpp', style)

async function run(src: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 200000 })
  await interp.execute(lifter.lift(tp.parse(src)!.rootNode as never) as never)
  return interp.getOutput().join('')
}

describe('回傳指標的函式', () => {
  const code = `#include <iostream>
using namespace std;
int* firstPositive(int* arr, int n) {
    for (int i = 0; i < n; i++) {
        if (arr[i] > 0) { return &arr[i]; }
    }
    return 0;
}
int main() {
    int data[4] = {-3, -1, 7, 2};
    int* p = firstPositive(data, 4);
    cout << *p;
    return 0;
}`

  it('★ 回傳型別保住星號，且不多出括號', () => {
    const gen = roundTrip(code)
    expect(gen, '星號跑錯位置了').toContain('int* firstPositive(')
    expect(gen, '多出一對括號——那是 declarator 沒有下鑽的症狀').not.toContain(')()')
  })

  it('★ 雙星號也對——只驗單星的話 `char**` 會靜靜掉一顆', () => {
    expect(roundTrip('char** g() { return 0; }\nint main(){ return 0; }')).toContain('char** g(')
  })

  it('★ 一般函式不得被影響', () => {
    expect(roundTrip('int h(int a) { return a; }\nint main(){ return 0; }')).toContain('int h(int a)')
  })
})

describe('指標陣列', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    int y = 9;
    int* slots[2];
    slots[0] = &x;
    slots[1] = &y;
    cout << *slots[0] << *slots[1];
    return 0;
}`

  it('★ 名字與大小都保住', () => {
    const gen = roundTrip(code)
    expect(gen, '名字掉了——落到預設的 `ptr`').toContain('slots')
    expect(gen, '大小掉了').toContain('[2]')
  })

  it('★ 執行結果正確——`int* ptr;` 這種錯誤產出看起來像合法程式，只驗轉換抓不到', async () => {
    expect((await run(code)).trim()).toBe('59')
  })

  it('★ 一般陣列與一般指標不得被影響', () => {
    expect(roundTrip('int main(){ int b[4]; return 0; }')).toContain('int b[4]')
    expect(roundTrip('int main(){ int x=1; int* p = &x; return 0; }')).toContain('int* p = &x')
  })
})
