/** `python:throw` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

describe('python:throw', () => {
  it('★ lift：兩種形狀都認得出來', async () => {
    for (const code of ['raise ValueError("壞了")\n', 'raise KeyError\n']) {
      expect(componentIdsOf(await liftPython(code)), `${code.trim()} 沒認出來`).toContain('python:throw')
    }
  })

  it('🔴 認不得的形狀走誠實降級，不是安靜認錯', async () => {
    // `raise X from Y`（例外鏈）與裸的 `raise`（重新丟出）都沒有對應的語義
    for (const code of ['raise ValueError("a") from err\n']) {
      const ids = componentIdsOf(await liftPython(code))
      expect(ids, `${code.trim()} 被認走了，而我們表達不了它`).not.toContain('python:throw')
    }
  })

  it('generate ＋ round-trip：沒有訊息時不得產出一對空括號', async () => {
    for (const code of ['raise ValueError("壞了")\n', 'raise KeyError\n']) {
      expect(componentIdsOf(await liftPython(code))).toContain('python:throw')
      expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    }
  })

  it('🔴 execute：接住之後 `print(e)` 印的是【使用者寫的那句話】', async () => {
    const out = await runPython('try:\n    raise ValueError("除數不能是零")\nexcept ValueError as e:\n    print("錯誤：", e)\n')
    expect(out, `印出內部代碼的話學生看到的是我們的詞彙：${JSON.stringify(out)}`).toContain('錯誤： 除數不能是零')
  })

  it('🔴 execute：沒被接住時要傳到最外面，不是被吞掉', async () => {
    // ⚠️ 這支助手在例外傳到最外層時回的是例外本身（不是已經印出來的那幾行）
    //    ——所以這裡釘的是「它有沒有傳出去」，而後面那一行有沒有跑由下一條釘。
    const out = await runPython('raise ValueError("停")\n')
    expect(out, `被吞掉的話這裡會是 completed：${JSON.stringify(out)}`).toContain('執行例外')
    expect(out, '而傳出去的要帶著使用者寫的那句話').toContain('停')
  })

  it('🔴 execute：丟出去之後【後面那一行不跑】', async () => {
    const out = await runPython('try:\n    raise ValueError("停")\n    print("後")\nexcept ValueError:\n    print("接到了")\n')
    expect(out).toContain('接到了')
    expect(out, '丟出去之後還印了「後」＝例外沒有中斷那一段').not.toContain('後')
  })

  it('🔴 execute：訊息是一個運算式，不是一個字串欄位', async () => {
    const out = await runPython('n = 5\ntry:\n    raise ValueError(f"{n} 太大")\nexcept ValueError as e:\n    print(e)\n')
    expect(out).toContain('5 太大')
  })

  it('★ 對照組：系統自己丟的錯誤印的是【Python 的說法】，不是內部代碼', async () => {
    const out = await runPython('try:\n    print(1 / 0)\nexcept ZeroDivisionError as e:\n    print("E:", e)\n')
    expect(out, `印出 RUNTIME_ERR_… 的話，那個字串在任何一本 Python 教材裡都查不到：${JSON.stringify(out)}`)
      .toContain('E: division by zero')
  })
})
