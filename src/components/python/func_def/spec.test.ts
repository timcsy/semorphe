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

  /**
   * ⚠️ **這條原本釘的是「`*args` 與 `**kwargs` 都整顆降級」，而邊界在
   * 2026-08-22 移動了一半**——`*args` 收得下（星號是一個標記），
   * 而 `**kwargs` 仍然降級：它要的是「把剩下的具名引數收成一個字典」，
   * 那是另一件事。
   *
   * 邊界移動時要**改成釘新的邊界，不是刪掉它**。
   */
  it('🔴 `**kwargs` 仍然整顆走誠實降級——它要的是另一件事', async () => {
    const ids = componentIdsOf(await liftPython('def f(**kw):\n    pass\n'))
    expect(ids, '收一半會讓使用者的東西不見').not.toContain('python:func_def')
  })

  it('執行：沒給的引數用預設值，給了就用給的', async () => {
    const out = await runPython('def greet(n, g="你好"):\n    return g + ", " + n\n\nprint(greet("小明"))\nprint(greet("小華", "嗨"))\n')
    expect(out).toContain('你好, 小明')
    expect(out).toContain('嗨, 小華')
  })

  it('🟢 容器字面的預設值收了（2026-08-23）——而那個【共用】的陷阱要照實現', async () => {
    // ⚠️ 這條原本釘的是「`def f(x=[])` 要出聲」，而 2026-08-23 收了容器字面
    //    ——**邊界移動時要改成釘新的邊界，不是刪掉它**。
    expect(await runPython('def f(x=[]):\n    return x\n\nprint(f())\n')).toContain('[]')
    // 🔴 **同一個串列在每次呼叫之間共用**——那是 Python 最有名的陷阱之一，
    //    每次給一份新的會印出一個真的 Python 不會印的答案。
    const out = await runPython(
      'def collect(item, bucket=[]):\n    bucket.append(item)\n    return bucket\n\n' +
      'print(collect("a"))\nprint(collect("b"))\nprint(collect("c", []))\n')
    expect(out).toContain("['a']")
    expect(out).toContain("['a', 'b']")
    expect(out).toContain("['c']")
  })

  it('🔴 執行：仍然認不得的預設值要出聲，不得當成字串', async () => {
    // `def f(x=g())` —— 靜默當字串會讓 x 變成文字 `"g()"`，而那會一路算下去
    const out = await runPython('def f(x=len([1])):\n    return x\n\nprint(f())\n')
    expect(out).toMatch(/例外|錯誤|Error/)
  })

  it('★ 零參數也走得完', async () => {
    expect(gen(await liftPython('def go():\n    print(1)\n')))
      .toBe('def go():\n    print(1)')
  })
})

/**
 * 🔴 **`*args`**（2026-08-22）。星號是一個**標記**不是名字的一部分
 * ——名字裡的星號會讓每一個讀名字的人各自再解析一次。
 */
describe('可變引數', () => {
  it('🔴 execute：剩下的位置引數收成一串', async () => {
    const out = await runPython('def total(*nums):\n    s = 0\n    for n in nums:\n        s += n\n    return s\n\nprint(total(1, 2, 3))\nprint(total())\n')
    expect(out).toContain('6')
    expect(out, '一個引數都不給時是空的').toContain('0')
  })

  it('★ 來回：星號要產得回去', async () => {
    const code = 'def total(*nums):\n    return 0\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })

  it('🔴 `**kwargs` 仍然走誠實降級——它要的是另一件事', async () => {
    expect(componentIdsOf(await liftPython('def f(**kw):\n    pass\n'))).not.toContain('python:func_def')
  })
})
