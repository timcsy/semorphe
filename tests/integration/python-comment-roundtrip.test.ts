/**
 * **註解走完整條路都要活著**——使用者回報「程式碼後面的註解不見了」（2026-08-23）。
 *
 * 那一句底下其實有**四個**缺陷，而它們各自在不同的一段路上：
 *
 * | 路 | 症狀 |
 * |---|---|
 * | 抬升 | `if a:  # 為什麼` 的註解是那個語句的**子節點**，沒有人去撿 |
 * | 抬升 | `elif` 的主體**只留第一行**——那不是註解，那是**整段程式碼**掉了 |
 * | 渲染／抽取 | 沒有 mutation 的積木**沒有 `extraState` 這條路**，註解到不了積木上 |
 * | 抽取 | 有 mutation 的積木的 `loadExtraState` **只讀自己那幾個鍵**，把別人的吃掉 |
 *
 * ⚠️ 四個都**不報錯**：產出的碼合法、積木畫得出來、測試全綠
 * ——而**使用者打的字沒了**。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython } from '../helpers/python-lift'

const roundTrip = async (code: string): Promise<string> => generatePython(await liftPython(code))

/** 原文裡每一句註解都要在產出的碼裡找得到。 */
async function keepsComments(code: string): Promise<string[]> {
  const out = await roundTrip(code)
  return code.split('\n')
    .filter((l) => l.includes('#'))
    .map((l) => l.slice(l.indexOf('#')).trim())
    .filter((c) => !out.includes(c))
}

describe('Python 的註解在來回一趟之後還在', () => {
  it('★ 錨點：一段沒有註解的碼本來就一字不差（否則下面的零是假的）', async () => {
    const code = 'x = 1\nif x > 0:\n    print(x)\n'
    expect((await roundTrip(code)).trim()).toBe(code.trim())
  })

  it('🔴 區塊標頭那一行的註解——`if`／`for`／`def`／`while`', async () => {
    for (const code of [
      'if a != 0:  # 如果 a 不等於 0\n    x = 1\n',
      'for i in range(3):  # 走訪\n    print(i)\n',
      'def f(x):  # 這個函式\n    return x\n',
      'while a:  # 迴圈\n    a = 0\n',
    ]) {
      expect(await keepsComments(code), code).toEqual([])
    }
  })

  it('🔴 `elif`／`else` 的標頭——它們掛在【子句】上，只有那顆元件知道是第幾支', async () => {
    const code = 'if r > 0:  # 大於\n    x = 1\nelif r == 0:  # 等於\n    x = 2\nelse:  # 小於\n    x = 3\n'
    expect(await keepsComments(code)).toEqual([])
  })

  it('🔴 `elif` 的主體**不只一行**——這一條釘的是【程式碼】不是註解', async () => {
    const code = 'if r > 0:\n    pass\nelif r == 0:\n    x = 1\n    print(x)\n'
    const out = await roundTrip(code)
    expect(out, '第二行整段掉了——不報錯、產出合法、而少了一行').toContain('print(x)')
    expect(out.trim()).toBe(code.trim())
  })

  it('🔴 `except`／`else`／`finally` 的標頭——與 `elif` 同一種形狀', async () => {
    const code = 'try:  # 試\n    x = 1\nexcept ValueError:  # 錯了\n    x = 2\nelse:  # 沒事\n    x = 3\nfinally:  # 收尾\n    x = 4\n'
    expect(await keepsComments(code), '只補了 `if` 那一種的話，這一種還是掉的').toEqual([])
    expect((await roundTrip(code)).trim()).toBe(code.trim())
  })

  it('🔴 降級的那一顆【不准】把註解印兩次——`class A:  # 類別`', async () => {
    const code = 'class A:  # 類別\n    pass\n'
    // 標頭註解讓這顆類別整顆降級（註解在 `block` 裡），而降級保留的是**原文**
    // ——核心再接一次的症狀是 `# 類別  # 類別`。
    expect((await roundTrip(code)).trim()).toBe(code.trim())
  })

  it('🔴 `for … else:` 與 `while … else:` 整段【不准】安靜消失', async () => {
    for (const code of [
      'for i in xs:  # 走\n    pass\nelse:  # 沒斷\n    pass\n',
      'while a:  # 迴圈\n    a = 0\nelse:  # 正常結束\n    pass\n',
    ]) {
      // ⚠️ 這一條釘的是【程式碼】不是註解：那兩顆元件沒有地方放 `else`，
      //    而在此之前它們**安靜地丟掉它**——產出的碼合法、少了一段。
      expect((await roundTrip(code)).trim(), code).toBe(code.trim())
    }
  })

  it('★ 使用者回報的那一段（一元二次方程式）——每一句註解都要在', async () => {
    const code = `if a != 0:      # 如果 a 不等於 0
    r = b**2 - 4*a*c      # 計算開根號內的數值
    if r > 0:               # 如果開根號內的數值大於 0
        x1 = int((b*-1 + r**0.5)/(2*a))     # 套用公式求出 x1
        print(x1)                           # 根據題目輸出結果
    elif r == 0:
        x = int((b*-1 + r**0.5)/(2*a))
        print(x)      # 根據題目輸出結果
    else:      # 如果開根號內的數值小於 0
        print('No real root')
else:          # 如果 a 等於 0
    print('No real root')
`
    expect(await keepsComments(code)).toEqual([])
    // 🔴 而 `elif` 那一支的兩行都要在——那是同一輪抓到的**程式碼**遺失
    const out = await roundTrip(code)
    expect(out).toContain('x = int((b * -1 + r ** 0.5) / (2 * a))')
    expect(out).toContain('print(x)')
  })
})
