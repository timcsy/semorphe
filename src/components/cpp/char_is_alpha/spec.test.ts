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

const H = '#include <iostream>\n#include <cctype>\nusing namespace std;\n'
const lift = (c: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
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

  it('★ execute：字母回 1、非字母回 0', async () => {
    const run = async (c: string): Promise<string> => {
      const i = new SemanticInterpreter({ maxSteps: 100000 })
      await i.execute(lift(c))
      return i.getOutput().join('')
    }
    expect(await run(`int main(){ cout << isalpha('a'); }`)).toBe('1')
    expect(await run(`int main(){ cout << isalpha('1'); }`)).toBe('0')
  })

  it('★ execute：字元以數字碼存放時也要對（核心的轉型踩過這個坑）', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(lift(`int main(){ char c = 97; cout << isalpha(c); }`))
    expect(i.getOutput().join(''), "97 是 'a'——取成 '9' 的話會回 0").toBe('1')
  })
})
