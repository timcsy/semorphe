/** `python:return` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen } from '../../../../tests/helpers/python-lift'

describe('python:return', () => {
  it('★ lift：帶值與不帶值都認得出來', async () => {
    expect(componentIdsOf(await liftPython('def f():\n    return 1\n'))).toContain('python:return')
    expect(componentIdsOf(await liftPython('def f():\n    return\n'))).toContain('python:return')
  })

  it('🔴 裸的 `return` 不得被補成 `return None`', async () => {
    // 原文是哪一個要記得——補一個 None 會讓來回轉換改寫使用者的程式碼
    expect(gen(await liftPython('def f():\n    return\n'))).toBe('def f():\n    return')
  })

  it('★ generate ＋ round-trip', async () => {
    expect(gen(await liftPython('def f():\n    return a + b\n')))
      .toBe('def f():\n    return a + b')
  })
})
