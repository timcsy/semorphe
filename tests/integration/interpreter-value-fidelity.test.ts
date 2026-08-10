/**
 * **直譯器的值忠實度**——五個根因的回歸釘子（`specs/109`）。
 *
 * ## 這一支怎麼來的
 *
 * 第三十二條護欄（`specs/108`）第一次跑抓到 31 筆「直譯器與參照編譯器輸出不同」，
 * 而逐筆探測顯示**一筆 ≠ 一個工作**：四個根因涵蓋約 8 筆。
 *
 * 這裡把每個根因釘成**最小重現**——護欄用真實語料抓，這裡用一行抓。
 * 兩者缺一不可：護欄會發現新的，這裡防止修好的再壞。
 *
 * ## ⚠️ 為什麼要有這一支，而不是靠護欄就好
 *
 * 護欄的失敗訊息是「這 31 段程式輸出不同」，**它說不出為什麼**。
 * 而這五支說得出——一支紅，就知道是哪一個機制壞了。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

async function 跑(前置: string, 本體: string): Promise<string> {
  const tree = parser.parse(前置 + 本體)
  if (!tree) throw new Error('parse 失敗')
  const 語義樹 = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(語義樹)
  return i.getOutput().join('')
}

const IO = '#include <iostream>\nusing namespace std;\n'
const NUM = '#include <iostream>\n#include <numeric>\n#include <vector>\nusing namespace std;\n'

describe('值忠實度：直譯器印出來的，要與參照編譯器一致', () => {
  // ── 根因 1：char 轉型取了字串首字元 ──────────────────────────────
  it('★ char 持有數值時要印成字元', async () => {
    // 🔴 修之前印 `6`：`valueToString(66)` = "66"，再 `.charAt(0)`。
    // 與 `cctype/executors.ts` 的 `charOf` 是同一個坑——那裡修過了，核心沒有。
    expect(await 跑(IO, `int main(){ char c = 66; cout << c; }`)).toBe('B')
  })

  it('★ char 持有字元時仍然正確（不得因為修上面而壞掉）', async () => {
    expect(await 跑(IO, `int main(){ char c = 'B'; cout << c; }`)).toBe('B')
  })

  it('★ 明確轉型成 char 也要印成字元', async () => {
    expect(await 跑(IO, `int main(){ cout << (char)('a' - 32); }`)).toBe('A')
  })

  // ── 根因 2：浮點沒有 C++ 的預設六位有效數字 ────────────────────────
  it('★ 浮點預設六位有效數字', async () => {
    // 🔴 修之前印 `0.3333333333333333`（JS 的 String(number)）。
    expect(await 跑(IO, `int main(){ double d = 1.0/3; cout << d; }`)).toBe('0.333333')
  })

  it('★ 而整數值的浮點不得印成 1.000000（C++ 去尾零）', async () => {
    expect(await 跑(IO, `int main(){ double d = 1.0; cout << d; }`)).toBe('1')
  })

  it('★ 整數不受影響', async () => {
    expect(await 跑(IO, `int main(){ int n = 1000000; cout << n; }`)).toBe('1000000')
  })

  // ── 根因 3：catch 把 RuntimeValue 字串化 ─────────────────────────
  it('★ 例外攜帶的值要是值本身', async () => {
    // 🔴 修之前印 `[object Object]`：`String(signal.value)` 而 value 是 RuntimeValue。
    expect(await 跑(IO, `int main(){ try { throw 10; } catch (int e) { cout << e; } }`)).toBe('10')
  })

  it('★ 丟非整數的值也要對（釘住修法不是「int 專用」）', async () => {
    // ⚠️ 原本寫 `throw string("bad")`，而它失敗的是**字串建構**
    // （`string("bad")` → 未定義函式），不是 catch 傳值——那是另一個缺口。
    // 換成不依賴字串建構的等價案例，才測得到這個根因。
    expect(await 跑(IO, `int main(){ try { throw 2.5; } catch (double e) { cout << e; } }`)).toBe('2.5')
  })

  // ── 根因 4：cpp:range_sum 是回傳 0 的空實作 ──────────────────────
  it('★ 範圍加總要真的加', async () => {
    // 🔴 修之前回 0——`register('cpp:range_sum', async () => ({ type:'int', value: 0 }))`。
    // ⚠️ 而那個空實作**就寫在同一個檔案裡**「解析不了時擲錯，不回傳『沒事』」
    //    這句話的下面兩行。
    expect(
      await 跑(NUM, `int main(){ vector<int> v = {1,2,3,4,5}; cout << accumulate(v.begin(), v.end(), 0); }`),
    ).toBe('15')
  })

  it('★ 初值要被算進去', async () => {
    expect(
      await 跑(NUM, `int main(){ vector<int> v = {1,2,3}; cout << accumulate(v.begin(), v.end(), 100); }`),
    ).toBe('106')
  })

  // ── 根因 5：constructorOf 零呼叫者 ──────────────────────────────
  it('★ 預設建構子要被呼叫', async () => {
    // 🔴 修之前什麼都不印。機制全都在（`ctors` 有填、`constructorOf` 讀得到），
    //    **只是沒有人呼叫它**——`grep constructorOf` 得到零個呼叫者。
    //    而 `destructorOf` 有一個，所以解構子會跑：**同一顆物件，一邊跑一邊不跑。**
    expect(
      await 跑(IO, `class A { public: A(){ cout << "ctor"; } }; int main(){ A a; }`),
    ).toBe('ctor')
  })

  it('★ 帶引數的建構子要被呼叫', async () => {
    expect(
      await 跑(IO, `class A { public: int v; A(int x){ v = x; } }; int main(){ A a(5); cout << a.v; }`),
    ).toBe('5')
  })

  it.fails('[BLOCKED:lift] 成員預設值要讀得到', async () => {
    // 🔴 實測拿到 `0`，而**缺陷不在執行那一路**——是辨識掉了初始值：
    //
    //   class A { public: int v = 7; };
    //   → cpp:class_def[public] → cpp:var_declare { type:'int', name:'v' }
    //                                              ↑ **沒有 initializer 子節點**
    //
    // 執行器拿到的樹裡本來就沒有 7。`specs/109` 的範圍是執行那一路，
    // 所以這裡只釘住，不修——修它要動辨識層的類別成員規則。
    //
    // 用 `it.fails` 而不是 `it.skip`：缺陷還在時它綠且這段註解在原地出聲，
    // 修好的那天它**變紅並提醒拔釘子**。
    expect(await 跑(IO, `class A { public: int v = 7; }; int main(){ A a; cout << a.v; }`)).toBe('7')
  })

  it('★ 解構子的既有行為不得回歸', async () => {
    expect(await 跑(IO, `class A { public: ~A(){ cout << "dtor"; } }; int main(){ A a; }`)).toBe('dtor')
  })

  it('★ 沒有建構子的型別行為不變（FR-008，最可能被打到的一條）', async () => {
    // 接上一條**零覆蓋**的路徑時，這一條是防回歸的主力。
    expect(
      await 跑(IO, `struct P { int x; }; int main(){ P p; p.x = 3; cout << p.x; }`),
    ).toBe('3')
  })
})
