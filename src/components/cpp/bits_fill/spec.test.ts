/**
 * `cpp:bits_fill` 的自證測——**把整排變成 0／1／相反**。
 *
 * ## 🔴 一顆身分吃三個方法，而那條判準要被釘住
 *
 * `.reset()`／`.set()`／`.flip()` 的引數個數（0）、接點（一個接收者）、
 * 角色（語句）全同，**差別只有把整排變成什麼**——照元件代數 250 ⟹ 是參數。
 *
 * ## 🔴 而第一版把那個屬性取名 `mode`，於是三個方法全部變成 `reset`
 *
 * 共用的方法路由靠 `declaresMethodProp(componentId)` 把**使用者寫的那個方法名**
 * 填進 `properties.method`。取名 `mode` 的那一格**從來沒有被填過**。
 *
 * > **症狀不是報錯：`bs.set()` 安靜地把整排歸零。**
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
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(`${H}int main(){ ${body} return 0; }`)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}
const gen = (body: string): string => generateCode(lift(body), 'cpp', apcs as unknown as StylePreset)
const run = async (body: string): Promise<{ out: string; err: string }> => {
  const i = new SemanticInterpreter({ maxSteps: 200_000 })
  try { await i.execute(lift(body)); return { out: i.getOutput().join(''), err: '' } }
  catch (e) { return { out: i.getOutput().join(''), err: (e as Error).message } }
}
const dig = (n: SemanticNode, id: string): SemanticNode | null => {
  if (n.componentId === id) return n
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) { const r = dig(k, id); if (r) return r }
  return null
}

describe('膠囊自證：把整排位元變成什麼', () => {
  it('★ lift：三個方法都認得，而且是【同一顆身分】', () => {
    const got = ids(lift('bitset<4> bs; bs.reset(); bs.set(); bs.flip();'))
    expect(got).toContain('cpp:bits_fill')
    expect(got.filter((x) => x === 'cpp:bits_fill')).toHaveLength(3)
    expect(got).not.toContain('cpp:raw_code')
  })

  /** 🔴 **那一格裝的是使用者寫的名字**——取錯名的話它從來不會被填（見檔頭）。 */
  it('🔴 lift：方法名進 `method` 屬性，三個各不相同', () => {
    const one = (b: string): unknown => dig(lift(`bitset<4> bs; ${b}`), 'cpp:bits_fill')!.properties.method
    expect(one('bs.reset();')).toBe('reset')
    expect(one('bs.set();')).toBe('set')
    expect(one('bs.flip();')).toBe('flip')
  })

  it('★ generate：產回使用者寫的那個名字，不得換成別的', () => {
    const code = gen('bitset<4> bs; bs.reset(); bs.set(); bs.flip();')
    expect(code).toContain('bs.reset();')
    expect(code).toContain('bs.set();')
    expect(code).toContain('bs.flip();')
    expect(code, '🔴 `reset` 被換成 `clear` 了').not.toContain('bs.clear()')
  })

  it('★ execute：歸零／設為 1／反轉', async () => {
    const r = await run('bitset<4> a; a[1]=1; a.reset(); bitset<4> b; b.set(); bitset<4> c; c[0]=1; c.flip();'
      + ' cout << a[1] << b[0] << b[3] << c[0] << c[1];')
    expect(r.err).toBe('')
    expect(r.out).toBe('01101')
  })

  /**
   * 🪦 **[UNSUPPORTED:陣列的元素型別沒有被記在宣告表裡] 接收者是運算式時認不出來。**
   *
   * 依型別分派那一張表是**用接收者的原文去查名字**的，而 `d[0]` 不是一個名字：
   *
   * ```
   * bs.reset()     🟢 查得到 bs 的型別
   * d[0].reset()   🔴 查不到「d[0]」這個名字 ⟹ 掉進泛用的方法呼叫
   * ```
   *
   * 🔴 **第一版的修法是把三個名字也登錄到「以名字為鍵」那一張，而那是錯的**：
   * 那會讓**任何**接收者的 `.reset()` 都被搶走，包括型別查不到的。
   * 抓到它的是既有的「零引數的方法不得憑空多出插槽」那條護欄——它拿
   * `obj.reset()` 當泛用方法呼叫的例子，而 `obj` 沒有宣告過。
   *
   * > **型別查不到時不猜——留在通用版。
   * > 猜一個錯的專屬身分比誠實降級更糟。**（`method-components.ts` 的原話）
   *
   * **為什麼不是現在**：要修的是**宣告表記得住陣列的元素型別**
   *（今天 `bitset<26> d[3]` 只記下 `d → array`），而那是整族共同的限制。
   * **何時該修**：下一次碰宣告表記型別那一段。
   */
  it.fails('[UNSUPPORTED:陣列的元素型別沒有被記在宣告表裡] 🪦 `d[i].reset()`', async () => {
    const r = await run('bitset<26> d[2]; d[0][3]=1; d[1][3]=1; d[0].reset(); cout << d[0][3] << d[1][3];')
    expect(r.err).toBe('')
    expect(r.out).toBe('01')
  })

  it('🔴 execute：接收者不是一排位元時要出聲，而且說得出它是什麼', async () => {
    const r = await run('int n = 5; bitset<4> bs; bs.reset(); cout << n;')
    expect(r.err).toBe('')   // ★ 正向錨點：正常的那一支不受影響
    const bad = await run('string s = "ab"; s.flip();')
    expect(bad.err, '🔴 說不出接收者是什麼').toMatch(/不是一排位元|string/)
  })

  it('★ round-trip：產回去再 lift，身分與方法名都不變', () => {
    const once = gen('bitset<4> bs; bs.flip();')
    const t = createTestLifter().lift(parser.parse(once)!.rootNode as never) as SemanticNode
    expect(generateCode(t, 'cpp', apcs as unknown as StylePreset)).toBe(once)
    expect(dig(t, 'cpp:bits_fill')!.properties.method).toBe('flip')
  })
})
