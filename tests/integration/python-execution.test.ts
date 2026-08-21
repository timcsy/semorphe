/**
 * spec 170：**Python 的執行期**。
 *
 * ## 動手前的量測（2026-08-21）
 *
 * ```
 * x = 5 / y = x + 3 / print(y)      →  RUNTIME_ERR_UNKNOWN_COMPONENT: python:program
 * for i in range(3): print(i)       →  同上
 * def add(a,b): … print(add(2,3))   →  同上
 * ```
 *
 * 🔴 **每一段都在根節點就掛**。而它的後果比「不能跑」更大：
 *
 * > **17 顆元件的執行器【存在、被登記了、而從來沒有被跑過一次】**
 * > ——因為根節點擋在前面。
 *
 * 那正是這個專案記過的病：**機制有了，沒人接上**。
 * 而它今天不會讓任何測試變紅——**因為沒有任何測試在跑 Python**。
 */
import { describe, it, expect } from 'vitest'
import { runPython } from '../helpers/python-lift'

describe('spec 170 · Python 的執行期', () => {
  it('★ 錨點：先證明「跑得起來」這件事量得到——C++ 那側是通的', async () => {
    // 這一支不驗 Python。它驗的是【量測方法本身】：
    // 如果 runPython 的管線壞了，下面每一條都會以同一種方式失敗，
    // 而那會讓人去查 Python 的執行器——查錯地方。
    const out = await runPython('print("錨點")\n')
    expect(out, '連 print 都跑不起來 → 先查管線，不要查元件').toContain('錨點')
  })

  it('🔴 指派 ＋ 算術 ＋ 輸出', async () => {
    expect(await runPython('x = 5\ny = x + 3\nprint(y)\n')).toBe('completed|8\n')
  })

  it('🔴 for 迴圈走得完 range', async () => {
    expect(await runPython('for i in range(3):\n    print(i)\n')).toBe('completed|0\n1\n2\n')
  })

  it('🔴 函式定義 ＋ 呼叫 ＋ 回傳', async () => {
    expect(await runPython('def add(a, b):\n    return a + b\nprint(add(2, 3))\n'))
      .toBe('completed|5\n')
  })

  it('🔴 if / elif / else 三條分支各走一次', async () => {
    const src = (n: number) => `x = ${n}\nif x < 0:\n    print("負")\nelif x == 0:\n    print("零")\nelse:\n    print("正")\n`
    expect(await runPython(src(-1))).toBe('completed|負\n')
    expect(await runPython(src(0))).toBe('completed|零\n')
    expect(await runPython(src(1))).toBe('completed|正\n')
  })

  it('🔴 while ＋ 短路的邏輯運算', async () => {
    expect(await runPython('n = 3\nwhile n > 0 and True:\n    print(n)\n    n = n - 1\n'))
      .toBe('completed|3\n2\n1\n')
  })

  it('🔴 Python 的 `/` 是浮點除法——與 C++ 的整數除法【不同】', async () => {
    // 這一條是這個語言最容易被抄錯的一格：`7 / 2` 在 C++ 是 3，在 Python 是 3.5
    expect(await runPython('print(7 / 2)\n')).toBe('completed|3.5\n')
    expect(await runPython('print(7 // 2)\n')).toBe('completed|3\n')
  })

  it('🔴 取餘數跟著除數的正負號——`-7 % 3` 是 2 不是 -1', async () => {
    expect(await runPython('print(-7 % 3)\n')).toBe('completed|2\n')
  })

  it('🔴 input() 讀進來永遠是【字串】', async () => {
    expect(await runPython('name = input()\nprint("嗨", name)\n', ['小明']))
      .toBe('completed|嗨 小明\n')
  })

  it('🔴 提示要【先印出來】，不然使用者對著空的輸入框發呆', async () => {
    expect(await runPython('x = input("請輸入名字：")\nprint("hello,", x)\n', ['小明']))
      .toBe('completed|請輸入名字：hello, 小明\n')
  })

  it('🔴 沒有輸入時的錯誤訊息要說【實話】，不得說「我看不懂這段程式」', async () => {
    // ⚠️ 使用者 2026-08-21 回報：按執行 → 主控台印出提示 → 跳出
    //    「這一段程式我看不懂，所以沒有辦法執行它」——**而程式碼一點問題都沒有**。
    //    根因是這一格借用了 `UNRECOGNIZED_CODE`。
    //
    // > **一個錯誤代碼被拿去兼差時，它的訊息會對著一個完全不同的情境說話
    // > ——而那個訊息會把使用者送去改一段沒有壞的程式碼。**
    const out = await runPython('x = input()\nprint(x)\n')  // 刻意不餵 stdin
    expect(out, '★ 錨點：它要真的失敗，否則下面在驗一個沒發生的事').toContain('<執行例外')
    expect(out, '🔴 又在說「我看不懂」了').not.toContain('UNRECOGNIZED_CODE')
    expect(out).toContain('NO_MORE_INPUT')
  })

  it('🔴 認不出來的語法【出聲】，不得靜默跳過', async () => {
    const out = await runPython('class Foo:\n    pass\n')
    expect(out, '一段執行不了的程式碼靜默結束 → 使用者以為它跑成功了').not.toBe('completed|')
  })

  it('★ 反向：C++ 那側一個字都不變', async () => {
    // 這一支釘的是「加 Python 的執行器不得動到 C++ 的行為」。
    const { SemanticInterpreter } = await import('../../src/interpreter/interpreter')
    const { registerCppExecutors } = await import('../../src/languages/cpp/generators/index')
    const { createTestLifter } = await import('../helpers/setup-lifter')
    const { CppParser } = await import('../../src/languages/cpp/parser')
    registerCppExecutors()
    const p = new CppParser(); await p.init('public')
    const tree = createTestLifter().lift((await p.parse('int main(){int a=7/2;printf("%d\\n",a);return 0;}')).rootNode as never)
    const interp = new SemanticInterpreter()
    await interp.execute(tree!, [])
    expect(interp.getOutput().join(''), 'C++ 的 7/2 必須still是 3（整數除法）').toBe('3\n')
  })
})
