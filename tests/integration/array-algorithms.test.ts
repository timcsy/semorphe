/**
 * 陣列初始值與標準演算法的執行
 *
 * ## 兩個都是「半條路修好」的病
 *
 * **陣列初始值**：`specs/050` 修好了辨識那半——`int a[3] = {1,2,3}` 的初始值
 * 會進到語義樹的 `values` 子槽。但**執行那半沒有接上**：`array_declare` 的
 * 執行器只按大小配置預設值，從來沒讀過 `values`。
 *
 * 於是 `int a[3]={3,1,2}; cout << a[0];` **輸出 0**。語義樹裡看得到值，跑起來
 * 卻是零——**半條路修好比沒修更難察覺**。
 *
 * **標準演算法**：`sort`／`reverse`／`fill`／`iota`／`partial_sum` 全部註冊成
 * 空操作。`sort(a, a+3)` 靜靜地什麼都不做，學生拿到未排序的陣列而毫無提示。
 *
 * 見 specs/053-declare-noop-execute/classification.md 的追加分類
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 60_000)

async function run(body: string): Promise<string> {
  const src =
    `#include <iostream>\n#include <algorithm>\n#include <numeric>\nusing namespace std;\n` +
    `int main(){ ${body} return 0; }\n`
  const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 200_000 })
  interp.setOutputCallback((s) => out.push(s))
  await interp.execute(tree)
  return out.join('')
}

describe('陣列初始值真的進到執行期', () => {
  it('int a[3] = {3,1,2} 讀得回原值', async () => {
    expect(await run(`int a[3]={3,1,2}; cout << a[0] << a[1] << a[2];`)).toBe('312')
  })

  it('沒寫大小時，長度由初始值決定', async () => {
    expect(await run(`int a[]={7,8}; cout << a[0] << a[1];`)).toBe('78')
  })

  it('初始值比大小少時，其餘補預設值', async () => {
    expect(await run(`int a[3]={9}; cout << a[0] << a[1] << a[2];`)).toBe('900')
  })

  it('沒有初始值的陣列行為未變', async () => {
    expect(await run(`int a[2]; cout << a[0] << a[1];`)).toBe('00')
  })
})

describe('標準演算法不再是空操作', () => {
  it('sort 真的排序', async () => {
    expect(await run(`int a[3]={3,1,2}; sort(a,a+3); cout << a[0] << a[1] << a[2];`)).toBe('123')
  })

  it('reverse 真的反轉', async () => {
    expect(await run(`int a[3]={1,2,3}; reverse(a,a+3); cout << a[0] << a[2];`)).toBe('31')
  })

  it('fill 真的填值', async () => {
    expect(await run(`int a[3]; fill(a,a+3,5); cout << a[0] << a[2];`)).toBe('55')
  })

  it('iota 真的遞增填值', async () => {
    expect(await run(`int a[3]; iota(a,a+3,1); cout << a[0] << a[2];`)).toBe('13')
  })

  it('partial_sum 真的累加', async () => {
    expect(await run(`int a[3]={1,2,3}; int b[3]; partial_sum(a,a+3,b); cout << b[0] << b[2];`)).toBe('16')
  })

  it('★ 範圍只排一部分時，其餘不動', async () => {
    expect(await run(`int a[4]={4,3,2,1}; sort(a,a+2); cout << a[0] << a[1] << a[2] << a[3];`)).toBe('3421')
  })

  it('★ 範圍解析不了時**出聲**，不是靜靜地什麼都不做', async () => {
    // 原本的空操作就是這種「安靜的錯」：程式跑完、結果錯了、沒有任何提示
    await expect(run(`int a[3]={1,2,3}; sort(zzz, zzz+3); cout << a[0];`)).rejects.toThrow()
  })
})
