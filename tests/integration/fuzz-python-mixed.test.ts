/**
 * spec 170：**Python 的盲測回歸**——`component-fuzz` 第一輪的永久化。
 *
 * ## 這一批題目是怎麼挑的
 *
 * 按**教學上的典型**挑（初學 Python 課會出現的程式），
 * 而**不是**按「我實作了哪些元件」挑。
 *
 * ⚠️ **而隔離比 skill 設計的弱**：這個 session 不能用 Agent tool，
 * 所以出題的人（我）看得到實作。保住的是「不按實作挑題」，
 * 失去的是「問得到我完全沒想過的語法」。**兩者的差別要記著。**
 *
 * ## 第一輪抓到什麼（12 題）
 *
 * ```
 * 🔴 "ab" * 3 靜靜印出 0.0     字串只處理了 `+`，`*` 掉進數值運算 → NaN
 *                              > 一個靜默的錯答案，比一個拋出來的錯誤貴得多
 * 🔴 break / continue 不存在   降級是誠實的，而【執行】到那顆積木時整支程式中止
 *                              > 一個誠實的降級，在執行那一路上仍然是一個中止
 * 🟡 空行被吃掉（4 題）         已知、與語言無關（C++ 也一樣），記在 vision
 * 🟡 len() 沒有元件            誠實地拋 UNDEFINED_FUNC —— 見下面的 todo
 * ```
 *
 * 前兩條**當場修掉**（skill 的步驟五之二：能修的立刻修）。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython, runPython } from '../helpers/python-lift'

describe('spec 170 · Python 盲測回歸（第一輪，12 題）', () => {
  it("fuzz_01：整數與浮點除法的差別", async () => {
    // 學生最常撞的一格：/ 與 // 在 Python 的結果不同
    const src = "a = 17\nb = 5\nprint(a + b)\nprint(a - b)\nprint(a * b)\nprint(a / b)\nprint(a // b)\nprint(a % b)\nprint(a ** 2)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|22\n12\n85\n3.4\n3\n2\n289\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_02：成績分級", async () => {
    // elif 鏈，而邊界值剛好落在等號上
    const src = "score = 85\nif score >= 90:\n    print(\"A\")\nelif score >= 80:\n    print(\"B\")\nelif score >= 70:\n    print(\"C\")\nelse:\n    print(\"D\")\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|B\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_03：九九乘法表的一列", async () => {
    // 迴圈變數在迴圈外還看得到（Python 沒有區塊作用域）
    const src = "n = 7\nfor i in range(1, 10):\n    print(n, \"x\", i, \"=\", n * i)\nprint(\"最後的 i 是\", i)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n最後的 i 是 9\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_04：函式呼叫函式", async () => {
    // 兩層呼叫，而內層的參數名與外層的變數同名
    const src = "def square(x):\n    return x * x\n\ndef sum_of_squares(a, b):\n    return square(a) + square(b)\n\nx = 3\nprint(sum_of_squares(x, 4))\nprint(x)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|25\n3\n")
    // ⚠️ 這一題【只差空行】——`preserveBlankLines` 只接在擴充那側，
    //    而網頁版會吃掉它。比對時濾掉空行，**而那個缺口記在 vision 上**。
    const noBlank = (s: string) => s.split('\n').filter((l) => l.trim() !== '').join('\n')
    expect(noBlank(generatePython(await liftPython(src))), '轉一圈之後文字漂了')
      .toBe(noBlank(src.trim()))
  })
  it("fuzz_05：累加與提前結束", async () => {
    // break 讓迴圈提前結束，而累加值要留著
    const src = "total = 0\nfor i in range(1, 100):\n    total = total + i\n    if total > 50:\n        break\nprint(total)\nprint(i)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|55\n10\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_06：短路求值", async () => {
    // and 的右邊在左邊為假時【不會被求值】
    const src = "def loud(name, value):\n    print(\"算了\", name)\n    return value\n\nif loud(\"A\", False) and loud(\"B\", True):\n    print(\"都真\")\nelse:\n    print(\"不都真\")\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|算了 A\n不都真\n")
    // ⚠️ 這一題【只差空行】——`preserveBlankLines` 只接在擴充那側，
    //    而網頁版會吃掉它。比對時濾掉空行，**而那個缺口記在 vision 上**。
    const noBlank = (s: string) => s.split('\n').filter((l) => l.trim() !== '').join('\n')
    expect(noBlank(generatePython(await liftPython(src))), '轉一圈之後文字漂了')
      .toBe(noBlank(src.trim()))
  })
  it("fuzz_07：巢狀迴圈找質數", async () => {
    // 內層迴圈的旗標變數，以及 continue
    const src = "for n in range(2, 20):\n    is_prime = True\n    d = 2\n    while d * d <= n:\n        if n % d == 0:\n            is_prime = False\n        d = d + 1\n    if not is_prime:\n        continue\n    print(n)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|2\n3\n5\n7\n11\n13\n17\n19\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_08：遞迴階乘", async () => {
    // 遞迴的終止條件，以及回傳值一路往上傳
    const src = "def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nfor i in range(1, 7):\n    print(i, fact(i))\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|1 1\n2 2\n3 6\n4 24\n5 120\n6 720\n")
    // ⚠️ 這一題【只差空行】——`preserveBlankLines` 只接在擴充那側，
    //    而網頁版會吃掉它。比對時濾掉空行，**而那個缺口記在 vision 上**。
    const noBlank = (s: string) => s.split('\n').filter((l) => l.trim() !== '').join('\n')
    expect(noBlank(generatePython(await liftPython(src))), '轉一圈之後文字漂了')
      .toBe(noBlank(src.trim()))
  })
  it("fuzz_09：負數的取餘數與整除", async () => {
    // Python 的 % 跟著除數的正負號，與 C 系語言不同
    const src = "print(-7 % 3)\nprint(7 % -3)\nprint(-7 // 3)\nprint(7 // -3)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|2\n-2\n-3\n-3\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_11：布林值的印法與真假判斷", async () => {
    // Python 印 True/False 而不是 1/0，且 0 是假值
    const src = "print(1 < 2)\nprint(1 > 2)\nx = 0\nif x:\n    print(\"真\")\nelse:\n    print(\"假\")\nprint(not x)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|True\nFalse\n假\nTrue\n")
    expect(generatePython(await liftPython(src)), '轉一圈之後文字漂了').toBe(src.trim())
  })
  it("fuzz_12：沒有 return 的函式", async () => {
    // 沒有 return 的函式回傳 None，而印出來是 None 不是空白
    const src = "def greet(name):\n    print(\"嗨\", name)\n\nr = greet(\"小明\")\nprint(r)\n"
    expect(await runPython(src), '執行結果與真的 python3 不同').toBe("completed|嗨 小明\nNone\n")
    // ⚠️ 這一題【只差空行】——`preserveBlankLines` 只接在擴充那側，
    //    而網頁版會吃掉它。比對時濾掉空行，**而那個缺口記在 vision 上**。
    const noBlank = (s: string) => s.split('\n').filter((l) => l.trim() !== '').join('\n')
    expect(noBlank(generatePython(await liftPython(src))), '轉一圈之後文字漂了')
      .toBe(noBlank(src.trim()))
  })

  // 🔴 **待修**：`len()` 這一族的內建函式還沒有元件。
  //    ⚠️ 而它【不是靜默的】——直譯器丟 `UNDEFINED_FUNC`，使用者看得到。
  //    何時修：Python 的內建函式那一刀（len / int / str / abs / max / min…）。
  //    在那之前這一支保持 `todo`，而**它的存在就是那一刀的入口**。
  it.todo("[UNSUPPORTED:Python 的內建函式（len／int／str／abs／max／min…）] fuzz_10：字串相加與重複")
})
