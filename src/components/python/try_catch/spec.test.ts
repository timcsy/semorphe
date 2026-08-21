/** `python:try_catch` 的自證測。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (c: string): Promise<string[]> => componentIdsOf(await liftPython(c))
const rt = async (c: string): Promise<string> => gen(await liftPython(c)).trim()

const ONE = 'try:\n    n = 1\nexcept ValueError:\n    print("bad")'

describe('python:try_catch', () => {
  it('lift：一個 except 收得了', async () => {
    const got = await ids(ONE + '\n')
    expect(got, '正向錨點').toContain('python:try_catch')
    expect(got).not.toContain('unresolved')
  })

  /**
   * 🔴 **這一支原本釘的是舊邊界**：第一版只收一個 `except`，理由是
   * 「收一半會產出少了分支的合法程式」。那個判斷是對的，而**教學語料的
   * 第一段就有兩個**，所以邊界往前推了一格。
   *
   * > **一條「還沒支援」的測試，在支援的那天要改成「支援到哪裡」。**
   */
  it('🔴 多個 except 收得了，而每一個都是自己的一顆', async () => {
    const two = 'try:\n    n = 1\nexcept ValueError:\n    print("a")\nexcept KeyError:\n    print("b")\n'
    const got = await ids(two)
    expect(got).toContain('python:try_catch')
    expect(got.filter((i) => i === 'python:exception_case'), '兩個分支要是兩顆').toHaveLength(2)
    expect(got).not.toContain('unresolved')
    expect(await rt(two), '產回去要有兩段').toBe(two.trim())
  })

  it('🔴 lift：有 finally 的也整顆降級——還沒有地方放它', async () => {
    const f = 'try:\n    n = 1\nexcept:\n    pass\nfinally:\n    print("done")\n'
    expect(await ids(f)).not.toContain('python:try_catch')
  })

  it('來回：有名字與沒名字都一字不差', async () => {
    expect(await rt(ONE + '\n')).toBe(ONE)
    const bare = 'try:\n    n = 1\nexcept:\n    print("bad")'
    expect(await rt(bare + '\n')).toBe(bare)
  })

  /**
   * 🔴 **今天第一個分支永遠接住**——這個直譯器沒有例外的類別階層。
   * 那是一個已知的簡化（見執行器的檔頭），而**它比整顆降級好**：
   * 程式跑得動、積木看得見，而那一行說清楚它哪裡還不對。
   */
  it('🟡 已知的簡化：例外的名字今天不比對', async () => {
    const out = await runPython('try:\n    x = [1]\n    print(x[9])\nexcept KeyError:\n    print("第一個")\nexcept IndexError:\n    print("第二個")\n')
    expect(out, '真 Python 會印「第二個」——這一支釘住我們今天的行為').toContain('第一個')
  })

  it('執行：出錯時跳到處理那一段', async () => {
    const out = await runPython('try:\n    x = [1]\n    print(x[9])\nexcept:\n    print("接住了")\n')
    expect(out).toContain('接住了')
  })

  it('執行：沒出錯時不跑處理那一段', async () => {
    const out = await runPython('try:\n    print("ok")\nexcept:\n    print("不該印")\n')
    expect(out).toContain('ok')
    expect(out).not.toContain('不該印')
  })

  it('🔴 執行：控制流訊號不得被抓走', async () => {
    // `break` 是用丟出來實作的——抓住它會讓迴圈安靜地壞掉
    const out = await runPython('for i in range(5):\n    try:\n        if i > 1:\n            break\n        print(i)\n    except:\n        print("不該印")\n')
    expect(out, '`break` 被 except 抓走了').not.toContain('不該印')
    expect(out).toContain('0')
    expect(out).toContain('1')
  })
})

/**
 * 🔴 **`except X as e:` 的那個 `e`**（2026-08-22 語料抓到）。
 *
 * 型別與接住的名字曾經被壓成**一個字串**（`"ValueError as e"`）：
 * 來回轉換一字不差，而**執行時 `e` 是一個沒有宣告的變數**。
 *
 * > **一個把兩件事壓成一個字串的欄位，會在需要【用】其中一件的那天才出聲。**
 */
describe('接住的名字', () => {
  it('🔴 `as e` 要綁到分支裡', async () => {
    const out = await runPython('try:\n    raise ValueError("壞了")\nexcept ValueError as e:\n    print(e)\n')
    expect(out).toContain('壞了')
  })

  it('🔴 那個名字只活在這個分支裡', async () => {
    const out = await runPython('try:\n    raise ValueError("壞了")\nexcept ValueError as e:\n    pass\n\nprint(e)\n')
    expect(out, '分支外面還看得到 e ＝ 它漏到外層作用域了').toMatch(/例外|錯誤|Error/)
  })

  it('★ 對照組：沒有 `as` 的仍然接得住', async () => {
    expect(await runPython('try:\n    raise ValueError("x")\nexcept ValueError:\n    print("接到了")\n')).toContain('接到了')
  })

  it('★ 來回轉換：`as e` 要原樣產得回去', async () => {
    const code = 'try:\n    n = 1\nexcept ValueError as e:\n    print(e)\n'
    expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
  })
})
