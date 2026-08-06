/**
 * vector 的初始化列表（094）
 *
 * ## 這個缺陷四路裡壞了三路，而來回轉換看起來「成功」
 *
 * `vector<int> v = {3,1,4}` 原本：
 *
 * | 路 | 狀況 |
 * |---|---|
 * | 辨識 | 初始化列表**整段丟掉** |
 * | 產生 | 產回 `vector<int> v;` —— **合法程式，只是不是使用者寫的那段** |
 * | 執行 | 空的向量 → `v[1]` 索引越界、`v.size()` 是 0 |
 *
 * **辨識丟掉、產生也跟著少，於是來回轉換前後「一致」**——只有跑起來才會現形。
 * 那正是「只驗來回轉換抓不到」的典型。
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

const wrap = (body: string, extra = ''): string =>
  `#include <iostream>\n#include <vector>\n#include <string>\n${extra}using namespace std;\nint main(){ ${body} return 0; }`
const lift = (b: string) => lifter.lift(tp.parse(wrap(b))!.rootNode as never)
const roundTrip = (b: string): string => generateCode(lift(b) as never, 'cpp', style)

async function run(b: string): Promise<string> {
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(lift(b) as never)
  return interp.getOutput().join('')
}

describe('產生：初始化列表要一起產回去', () => {
  it('★ 整數', () => {
    expect(
      roundTrip('vector<int> v = {3,1,4};'),
      '產回 `vector<int> v;` —— **合法程式，只是不是使用者寫的那段**',
    ).toContain('vector<int> v = {3, 1, 4}')
  })

  it('★ 沒有初始值時不得多出一對大括號', () => {
    const g = roundTrip('vector<int> v;')
    expect(g).toContain('vector<int> v;')
    expect(g).not.toContain('= {}')
  })
})

describe('執行：期望值由 g++ 決定', () => {
  it('★ 元素與長度都對（g++ 印 `8 1`）', async () => {
    expect(
      (await run('vector<int> v = {3,1,4}; int s=0; for(int i=0;i<v.size();i++){ s=s+v[i]; } cout<<s<<" "<<v[1];')).trim(),
      '空的向量 → 索引越界、size 是 0',
    ).toBe('8 1')
  })

  it('★ 字串向量（g++ 印 `bob 2 0`）', async () => {
    expect(
      (await run('vector<string> names = {"ann","bob"}; vector<int> e; cout << names[1] << " " << names.size() << " " << e.size();')).trim(),
    ).toBe('bob 2 0')
  })

  it('★ 空向量仍是空的——只驗有初始值的話，「一律填東西」也會過', async () => {
    expect((await run('vector<int> v; cout << v.size();')).trim()).toBe('0')
  })

  it('★ `vector<int> v(5)` 不是列表初始化，不得被當成初始值', async () => {
    // 那是「建立 5 個元素」的建構式呼叫，語法上是 argument_list 不是
    // initializer_list。把它當成列表的話 `v` 會變成 `{5}`。
    const g = roundTrip('vector<int> v(5);')
    expect(g, '建構式呼叫被當成初始化列表了').not.toContain('= {5}')
  })
})
