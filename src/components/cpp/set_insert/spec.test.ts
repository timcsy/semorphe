/**
 * **膠囊自證：集合的插入。**
 *
 * 🔴 **它從哪來**：這一支是「`insert` 這個方法名」的唯一主人，而在 2026-09-17
 * 之前它**無條件**去重＋排序——於是 `multiset` 少一半元素，而程式照常跑完。
 *
 * > **一個只錯在「留幾個」的缺陷不會當掉，它會印出一個比較小的數字。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { runCella, describeCellaResult, knownCellaGap } from '../../../../tests/helpers/cella-run'
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
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
// spec 200（重構 6c-2b）：執行的判準從 JS 直譯器換成 Cella——不是 accept 的話 err 是說得出原因的判決描述
const run = async (c: string): Promise<{ out: string; err: string; verdict: string }> => {
  const r = await runCella(c)
  return { out: r.out, err: r.verdict === 'accept' ? '' : describeCellaResult(r), verdict: r.verdict }
}
const H = '#include <iostream>\n#include <set>\n#include <vector>\nusing namespace std;\n'
const S = apcs as unknown as StylePreset

describe('膠囊自證：集合的插入', () => {
  it('★ lift：認得 insert，而且不落進殘差', () => {
    const ids = collect(lift(`${H}int main(){ set<int> s; s.insert(3); }`))
    expect(ids, '🔴 沒認出來 → 下面每一條都在驗空集合').toContain('cpp:set_insert')
    expect(ids).not.toContain('cpp:raw_code')
  })

  it('★ generate：吐回去逐字是 insert', () => {
    const code = generateCode(lift(`${H}int main(){ set<int> s; s.insert(3); }`), 'cpp', S)
    expect(code).toContain('s.insert(3);')
  })

  it('★ 語義不動點', () => {
    const once = generateCode(lift(`${H}int main(){ multiset<int> ms; ms.insert(3); }`), 'cpp', S)
    expect(generateCode(lift(once), 'cpp', S)).toBe(once)
  })

  it('★ execute：set 去重', async () => {
    const r = await run(`${H}int main(){ set<int> s; s.insert(5); s.insert(3); s.insert(5);
      for (int x : s) cout << x; }`)
    expect(r.err).toBe('')
    expect(r.out).toBe('35')
  })

  it('🔴 execute：multiset【每一個都留】，而且仍然有序', async () => {
    const r = await run(`${H}int main(){ multiset<int> ms; ms.insert(5); ms.insert(3); ms.insert(5);
      for (int x : ms) cout << x; }`)
    expect(r.err).toBe('')
    expect(r.out, '🔴 修之前這裡是 35——少掉的那個 5 不會有人發現').toBe('355')
  })

  // 🔴 spec 200：`vector<int>::insert(3)` 在真的 C++ 編不過（vector 的 insert 要一個位置）——要被判 reject。
  // 原本的斷言是「錯誤訊息非空且提到 v」：換成 Cella 之後它會因為【未支援】而假綠，所以收緊成判決種類。
  // 🟡 Cella 0.1.202611020258 判 unknown：vector 沒有 insert 成員，已回報。
  it('🟡 已知缺陷（修好時這條會紅）：🔴 接收者不是集合時要【出聲】，不得安靜地去重排序', () => knownCellaGap(/no member 'insert'/, async () => {
    const r = await run(`${H}int main(){ vector<int> v; v.insert(3); cout << v.size(); }`)
    expect(r.verdict, r.err).toBe('reject')
  }))
})
