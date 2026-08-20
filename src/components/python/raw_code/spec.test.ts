/**
 * `python:raw_code` 的自證測（spec 168）。
 *
 * ⚠️ **每條負向前面先釘一個正向錨點**——`lift` 回 null 時集合是空的，
 * 負向斷言會空過，而一支空過的測試與健康的長得一模一樣。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf } from '../../../../tests/helpers/python-lift'
import { generateCode } from '../../../core/projection/code-generator'
import googleStyle from '../../../languages/cpp/styles/google.json'
import type { StylePreset, SemanticNode } from '../../../core/types'

const gen = (t: SemanticNode | null) =>
  generateCode(t as SemanticNode, 'python', googleStyle as unknown as StylePreset).trim()

describe('python:raw_code — 降級的落點', () => {
  it('★ 認不出來的語句走誠實降級，而【不是】被套上 C++ 的身分', async () => {
    // `class` 還沒有元件 —— 這正是要驗的情況
    const ids = componentIdsOf(await liftPython('class Foo:\n    pass\n'))
    expect(ids.length, '★ 錨點：先要 lift 得出東西').toBeGreaterThan(0)
    expect(ids.filter((i) => i.startsWith('cpp:')),
      '🔴 Python 的節點被套上了 C++ 的身分').toEqual([])
  })

  it('🔴 降級積木的型別是 Python 的，不是 C++ 的', async () => {
    const { degradationBlocks, setDegradationLanguage } = await import('../../../core/degradation-blocks')
    await import('../../../languages/python/pack')
    setDegradationLanguage('python')
    const d = degradationBlocks()
    expect(d, '★ 錨點：python 要宣告過降級積木').toBeTruthy()
    expect(d!.statement).toBe('python_raw_code')
    expect(d!.expression).toBe('python_raw_expression')
  })

  it('⚠️ 沒宣告過的語言回 null——**不得回別的語言的**', async () => {
    const { degradationBlocks, setDegradationLanguage } = await import('../../../core/degradation-blocks')
    setDegradationLanguage('沒有這個語言')
    expect(degradationBlocks(),
      '🔴 回了別的語言的降級積木 → 登記處又變回全域單槽了').toBeNull()
    setDegradationLanguage('python')
  })
})
