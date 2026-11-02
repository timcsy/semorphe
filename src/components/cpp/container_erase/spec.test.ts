/**
 * **膠囊自證：容器的刪除——同一個方法名，三種引數。**
 *
 * 🔴 **它在 2026-09-17 之前一個測試都沒有**，而這一刀讓它多吃了一種引數（位置）。
 *
 * C++ 的 `erase` 在同一個名字底下做三件不同的事，而差別**不在名字，在引數**：
 *
 * ```
 * s.erase(值)        集合：刪掉那一個
 * ms.erase(值)       可重複集合：刪掉【全部】等於它的
 * ms.erase(位置)     只刪那一格，並回傳下一個位置
 * ```
 *
 * > **一個方法名如果由引數的種類決定語義，那三條路都要有人看著
 * > ——少看一條的症狀是「數量錯一個」，而程式跑得完。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { runCella, describeCellaResult, expectCellaOut, knownCellaGap } from '../../../../tests/helpers/cella-run'
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

const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] => {
  out.push(n)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const ids = (n: SemanticNode): string[] => collect(n).map((x) => x.componentId)
// spec 200（重構 6c-2b）：執行的判準從 JS 直譯器換成 Cella——不是 accept 的話回 `ERR=` ＋ 說得出原因的判決描述
const run = async (c: string): Promise<string> => {
  const r = await runCella(c)
  return r.verdict === 'accept' ? r.out : 'ERR=' + describeCellaResult(r)
}
const H = '#include <iostream>\n#include <set>\n#include <map>\n#include <string>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset
const main = (b: string): string => `${H}int main(){ ${b} return 0; }`

describe('膠囊自證：容器的刪除', () => {
  it('★ lift：認得出來，而且不落進殘差', () => {
    const got = ids(lift(main(`set<int> s; s.insert(3); s.erase(3);`)))
    expect(got, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:container_erase')
    expect(got).not.toContain('cpp:raw_code')
  })

  it('★ generate：三種引數都吐得回去', () => {
    const gen = generateCode(lift(main(
      `multiset<int> ms; ms.insert(3); ms.erase(3); ms.erase(ms.find(3));`)), 'cpp', S)
    expect(gen).toContain('ms.erase(3);')
    expect(gen, '🔴 位置那一種產不回去').toContain('ms.erase(ms.find(3));')
  })

  it('★ 不動點：來回兩次一字不差', () => {
    const src = main(`multiset<int> ms; ms.insert(3); ms.erase(ms.find(3));`)
    const once = generateCode(lift(src), 'cpp', S)
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  it('★ execute：集合刪值', async () => {
    expect(await run(main(
      `set<int> s; s.insert(1); s.insert(2); s.erase(1); cout<<s.size()<<*s.begin();`))).toBe('12')
  })

  it('🔴 execute：可重複集合的 erase(值) 刪【全部】', async () => {
    expect(await run(main(
      `multiset<int> ms; ms.insert(3); ms.insert(3); ms.insert(5); ms.erase(3); cout<<ms.size();`)),
    ).toBe('1')
  })

  it('🔴 execute：而 erase(位置) 只刪【一個】', async () => {
    expect(await run(main(
      `multiset<int> ms; ms.insert(3); ms.insert(3); ms.erase(ms.find(3)); cout<<ms.size();`)),
    ).toBe('1')
  })

  // 🟡 Cella 0.1.202611020258 判 unknown：map 沒有 erase 成員，已回報
  it('🟡 已知缺陷（修好時這條會紅）：★ execute：對照表刪鍵', () => knownCellaGap(/no member 'erase'/, async () => {
    await expectCellaOut(main(
      `map<string,int> m; m["a"]=1; m["b"]=2; m.erase("a"); cout<<m.size()<<m["b"];`), '12')
  }))

  /**
   * 🟢 字串的 `erase(位置)` 走的是**字元格子**那一條——格子是延遲攤出來並
   * 存回那個值身上的，所以在它上面原地刪一格，**既有的位置看得到那個改動**。
   */
  // 🟡 Cella 0.1.202611020258 判 unknown：the model's 'std::string' has no member 'erase'，已回報。
  // ⚠️ 程式從 `string::iterator it` 改成 `auto it`：這一條的主角是 erase(位置)；`string::iterator` 這個型別名 formalize 還不認得（另一個缺口），
  //    留著它的話本體卡在翻不出、量不到 erase。
  it('🟡 已知缺陷（修好時這條會紅）：★ execute：字串刪一個字，並回傳下一個位置', () => knownCellaGap(/no member 'erase'/, async () => {
    await expectCellaOut(main(
      `string s="aXb"; auto it=s.begin(); ++it; it=s.erase(it); cout<<s<<*it;`), 'abb')
  }))

  // 🔴 spec 200：拿別的字串的位置去刪是未定義行為（[string.modifiers]：位置必須是這個字串的有效迭代器）——要被判 reject。
  // 原本的斷言是「輸出含 ERR=」：換成 Cella 之後它會因為【翻不出 string::iterator】而假綠，所以收緊成判決種類。
  // 🟡 Cella 0.1.202611020258 判 unknown（string 沒有 erase），已回報。
  it('🟡 已知缺陷（修好時這條會紅）：★ 負向：位置不是這個容器裡的，要出聲而不是刪錯東西', () => knownCellaGap(/no member 'erase'/, async () => {
    const r = await runCella(main(
      `string a="ab"; string b="cd"; auto it=b.begin(); a.erase(it); cout<<a;`))
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
  }))
})
