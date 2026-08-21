/** `python:raw_expression` 的自證測（spec 170）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:raw_expression —— 運算式位置的降級落點', () => {
  it('🔴 降級積木的型別是 Python 的，不是別的語言的', async () => {
    const { degradationBlocks, setDegradationLanguage } = await import('../../../core/degradation-blocks')
    await import('../../../languages/python/pack')
    setDegradationLanguage('python')
    const d = degradationBlocks()
    expect(d, '★ 錨點：python 要宣告過降級積木').toBeTruthy()
    expect(d!.expression).toBe('python_raw_expression')
  })

  it('★ 認不出來的【運算式】原文一字不差地留著', async () => {
    const src = 'x = a if b else c\n'
    const t = await liftPython(src)
    expect(componentIdsOf(t).length, '★ 錨點').toBeGreaterThan(0)
    expect(gen(t), '認不出來的那一段原文掉了').toBe(src.trim())
  })

  it('🔴 執行它要【出聲】，不得靜默回 0', async () => {
    // 回一個預設值會讓「這段我看不懂」與「這段算出來是 0」長得一模一樣。
    const out = await runPython('x = a if b else c\nprint(x)\n')
    expect(out, '靜默跑完了 → 使用者以為它算對了').not.toContain('completed|0')
  })
})
