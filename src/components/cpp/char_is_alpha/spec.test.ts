/**
 * `cpp:char_is_alpha` 的自證測——膠囊自己帶的五路防線。
 *
 * ⚠️ **每一條負向前面先釘一個正向**（`component-encapsulate` 步驟 3）：
 * `expect(ids).not.toContain(…)` 在集合是空的時候也會過，
 * **一支空過的測試與健康的長得一模一樣。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { expectCellaOut } from '../../../../tests/helpers/cella-run'
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

const H = '#include <iostream>\n#include <cctype>\nusing namespace std;\n'
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}

describe('膠囊自證：cpp:char_is_alpha', () => {
  it('★ lift：isalpha(c) 產出這顆身分', () => {
    expect(collect(lift(`int main(){ char c='a'; cout << isalpha(c); }`))).toContain('cpp:char_is_alpha')
  })

  it('★ 而它不搶別的名字（負向——前面先釘正向錨點）', () => {
    const ids = collect(lift(`int main(){ char c='a'; cout << isdigit(c); }`))
    // 正向錨點：沒有它，`lift` 回 null 時下面那句也會過
    expect(ids, '這段碼必須產出 isdigit 那顆——否則量測沒跑到').toContain('cpp:char_is_digit')
    expect(ids).not.toContain('cpp:char_is_alpha')
  })

  it('★ generate：產回 isalpha(...)', () => {
    const code = generateCode(lift(`int main(){ char c='a'; cout << isalpha(c); }`), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('isalpha(c)')
  })

  // ⏸ 不是 Cella 判錯，是 semorphe 這一側缺一段：formalize 回「cpp:char_is_alpha：這顆元件還沒有對應到 Cella 的建構子」
  // （這顆膠囊沒有 `formalize.ts`，判決走不到 Cella）。期望值照 C++ 的答案寫好了，補上 formalize 之後拿掉 skip。
  // ⚠️ `isalpha` 只保證字母回【非零】（g++ 實測：Apple clang 印 1，glibc 印 1024）——原本直接印 `isalpha('a')` 期望 1
  // 綁在 JS 直譯器上，所以改成比 `!= 0`。
  it('★ execute：字母回非零、非字母回 0', async () => {
    // spec 198（重構 6c-1）：執行的判準從 JS 直譯器換成 Cella
    await expectCellaOut(H + `int main(){ cout << (isalpha('a') != 0); }`, '1')
    await expectCellaOut(H + `int main(){ cout << isalpha('1'); }`, '0')
  })

  // ⏸ 不是 Cella 判錯，是 semorphe 這一側缺一段：formalize 回「cpp:char_is_alpha：這顆元件還沒有對應到 Cella 的建構子」
  // （這顆膠囊沒有 `formalize.ts`，判決走不到 Cella）。期望值照 C++ 的答案寫好了，補上 formalize 之後拿掉 skip。
  it('★ execute：字元以數字碼存放時也要對（核心的轉型踩過這個坑）', async () => {
    // 97 是 'a'——取成 '9' 的話會回 0（`!= 0` 的理由同上）
    await expectCellaOut(H + `int main(){ char c = 97; cout << (isalpha(c) != 0); }`, '1')
  })
})
