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
 *
 * ## spec 205（重構 6c-3）：改由 Cella 背書
 *
 *   跑出來的值（算術、迴圈、函式、分支、/、%、input 是字串）   runCella(code, { lang: 'python' })——python 家族的判決
 *   提示要先印、沒輸入要說實話、認不出的語法要出聲             Cella 的 Python 工作階段（學生按執行走的那條）
 *   （⚠️ 這段刻意不用反引號圍起來：語料護欄把反引號之間的文字收成語料）
 *
 * 🟡 **「提示要先印出來」今天不成立——Cella 判錯**（2026-11-02 量到）：`input("請輸入名字：")` 停在 awaiting-input 時輸出是空的，
 * 提示要等讀到一行之後才出現；`print("a")` 再 `input()` 則看得到 `a`——不是送輸出的時機，是 Cella 的 `input` 先讀後寫提示
 * （CPython 先把提示寫到 stdout 再讀）。判決那條路（stdin 一次給完）的最終輸出是對的。見那一條的 knownCellaGap。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { expectCellaOut, knownCellaGap, runCella } from '../helpers/cella-run'
import { cellaProvider, openCella, pyFormal, waitSession } from '../helpers/cella-session'
import { liftPython } from '../helpers/python-lift'
import { setMessages, resetMessages } from '../../src/i18n/messages'
import { describeRuntimeStop } from '../../src/ui/runtime-message'
import type { Provider } from '../../src/core/capabilities'
import type { SemanticNode } from '../../src/core/types'
import zhTW from '../../src/i18n/zh-TW/blocks.json'

const py = (code: string, out: string, stdin = '') => expectCellaOut(code, out, { lang: 'python', stdin })

let p: Provider
async function pySession(code: string): Promise<{ tree: SemanticNode; s: ReturnType<typeof openCella>['s']; out: () => string }> {
  const tree = (await liftPython(code))!
  expect(tree, 'Python 的 lift 失敗（回 null）').not.toBeNull()
  const { s, out } = openCella(p, tree, { formal: pyFormal(tree) })
  return { tree, s, out }
}

describe('spec 170 · Python 的執行期（Cella 判決）', () => {
  it('★ 錨點：先證明「跑得起來」這件事量得到', async () => {
    // 這一支驗的是【量測方法本身】：管線壞了，下面每一條都會以同一種方式失敗——先查管線，不要查元件
    await py('print("錨點")\n', '錨點\n')
  })

  it('🔴 指派 ＋ 算術 ＋ 輸出', async () => {
    await py('x = 5\ny = x + 3\nprint(y)\n', '8\n')
  })

  it('🔴 for 迴圈走得完 range', async () => {
    await py('for i in range(3):\n    print(i)\n', '0\n1\n2\n')
  })

  it('🔴 函式定義 ＋ 呼叫 ＋ 回傳', async () => {
    await py('def add(a, b):\n    return a + b\nprint(add(2, 3))\n', '5\n')
  })

  it('🔴 if / elif / else 三條分支各走一次', async () => {
    const src = (n: number) => `x = ${n}\nif x < 0:\n    print("負")\nelif x == 0:\n    print("零")\nelse:\n    print("正")\n`
    await py(src(-1), '負\n')
    await py(src(0), '零\n')
    await py(src(1), '正\n')
  })

  it('🔴 while ＋ 短路的邏輯運算', async () => {
    await py('n = 3\nwhile n > 0 and True:\n    print(n)\n    n = n - 1\n', '3\n2\n1\n')
  })

  it('🔴 Python 的 `/` 是浮點除法——與 C++ 的整數除法【不同】', async () => {
    // 這一條是這個語言最容易被抄錯的一格：`7 / 2` 在 C++ 是 3，在 Python 是 3.5
    await py('print(7 / 2)\n', '3.5\n')
    await py('print(7 // 2)\n', '3\n')
  })

  it('🔴 取餘數跟著除數的正負號——`-7 % 3` 是 2 不是 -1', async () => {
    await py('print(-7 % 3)\n', '2\n')
  })

  it('🔴 input() 讀進來永遠是【字串】', async () => {
    await py('name = input()\nprint("嗨", name)\n', '嗨 小明\n', '小明\n')
    // 字串 ＋ 字串是接起來，不是相加——讀進來的若被當成數字，這裡會印 3
    await py('a = input()\nb = input()\nprint(a + b)\n', '12\n', '1\n2\n')
  })

  it('★ 反向：C++ 那側一個字都不變（7/2 是整數除法）', async () => {
    await expectCellaOut('#include <cstdio>\nint main(){int a=7/2;printf("%d\\n",a);return 0;}', '3\n')
  })
})

describe('spec 170 · Python 的執行期（Cella 工作階段：互動與訊息）', () => {
  beforeAll(async () => {
    p = await cellaProvider()
    const tree = (await liftPython('x = 1\n'))!
    await waitSession(p, tree, pyFormal(tree))
  }, 600_000)

  it('★ 讀輸入：停下來等，給了一行之後印出結果（提示的順序見下一條）', async () => {
    const { tree, s, out } = await pySession('x = input("請輸入名字：")\nprint("hello,", x)\n')
    expect(await s.launch(tree, { stopOnEntry: false }), '沒有停下來等＝拿空字串就走了').toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    expect(await s.supplyInput('小明')).toEqual({ kind: 'ended' })
    expect(out()).toBe('請輸入名字：hello, 小明\n')
  })

  /**
   * 🟡 **Cella 判錯（修好時這條會紅）**：提示要在**等輸入之前**就印出來，不然使用者對著空的輸入框發呆。
   * Cella 今天停在 awaiting-input 時輸出是空的（`print` 再 `input()` 則看得到——所以是 `input(prompt)` 先讀後寫，不是送輸出的時機）。
   */
  it('提示要【先印出來】——Cella 今天等到讀完才印', async () => {
    const { tree, s, out } = await pySession('x = input("請輸入名字：")\nprint("hello,", x)\n')
    expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    expect(out()).toBe('請輸入名字：')
    // 對照組：一般的 print 在等輸入之前就看得到——錯在 input 自己的提示，不在送輸出的時機
    const plain = await pySession('print("a")\nx = input()\n')
    await plain.s.launch(plain.tree, { stopOnEntry: false })
    expect(plain.out()).toBe('a\n')
  })

  it('🔴 沒有輸入時的錯誤要說【實話】（EOFError），不得說「我看不懂這段程式」', async () => {
    // ⚠️ 使用者 2026-08-21 回報：按執行 → 主控台印出提示 → 跳出「這一段程式我看不懂」——**而程式碼一點問題都沒有**。
    //    根因是這一格借用了 `UNRECOGNIZED_CODE`。
    // > **一個錯誤代碼被拿去兼差時，它的訊息會對著一個完全不同的情境說話。**
    const { tree, s } = await pySession('x = input()\nprint(x)\n')
    expect(await s.launch(tree, { stopOnEntry: false })).toMatchObject({ kind: 'stopped', stop: { reason: 'awaiting-input' } })
    const o = await s.closeInput()  // 使用者沒有輸入就結束了輸入（EOF）
    expect(o.kind, '★ 錨點：它要真的失敗，否則下面在驗一個沒發生的事').toBe('failed')
    if (o.kind !== 'failed') return
    expect(o.error.i18nKey, '🔴 又在說「我看不懂」了').not.toMatch(/UNRECOGNIZED|UNSUPPORTED|REJECTED/)
    expect(o.error.i18nKey).toBe('RUNTIME_ERR_UNCAUGHT_EXCEPTION')
    expect(o.error.params.type).toBe('EOFError')
    expect(o.error.nodeId, '要指回 input 那一行').toBeTruthy()
    setMessages(zhTW as unknown as Record<string, string>)
    const line = describeRuntimeStop(o.error.i18nKey, o.error.params)
    resetMessages()
    expect(line, '學生看到的那一句要說得出是 EOF').toContain('EOFError')
    // 🟢 spec 205 T012（D7）修好（原本是釘子）：那一句原本把例外的細節整包 JSON 印出來（「{"type":"EOFError",…}」）——
    //    正是 `lesson-mistakes` 那條「畫面上不得出現代號」的形狀。現在是「型別：說明」
    expect(line, '🔴 畫面上出現了 JSON').not.toMatch(/\{"/)
    expect(line).toContain('EOFError：EOF when reading a line')
    // 判決那條路（stdin 一次給完、是空的）同樣說實話：uncaught EOFError，不是 unknown／翻不出
    const r = await runCella('x = input()\nprint(x)\n', { lang: 'python' })
    expect(r.problems.map((x) => [x.kind, x.reason])).toEqual([['uncaught', expect.stringMatching(/^EOFError/)]])
  })

  it('🔴 認不出來的語法【出聲】，不得靜默跳過', async () => {
    const tree = (await liftPython('class Foo:\n    pass\n'))!
    const s = p.createSession!({ maxSteps: 1000, formal: pyFormal(tree) as never }, tree)
    expect('declined' in s, '一段執行不了的程式碼靜默結束 → 使用者以為它跑成功了').toBe(true)
    if ('declined' in s) expect(s.declined).toMatch(/還不支援/)
    const r = await runCella('class Foo:\n    pass\n', { lang: 'python' })
    expect(r.verdict, '判決那條路：翻不出，不是 accept').toBe('untranslated')
  })
})
