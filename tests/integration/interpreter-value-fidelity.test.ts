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

async function run(prelude: string, bodyText: string): Promise<string> {
  const tree = parser.parse(prelude + bodyText)
  if (!tree) throw new Error('parse 失敗')
  const semanticTree = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(semanticTree)
  return i.getOutput().join('')
}

const IO = '#include <iostream>\nusing namespace std;\n'
const NUM = '#include <iostream>\n#include <numeric>\n#include <vector>\nusing namespace std;\n'

describe('值忠實度：直譯器印出來的，要與參照編譯器一致', () => {
  // ── 根因 1：char 轉型取了字串首字元 ──────────────────────────────
  it('★ char 持有數值時要印成字元', async () => {
    // 🔴 修之前印 `6`：`valueToString(66)` = "66"，再 `.charAt(0)`。
    // 與 `cctype/executors.ts` 的 `charOf` 是同一個坑——那裡修過了，核心沒有。
    expect(await run(IO, `int main(){ char c = 66; cout << c; }`)).toBe('B')
  })

  it('★ char 持有字元時仍然正確（不得因為修上面而壞掉）', async () => {
    expect(await run(IO, `int main(){ char c = 'B'; cout << c; }`)).toBe('B')
  })

  it('★ 明確轉型成 char 也要印成字元', async () => {
    expect(await run(IO, `int main(){ cout << (char)('a' - 32); }`)).toBe('A')
  })

  // ── 根因 2：浮點沒有 C++ 的預設六位有效數字 ────────────────────────
  it('★ 浮點預設六位有效數字', async () => {
    // 🔴 修之前印 `0.3333333333333333`（JS 的 String(number)）。
    expect(await run(IO, `int main(){ double d = 1.0/3; cout << d; }`)).toBe('0.333333')
  })

  it('★ 而整數值的浮點不得印成 1.000000（C++ 去尾零）', async () => {
    expect(await run(IO, `int main(){ double d = 1.0; cout << d; }`)).toBe('1')
  })

  it('★ 整數不受影響', async () => {
    expect(await run(IO, `int main(){ int n = 1000000; cout << n; }`)).toBe('1000000')
  })

  // ── 根因 3：catch 把 RuntimeValue 字串化 ─────────────────────────
  it('★ 例外攜帶的值要是值本身', async () => {
    // 🔴 修之前印 `[object Object]`：`String(signal.value)` 而 value 是 RuntimeValue。
    expect(await run(IO, `int main(){ try { throw 10; } catch (int e) { cout << e; } }`)).toBe('10')
  })

  it('★ 丟非整數的值也要對（釘住修法不是「int 專用」）', async () => {
    // ⚠️ 原本寫 `throw string("bad")`，而它失敗的是**字串建構**
    // （`string("bad")` → 未定義函式），不是 catch 傳值——那是另一個缺口。
    // 換成不依賴字串建構的等價案例，才測得到這個根因。
    expect(await run(IO, `int main(){ try { throw 2.5; } catch (double e) { cout << e; } }`)).toBe('2.5')
  })

  // ── 根因 4：cpp:range_sum 是回傳 0 的空實作 ──────────────────────
  it('★ 範圍加總要真的加', async () => {
    // 🔴 修之前回 0——`register('cpp:range_sum', async () => ({ type:'int', value: 0 }))`。
    // ⚠️ 而那個空實作**就寫在同一個檔案裡**「解析不了時擲錯，不回傳『沒事』」
    //    這句話的下面兩行。
    expect(
      await run(NUM, `int main(){ vector<int> v = {1,2,3,4,5}; cout << accumulate(v.begin(), v.end(), 0); }`),
    ).toBe('15')
  })

  it('★ 初值要被算進去', async () => {
    expect(
      await run(NUM, `int main(){ vector<int> v = {1,2,3}; cout << accumulate(v.begin(), v.end(), 100); }`),
    ).toBe('106')
  })

  // ── 根因 5：constructorOf 零呼叫者 ──────────────────────────────
  it('★ 預設建構子要被呼叫', async () => {
    // 🔴 修之前什麼都不印。機制全都在（`ctors` 有填、`constructorOf` 讀得到），
    //    **只是沒有人呼叫它**——`grep constructorOf` 得到零個呼叫者。
    //    而 `destructorOf` 有一個，所以解構子會跑：**同一顆物件，一邊跑一邊不跑。**
    expect(
      await run(IO, `class A { public: A(){ cout << "ctor"; } }; int main(){ A a; }`),
    ).toBe('ctor')
  })

  it('★ 帶引數的建構子要被呼叫', async () => {
    expect(
      await run(IO, `class A { public: int v; A(int x){ v = x; } }; int main(){ A a(5); cout << a.v; }`),
    ).toBe('5')
  })

  // ── 成員預設值（2026-08-13 修好，釘子已拔）─────────────────────────
  //
  // 曾經是一根釘在 `cpp:class_def` 上的釘子，症狀是拿到 `0`。
  //
  // ⚠️ 這一行原本把那根釘子的**原始寫法**照抄在註解裡，而缺陷帳的掃描器
  // 照樣把它數成一筆停用測試（`titleOnly` 12 → 13）——**一個講缺陷的註解
  // 變成了一筆缺陷**。掃描器不分辨程式與註解是刻意的（否則有人用註解藏），
  // 所以這裡改成敘述而不是照抄。
  // **缺陷跨兩路**：辨識沒讀 `field_declaration` 的 `default_value`，
  // 而執行那一路連接點都沒有。修法是兩邊各接一段：
  //   lift    → `cpp:var_declare` 既有的 `initializer` 接點（不需要新形狀）
  //   execute → `FieldDecl.init` ＋ `StructRegistry.applyFieldInits`
  //
  // ⚠️ 求值必須在**建立實例時**，不是宣告類別時——預設值可以是任意表達式。
  it('★ 類別成員預設值要讀得到', async () => {
    expect(await run(IO, `class A { public: int v = 7; }; int main(){ A a; cout << a.v; }`)).toBe('7')
  })

  it('★ struct 的成員預設值同樣要讀得到（C++11）', async () => {
    expect(await run(IO, `struct P { int x = 3; int y = 4; }; int main(){ P p; cout << p.x << p.y; }`)).toBe('34')
  })

  it('★ 建構式蓋得掉成員預設值——順序是「預設值先，建構式後」', async () => {
    expect(
      await run(IO, `class A { public: int v = 7; A(int n){ v = n; } }; int main(){ A a(9); cout << a.v; }`),
    ).toBe('9')
  })

  // ── `char` 在算術情境是字元碼（同一輪修的另一個根因）───────────────
  it('★ 明確轉型讀得到 char 的字元碼', async () => {
    // 🔴 修之前 `toNumber` 走 `Number('A') || 0` 給 **0**，於是印出 `'\0'`
    // ——一個看不見的字元，而程式看起來跑完了。
    expect(await run(IO, `#include <cctype>\n${IO}int main(){ char c='a'; cout << (char)toupper(c); }`)).toBe('A')
  })

  it('★ 解構子的既有行為不得回歸', async () => {
    expect(await run(IO, `class A { public: ~A(){ cout << "dtor"; } }; int main(){ A a; }`)).toBe('dtor')
  })

  it('★ 沒有建構子的型別行為不變（FR-008，最可能被打到的一條）', async () => {
    // 接上一條**零覆蓋**的路徑時，這一條是防回歸的主力。
    expect(
      await run(IO, `struct P { int x; }; int main(){ P p; p.x = 3; cout << p.x; }`),
    ).toBe('3')
  })
})
