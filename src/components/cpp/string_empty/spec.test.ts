/**
 * `cpp:string_empty` 的自證測。
 *
 * ## ⚠️ 這一顆**沒有 lift 那一路**（第三個「路徑滿的但到不了」）
 *
 * `.empty()` 在辨識層被判成中性的 `cpp:container_empty`，所以這顆身分
 * **從程式碼永遠得不到**，只能從積木拖。
 * `#30` 的判定落點把它記為「**辨識到不了**」——補再多語料也碰不到。
 *
 * → `paths.lift` 是 `null` ＋ `_lift_why`，而這裡**不假裝測得到 lift**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { StylePreset } from '../../../core/types'

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  registerCppLanguage()
})

describe('膠囊自證：cpp:string_empty', () => {
  it('★ generate：產回 s.empty()', () => {
    const 樹 = createNode('cpp:program', {}, { body: [createNode('cpp:string_empty', { obj: 's' })] })
    expect(generateCode(樹, 'cpp', apcs as unknown as StylePreset)).toContain('s.empty()')
  })

  it('★ execute：空字串回 1、非空回 0', async () => {
    const 跑 = async (值: string): Promise<string> => {
      const i = new SemanticInterpreter({ maxSteps: 100000 })
      await i.execute(createNode('cpp:program', {}, {
        body: [
          createNode('cpp:string_declare', { name: 's' }, { value: [createNode('cpp:literal_string', { value: 值 })] }),
          createNode('cpp:print', {}, { values: [createNode('cpp:string_empty', { obj: 's' })] }),
        ],
      }))
      return i.getOutput().join('')
    }
    // ⚠️ C++ 的 cout 印 bool 是 1／0，不是 true／false
    expect(await 跑(''), '空字串').toBe('1')
    expect(await 跑('hi'), '非空字串').toBe('0')
  })
})
