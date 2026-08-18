/**
 * 護欄：**產生器不得靜默丟掉 lift 產出的引數。**
 *
 * ## 🔴 這兩個是投影遺失護欄【間接】抓到的
 *
 * 我一度把三個接點當成「死的」刪掉，理由是「產生器沒有讀它」
 * ——而**宣告完整性護欄當場糾正**：`lift` 真的會產出它們。
 *
 * > **要判斷一個接點是不是死的，兩端都要查——
 * > 只看產生器的話，「lift 產出而 generate 丟掉」會被誤判成「沒有人用」。**
 *
 * 而查完之後發現那不是死接點，是**兩個真的資料遺失**：
 *
 * ```
 * s.push_back('Z')     →  s.push_back('a')     🔴 字元被換成產生器的預設值
 * s.find("b", 5)       →  s.find("b")          🔴 起始位置不見（從頭找）
 * ```
 *
 * ⚠️ **兩個都不會報錯**：語法對、型別對、程式跑得完——只是結果不是他寫的那個。
 *
 * > **一個「找不到就用預設值」的讀法，在槽名改變時不會報錯
 * > ——它會安靜地產出一個看起來合理的東西。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const roundTrip = (src: string): string =>
  generateCode(
    createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode,
    'cpp',
    apcs as StylePreset,
  )

describe('護欄：產生器不得靜默丟掉引數', () => {
  it('🔴 `push_back` 的字元不得被換成預設值', () => {
    const out = roundTrip("#include <string>\nint main() { string s; s.push_back('Z'); return 0; }\n")
    expect(out, '沒有產出 push_back——下面的斷言會空過').toContain('push_back')  // ← 正向錨點
    expect(out, "🔴 'Z' 被換成產生器的預設值了").toContain("push_back('Z')")
  })

  it('🔴 `find` 的起始位置不得不見', () => {
    const out = roundTrip('#include <string>\nint main() { string s = "abc"; int i = s.find("b", 5); return 0; }\n')
    expect(out).toContain('.find(')                                              // ← 正向錨點
    expect(out, '🔴 起始位置不見了——那會從第 0 個字元開始找').toContain('find("b", 5)')
  })

  it('⚠️ 而沒有第二個引數時不得產出空的逗號（那編不過）', () => {
    const out = roundTrip('#include <string>\nint main() { string s = "abc"; int i = s.find("b"); return 0; }\n')
    expect(out).toContain('find("b")')                                           // ← 正向錨點
    expect(out).not.toContain('find("b",)')
    expect(out).not.toContain('find("b", )')
  })

  it('🔴 而 push_back 少了字元時要【出聲】，不是再用一次預設值', () => {
    // ⚠️ 用預設值掩蓋一次資料遺失，就是這個 bug 本身的成因。
    const bad = {
      conceptId: 'cpp:string_append_char',
      properties: { obj: 's' },
      children: {},
      metadata: {},
    } as unknown as SemanticNode
    const prog = { conceptId: 'cpp:program', properties: {}, children: { body: [bad] }, metadata: {} } as unknown as SemanticNode
    expect(() => generateCode(prog, 'cpp', apcs as StylePreset)).toThrow(/少了要加的字元/)
  })
})
