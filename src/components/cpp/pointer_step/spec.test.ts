/**
 * `cpp:pointer_step` 的自證測——**位置的相鄰一格**（`prev`／`next`）。
 *
 * ## 🔴 它從語料來
 *
 * `prev(` 在 218 支學生程式裡 **10 處 / 8 支**，而**每一處都是 `prev(X.end())`**
 * ——那是「取最後一個元素」在**有序容器上唯一的寫法**
 *（`set` 沒有 `back()`、沒有隨機存取）。
 *
 * ⚠️ 而實測：那 8 支裡**只有 4 支**真的卡在它（其餘那條路沒被走到）。
 * > **一個「這一族有 N 支」的讀數，如果 N 是照【第一個錯誤】分的，
 * > 那它量到的是錯誤的順序，不是缺陷的分佈。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const lift = (body: string, glob = ''): SemanticNode =>
  createTestLifter().lift(parser.parse(`${H}${glob}\nint main(){ ${body} return 0; }`)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const run = async (body: string, glob = ''): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 100_000 })
  try { await i.execute(lift(body, glob)); return { out: i.getOutput().join(''), err: '' } }
  catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const gen = (body: string): string =>
  generateCode(lift(body), 'cpp', apcs as unknown as StylePreset)

describe('膠囊自證：位置的相鄰一格', () => {
  it('★ lift：兩個名字都認得，而且是【同一顆身分】', () => {
    const got = ids(lift('set<int> s{1,2,3}; auto a=prev(s.end()); auto b=next(s.begin());'))
    // ← 正向錨點先釘：`lift` 回 null 時集合是空的，負向斷言會空過
    expect(got).toContain('cpp:pointer_step')
    expect(got.filter((x) => x === 'cpp:pointer_step')).toHaveLength(2)
    expect(got).not.toContain('cpp:raw_code')
  })

  it('★ lift：方向進屬性，不進身分', () => {
    const dig = (n: SemanticNode): SemanticNode | null => {
      if (n.componentId === 'cpp:pointer_step') return n
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) { const r = dig(k); if (r) return r }
      return null
    }
    expect(dig(lift('set<int> s{1}; auto a=prev(s.end());'))!.properties.direction).toBe('prev')
    expect(dig(lift('set<int> s{1}; auto a=next(s.begin());'))!.properties.direction).toBe('next')
  })

  /**
   * 🔴 **產回去一字不差**——`prev(s.end())` 不可以變成 `s.end() - 1`：
   * `set` 沒有隨機存取，那樣**編不過**。
   */
  it('★ generate：產回去一字不差（不得換一種寫法）', () => {
    const code = gen('set<int> s{1,2}; auto a = prev(s.end()); auto b = next(s.begin());')
    expect(code).toContain('prev(s.end())')
    expect(code).toContain('next(s.begin())')
    expect(code).not.toContain('- 1')
  })

  it('★ execute：有序容器的最後一個（語料 10/10 處的形狀）', async () => {
    const r = await run('set<int> s{5,1,9}; cout << *prev(s.end());')
    expect(r.err).toBe('')
    expect(r.out).toBe('9')
  })

  it('★ execute：`next` 從開頭往後一格', async () => {
    const r = await run('vector<int> v{7,8,9}; cout << *next(v.begin());')
    expect(r.err).toBe('')
    expect(r.out).toBe('8')
  })

  it('★ execute：拿它當刪除的目標（語料 2 處）', async () => {
    const r = await run('set<int> s{1,2,3}; s.erase(prev(s.end())); for(int x : s) cout << x;')
    expect(r.err).toBe('')
    expect(r.out).toBe('12')
  })

  /**
   * 🔴 **反向的位置，「前一個」要往後走**——而那是 `movePointer` 做的，
   * 這顆不得再翻一次。翻兩次的症狀是**順序安靜地反過來**，不是報錯。
   */
  it('🔴 execute：反向的位置上方向不得被翻兩次', async () => {
    const r = await run('vector<int> v{1,2,3}; auto it = v.rbegin(); cout << *next(it);')
    expect(r.err).toBe('')
    expect(r.out).toBe('2')
  })

  it('★ round-trip：產回去再 lift，身分不變', () => {
    const once = gen('set<int> s{1,2}; auto a = prev(s.end());')
    const twice = generateCode(
      createTestLifter().lift(parser.parse(once)!.rootNode as never) as SemanticNode,
      'cpp', apcs as unknown as StylePreset)
    expect(twice).toBe(once)
    expect(ids(createTestLifter().lift(parser.parse(once)!.rootNode as never) as SemanticNode))
      .toContain('cpp:pointer_step')
  })

  /**
   * 🔴 **兩個引數要認領**——這一條 2026-09-19 **翻面過**。
   *
   * 探索階段的決定是「不做」（語料 0 處 ＋ 同族那個常態留空的插槽刺眼），
   * 而**資訊隔離的盲測十支裡有兩支用了 `prev(it, 2)`**。
   *
   * > **一個「語料 0 處」的讀數量到的是【這批語料的人怎麼寫】，
   * > 不是【這個寫法有多常見】。**
   *
   * ⚠️ 翻面的那一刻這條測試本身就是證物：它原本斷言的是
   * 「不得認領」，而**一條測試寫得再嚴，也只是把當時的決定釘住**。
   */
  it('🔴 lift：兩個引數是同一顆身分，第二個進 `count`', () => {
    const t = lift('vector<int> v{1,2,3}; auto a = prev(v.end(), 2);')
    expect(ids(t)).toContain('cpp:pointer_step')
    const find = (n: SemanticNode): SemanticNode | null => {
      if (n.componentId === 'cpp:pointer_step') return n
      for (const ks of Object.values(n.slots ?? {})) for (const k of ks) { const r = find(k); if (r) return r }
      return null
    }
    const node = find(t)!
    expect(node.slots.count?.length, '🔴 第二個引數掉了——而產出的碼仍然編得過').toBe(1)
  })

  /**
   * 🔴 **三個引數不是我**——`prev`／`next` 都是**很短的名字**，
   * 使用者自己寫得出 `int next(int a, int b, int c)`。判不出來就讓開。
   */
  it('🔴 lift：三個引數時不得認領', () => {
    const got = ids(lift('cout << next(1, 2, 3);', 'int next(int a,int b,int c){ return a+b+c; }'))
    expect(got).toContain('cpp:func_call')
    expect(got).not.toContain('cpp:pointer_step')
  })

  /** ★ 「幾格」留空時**不得**產出 `prev(it, 1)`——那不是使用者寫的那一行。 */
  it('★ generate：一個引數的照舊產成一個引數', () => {
    expect(gen('set<int> s{1,2}; auto a = prev(s.end());')).toContain('prev(s.end())')
  })

  /** ★ 兩個引數一字不差產回去。 */
  it('★ generate：兩個引數產回兩個引數', () => {
    expect(gen('vector<int> v{1,2,3}; auto a = prev(v.end(), 2);')).toContain('prev(v.end(), 2)')
  })

  /**
   * 🔴 **使用者自己定義的同名函式不得被搶**——`prev`／`next` 都是很短的名字。
   * ⚠️ 這一條前面有正向錨點（上面那幾支），所以「沒有認領」才是有意義的讀數。
   */
  it('🔴 lift：使用者自己的 `next(int)` 不得被搶', () => {
    const got = ids(lift('cout << next(3);', 'int next(int x){ return x+1; }'))
    expect(got).toContain('cpp:func_call')
    expect(got).not.toContain('cpp:pointer_step')
  })

  it('🔴 execute：接到的不是一個位置時要出聲，而且說得出是誰', async () => {
    const r = await run('int n = 5; cout << *prev(n);')
    expect(r.err).toContain('prev')
    expect(r.err).toContain('位置')
  })
})
