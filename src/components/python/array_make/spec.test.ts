/** 第二批五顆的自證測——串列／字典／取值／成員判斷。放同一個檔，因為它們互相組合。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => generatePython(await liftPython(c)).trim()

describe('python 容器四顆', () => {
  it('lift：四種寫法各自認得出來', async () => {
    expect(await ids('a = [1, 2]\n')).toContain('python:array_make')
    expect(await ids('d = {"k": 1}\n')).toContain('python:map_make')
    expect(await ids('d = {"k": 1}\n')).toContain('python:pair_make')
    expect(await ids('x = a[0]\n')).toContain('python:container_at')
    expect(await ids('y = "k" in d\n')).toContain('python:container_find')
  })

  it('lift：全部不降級（負向——上面的正向錨點先證明量得到）', async () => {
    for (const c of ['a = [1, 2]\n', 'd = {"k": 1}\n', 'x = a[0]\n', 'y = "k" in d\n']) {
      expect(await ids(c), c).not.toContain('unresolved')
    }
  })

  it('lift：比較運算子仍走同族那顆，沒有被搶走', async () => {
    const got = await ids('y = a < b\n')
    expect(got, '`<` 被成員判斷搶走了 → 兩筆樣式的路由重疊了').toContain('python:compare')
    expect(got).not.toContain('python:container_find')
  })

  it('來回：一字不差', async () => {
    for (const c of ['a = [1, 2]', 'd = {"k": 1, "j": 2}', 'x = a[0]', 'x = d["k"]',
                     'y = "k" in d', 'y = "k" not in d', 'a = []']) {
      expect(await rt(c + '\n'), c).toBe(c)
    }
  })

  it('執行：串列與索引', async () => {
    expect(await runPython('a = [3, 1, 4]\nprint(a[0])\nprint(a[-1])\n')).toContain('3')
    expect(await runPython('a = [3, 1, 4]\nprint(a[-1])\n')).toContain('4')
  })

  it('執行：字典查值，而查的是【鍵】', async () => {
    expect(await runPython('d = {"小明": 12}\nprint(d["小明"])\n')).toContain('12')
    expect(await runPython('d = {"小明": 12}\nprint("小明" in d)\nprint(12 in d)\n')).toContain('True')
    expect(await runPython('d = {"小明": 12}\nprint(12 in d)\n'), '字典比的是鍵不是值').toContain('False')
  })

  it('🔴 執行：取不到就停下來，不回一個看不出來的預設值', async () => {
    const outOfRange = await runPython('a = [1]\nprint(a[9])\n')
    expect(outOfRange, `靜默印出來了：${JSON.stringify(outOfRange)}`).not.toMatch(/^\s*(0|undefined)?\s*$/)
    const noKey = await runPython('d = {"a": 1}\nprint(d["b"])\n')
    expect(noKey).not.toMatch(/^\s*(0|undefined)?\s*$/)
  })
})
