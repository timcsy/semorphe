/**
 * `cpp:define_func` 的**自證測**——定義那一行，與「展開」是兩件事
 *
 * ## 這裡放什麼
 *
 * 推導不出來的那件事：這一顆**只宣告**，展開在別處
 *（`languages/cpp/lang/macro-expand.ts` 的樹修復）。
 * 於是它自己要答得出三題：
 *
 * ```
 * ① 產回去一字不差——括號要【緊貼名字】
 *    #define rep(i,n) …   是一個可展開的樣板
 *    #define rep (i,n) …  是一個【值為 (i,n) 的常數】——差一個空格，差一個東西
 * ② #ifdef 讀得到它（少了這一行會答錯，而那是一個安靜的錯答案）
 * ③ 它【不綁值】——`rep` 不是一個值
 * ```
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { generateCode } from '../../../core/projection/code-generator'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { resetDefinedMacros } from '../../../languages/cpp/lang/executors/preprocessor'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../../core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const S = apcs as unknown as StylePreset
const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)
const gen = (code: string): string => generateCode(lift(code) as SemanticNode, 'cpp', S)

function ids(n: SemanticNode | null, out = new Set<string>()): Set<string> {
  if (!n) return out
  out.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

function find(n: SemanticNode | null, id: string): SemanticNode | null {
  if (!n) return null
  if (n.componentId === id) return n
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) {
    const hit = find(k, id)
    if (hit) return hit
  }
  return null
}

async function run(code: string): Promise<string> {
  resetDefinedMacros()
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(code) as SemanticNode)
  return i.getOutput().join('')
}

const head = '#include <iostream>\nusing namespace std;\n'

describe('cpp:define_func', () => {
  it('★ 正向錨點：這段碼真的產生了 cpp:define_func（而不是同族那顆）', () => {
    const got = ids(lift(`${head}#define rep(i,n) for(int i=0;i<n;i++)\nint main(){ return 0; }`))
    expect(got).toContain('cpp:define_func')
    expect(got).not.toContain('cpp:define')
    expect(got).not.toContain('unresolved')
  })

  it('lift：三格都認得（參數不含括號）', () => {
    const n = find(lift(`#define rep(i,n) for(int i=0;i<n;i++)\nint main(){ return 0; }`), 'cpp:define_func')
    expect(n).not.toBeNull()
    expect(n?.properties.name).toBe('rep')
    expect(n?.properties.params).toBe('i,n')
    expect(n?.properties.value).toBe('for(int i=0;i<n;i++)')
  })

  it('🔴 generate：括號要緊貼名字——差一個空格，差一個東西', () => {
    expect(gen(`#define rep(i,n) for(int i=0;i<n;i++)\nint main(){ return 0; }`))
      .toContain('#define rep(i,n) for(int i=0;i<n;i++)')
  })

  it('🔴 round-trip：參數之間的空白要原樣回去', () => {
    const src = `#define mx(a, b) ((a)>(b)?(a):(b))\nint main(){ return 0; }`
    expect(gen(src)).toContain('#define mx(a, b) ((a)>(b)?(a):(b))')
    // 不動點：再 lift 一次產出一樣
    expect(gen(gen(src))).toBe(gen(src))
  })

  it('★ 同族那顆不得被搶走：`#define MAX 100` 仍然是具名常數', () => {
    const got = ids(lift(`${head}#define MAX 100\nint main(){ return 0; }`))
    expect(got).toContain('cpp:define')
    expect(got).not.toContain('cpp:define_func')
  })

  it('execute：`#ifdef` 讀得到它——少了這一行會答錯，而那是安靜的', async () => {
    expect(
      await run(`${head}#define rep(i,n) for(int i=0;i<n;i++)\nint main(){\n#ifdef rep\n  cout << "on";\n#endif\n  return 0; }`),
    ).toBe('on')
  })

  it('🔴 execute：它【不綁值】——`rep` 不是一個可以印出來的東西', async () => {
    await expect(
      run(`${head}#define rep(i,n) for(int i=0;i<n;i++)\nint main(){ cout << rep; return 0; }`),
    ).rejects.toThrow()
  })

  it('execute：展開之後真的跑得動（這一顆的存在理由）', async () => {
    expect(
      await run(`${head}#define rep(i,n) for(int i=0;i<n;i++)\nint main(){ int s=0; rep(i,4) s += i; cout << s; return 0; }`),
    ).toBe('6')
  })
})
