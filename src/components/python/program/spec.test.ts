/** `python:program` 的自證測（spec 170）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:program —— 程式的根', () => {
  it('★ lift：任何一段程式的根都是它', async () => {
    const t = await liftPython('x = 1\n')
    expect(t?.componentId, '根不是它 → 下面全部無意義').toBe('python:program')
  })

  it('🔴 執行：由上而下跑一次，【沒有進入點】', async () => {
    // C++ 要找 main（或 setup/loop）；Python 的模組層語句【就是】程式。
    expect(await runPython('print(1)\nprint(2)\n')).toBe('completed|1\n2\n')
  })

  it('🔴 `def` 之後的語句照樣繼續跑——def 只是把函式登記起來', async () => {
    expect(await runPython('def f():\n    print("裡面")\nprint("外面")\nf()\n'))
      .toBe('completed|外面\n裡面\n')
  })

  it('⚠️ 它【沒有】積木，而那是對的——程式根是畫布本身', async () => {
    const { componentBlocks } = await import('../../../core/component/registry')
    const forms = (componentBlocks() as { componentId: string }[])
      .filter((f) => f.componentId === 'python:program')
    expect(forms, '程式根長出積木了 → 那會多一顆學生拖得出來的空殼').toEqual([])
  })
})
