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

  it('🔴 標頭的註解落在【區塊裡的第一句】——它是一顆真的註解積木', async () => {
    // 使用者 2026-08-23：「用灰色註解積木就好」「一般的 statement 註解在上面，
    // 而對於結構，註解在區塊內」——理由是**讓學生比較容易看到註解**。
    expect((await roundTrip('if a != 0:  # 為什麼\n    x = 1\n')).trim())
      .toBe('if a != 0:\n    # 為什麼\n    x = 1')
  })

  it('🔴 一般語句的行末註解落在【它上面那一行】', async () => {
    expect((await roundTrip('x = 1  # 起始值\n')).trim()).toBe('# 起始值\nx = 1')
  })

  it('🔴 `elif`／`else` 的標頭——它們掛在【子句】上，只有那顆元件知道是第幾支', async () => {
    const code = 'if r > 0:  # 大於\n    x = 1\nelif r == 0:  # 等於\n    x = 2\nelse:  # 小於\n    x = 3\n'
    expect(await keepsComments(code)).toEqual([])
    expect((await roundTrip(code)).trim(), '每一支的註解要落在【那一支的區塊裡】')
      .toBe('if r > 0:\n    # 大於\n    x = 1\nelif r == 0:\n    # 等於\n    x = 2\nelse:\n    # 小於\n    x = 3')
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

  /**
   * 🔴 **區塊的第一行是註解時，它掛在【語句】上而不在區塊裡**（2026-08-24）。
   *
   * 使用者：「我還發現 **Python 程式碼到積木會丟失註解**。」量到的 AST：
   *
   * ```
   * if_statement @0
   *   :(anon)  @0
   *   comment  @1  "# 首"   ← 在這裡
   *   block    @2           ← 而不是在這裡
   * ```
   *
   * 於是「區塊第一行是註解」的每一種都掉字，而「最後一行是註解」好好的。
   *
   * > **一個「同一列」的判準，答得出「它屬於哪一行」，答不出「它屬於誰」。**
   */
  it('🔴 註解在區塊的【第一行】——四種區塊 ＋ 兩種子句', async () => {
    for (const code of [
      'if a:\n    # 首\n    x = 1\n',
      'if a:\n    # 只有\n    pass\n',
      'def f():\n    # 首\n    return 1\n',
      'for i in xs:\n    # 首\n    print(i)\n',
      'while a:\n    # 首\n    a = 0\n',
      'if a:\n    x = 1\nelse:\n    # 首\n    y = 2\n',
      'if a:\n    x = 1\nelif b:\n    # 首\n    y = 2\n',
      'try:\n    # 首\n    x = 1\nexcept ValueError:\n    # 也是首\n    x = 2\n',
    ]) {
      expect((await roundTrip(code)).trim(), code).toBe(code.trim())
    }
  })

  it('🔴 註解埋在【運算式】裡沒有一行放它——整句誠實降級，不准安靜丟掉', async () => {
    // ⚠️ 這一條釘的是「不可以是中間狀態」：要嘛收下、要嘛原文逐字留著。
    const code = 'x = (1 +  # 加\n     2)\n'
    expect(await keepsComments(code), '安靜丟掉＝產出合法而使用者打的字沒了').toEqual([])
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
