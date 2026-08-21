/** `python:func_def` 的自證測（spec 168）。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:func_def', () => {
  it('★ lift：認得出來，body 也接得進來', async () => {
    const ids = componentIdsOf(await liftPython('def add(a, b):\n    return a + b\n'))
    expect(ids, '沒認出函式定義 → 下面會空過').toContain('python:func_def')
    expect(ids, 'body 沒接進來').toContain('python:return')
  })

  it('🔴 參數是【結構節點】不是一個字串——這是 mutation 的前提', async () => {
    const t = await liftPython('def add(a, b):\n    return a\n')
    const find = (n: typeof t): typeof t =>
      !n ? null : n.componentId === 'python:func_def' ? n
        : Object.values(n.children ?? {}).flat().map((k) => find(k)).find(Boolean) ?? null
    const fd = find(t)!
    expect(fd.children.params?.length, '🔴 兩個參數要是兩格——一個逗號分隔的字串表達不出「兩格」').toBe(2)
    expect(fd.children.params!.map((p) => p.properties.name)).toEqual(['a', 'b'])
    expect(gen(t)).toBe('def add(a, b):\n    return a')
  })

  /**
   * 🔴 **這一支原本釘的是舊邊界**（2026-08-21 前）：
   * 「`b=1` 是 default_parameter —— 收一半的話 `def f(a, b=1)` 會產回
   * `def f(a, b)`，而使用者的預設值就不見了」，所以整顆走誠實降級。
   *
   * 那個判斷是對的，而**邊界往前推了一格**。現在它釘的是新的那一格。
   *
   * > **一條「還沒支援」的測試，在支援的那天要改成「支援到哪裡」，
   * > 不是刪掉——刪掉的話下一個人不知道曾經有過一條線。**
   */
  it('🔴 預設值收得了，而它不得【只收一半】', async () => {
    const t = await liftPython('def f(a, b=1):\n    return a\n')
    expect(componentIdsOf(t), '正向錨點').toContain('python:func_def')
    expect(componentIdsOf(t)).not.toContain('unresolved')
    expect(gen(t), '⚠️ 預設值被吃掉了 → 產出的碼合法而行為不同').toBe('def f(a, b=1):\n    return a')
  })

  it('🔴 `*args`／`**kwargs` 仍然整顆走誠實降級——還沒有地方放它們', async () => {
    const ids = componentIdsOf(await liftPython('def f(*args):\n    return 1\n'))
    expect(ids, '收一半會讓使用者的東西不見').not.toContain('python:func_def')
  })

  it('執行：沒給的引數用預設值，給了就用給的', async () => {
    const out = await runPython('def greet(n, g="你好"):\n    return g + ", " + n\n\nprint(greet("小明"))\nprint(greet("小華", "嗨"))\n')
    expect(out).toContain('你好, 小明')
    expect(out).toContain('嗨, 小華')
  })

  it('🔴 執行：認不得的預設值要出聲，不得當成字串', async () => {
    // `def f(x=[])` —— 靜默當字串會讓 x 變成文字 `"[]"`，而那會一路算下去
    const out = await runPython('def f(x=[]):\n    return x\n\nprint(f())\n')
    expect(out).toMatch(/例外|錯誤|Error/)
  })

  it('★ 零參數也走得完', async () => {
    expect(gen(await liftPython('def go():\n    print(1)\n')))
      .toBe('def go():\n    print(1)')
  })
})
