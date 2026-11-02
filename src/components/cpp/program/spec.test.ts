/**
 * `cpp:program` 的**進入點**——而它不只有 `main`。
 *
 * ## 🔴 這一族測試從哪來
 *
 * 2026-08-17 實測十段 Arduino 語料：
 *
 * ```
 * 殘差節點  0 / 10   🟢 全部辨識得出來
 * 執行結果  out=""  err=""   ← 🔴 十段【全部】，安靜地什麼都不做
 * ```
 *
 * 根因：這顆的執行路是 `if (ctx.functions.has('main'))`
 * ——**Arduino sketch 沒有 `main`**，所以 `setup`／`loop` 從來沒有人呼叫，
 * **而它不會拋錯**。
 *
 * > **一個「沒有失敗」的訊號，與一個「成功」的訊號，在報表上長得一模一樣。**
 *
 * ⚠️ 而那句話**害我報過一次假數字**：我曾據此宣稱「10/10 Arduino 跑完了」。
 *
 * ## 優先順序，以及為什麼是這個順序
 *
 * ```
 * main 存在          → 跑 main             C／C++ 的既有行為，不得改變
 * 否則 setup／loop   → setup 一次，loop 重複   Arduino
 * 都沒有             → 🔴 出聲              而今天是【安靜結束】
 * ```
 *
 * `main` 優先**不是偏袒 C++**——它是「**一個宣告了 `main` 的程式，
 * 作者的意圖是明確的**」。而兩者都有時去猜，猜錯的代價比出聲高。
 *
 * ## 這一族不檢測什麼
 *
 * - **不檢測 `loop()` 跑幾圈**——那是「界」的問題，由呼叫端決定（見 `arduino-clock`）
 * - **不檢測腳位／Serial**——那些是別的膠囊
 *
 * ## spec 205（重構 6c-3）：改由 Cella 背書
 *
 * 原本手搭 `cpp:program` 的樹給 JS 直譯器跑。現在每一條都是**一段程式碼**交給 Cella：C++ 用 `runCella`，
 * Arduino 用板子的判決（`runCella(code, { board: 'uno' })`——Cella 帶著 Arduino 核心的 `main.cpp`：setup 一次、loop 重複）。
 * 骨架補進入點（學生只寫本體、`int main() {` 是骨架包上去的）走產品的判決入口 `provider.check`（`withEntryFunctions`）。
 *
 * 🔴 **一條期望值改了**：「沒有 main、只有 setup → setup 跑一次」。真實的 Arduino 核心 `main.cpp` 呼叫 `setup()` 與 `loop()`，
 * 少了 `loop` 連結就失敗（`undefined reference to 'loop'`）——Cella 照核心判 reject 並說出缺的是 `loop`。
 * JS 直譯器「只跑 setup」是它自己的寬鬆，不是板子的行為 ⟹ 改成「出聲並說出缺 loop」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { runCella, expectCellaOut, describeCellaResult } from '../../../../tests/helpers/cella-run'
import { cellaProvider, openCella, waitSession } from '../../../../tests/helpers/cella-session'
import type { Provider } from '../../../core/capabilities'
import type { SemanticNode } from '../../../core/types'

const H = '#include <iostream>\nusing namespace std;\n'
/** `void <name>() { 印出 <text> }`——C++ 用 cout，板子用 Serial */
const cppFn = (name: string, text: string): string => `void ${name}() {\n  cout << "${text}";\n}\n`
const ardFn = (name: string, text: string): string => `void ${name}() {\n  Serial.begin(9600);\n  Serial.print("${text}");\n}\n`
const ARD_LOOP = 'void loop() {\n  Serial.print("L");\n  delay(1000);\n}\n'

let parser: Parser
let p: Provider
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  p = await cellaProvider()
}, 400_000)

/** 產品的判決入口：照骨架補進入點（`withEntryFunctions`）再判 */
const checkWithSkeleton = (code: string, skeletonId: string, targetId = 'cpp') =>
  p.check!({ tree: lift(code), targetId, styleId: 'apcs', skeletonId, input: '' })

describe('cpp:program 的進入點（Cella）', () => {
  it('★ 有 main → 跑 main（既有行為，不得改變）', async () => {
    await expectCellaOut(H + 'int main() {\n  cout << "M";\n  return 0;\n}\n', 'M')
  })

  it('★ 板子上有 setup 與 loop → setup 先跑一次，loop 重複', async () => {
    const r = await runCella(ardFn('setup', 'S') + ARD_LOOP, { board: 'uno' })
    expect(r.verdict, describeCellaResult(r)).toBe('accept')
    expect(r.out.startsWith('S'), `🔴 setup 沒有先跑：${r.out}`).toBe(true)
    expect(r.out.slice(1), `🔴 loop 沒有重複（輸出 ${JSON.stringify(r.out)}）`).toMatch(/^L{2,}$/)
  })

  it('★ 板子上只有 setup（沒有 loop）→ 出聲，並說出缺的是 loop（真實的 Arduino 核心連結不過）', async () => {
    // 期望值改過：原本是「setup 跑一次」（JS 直譯器的寬鬆）。依據：Arduino 核心的 main.cpp 呼叫 loop()，少了它是連結錯誤。
    const r = await runCella(ardFn('setup', 'S'), { board: 'uno' })
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.map((x) => x.reason).join('\n')).toMatch(/\bloop\b/)
  })

  /**
   * 🔴 **「都沒有 → 出聲」**——今天的 JS 行為曾經是**安靜結束**，而那正是本功能的起因：
   * 「找不到進入點」與「跑完了什麼都沒印」在報表上長得一樣。
   */
  it('★ 都沒有 → 出聲，不得安靜結束（C++ 與板子各一次）', async () => {
    const cpp = await runCella(H + cppFn('helper', 'H'))
    expect(cpp.verdict, '🔴 一個沒有任何進入點的程式【安靜地結束了】').toBe('reject')
    expect(cpp.problems.map((x) => x.reason).join('\n')).toMatch(/main/)
    const ard = await runCella('void helper() {\n}\n', { board: 'uno' })
    expect(ard.verdict, describeCellaResult(ard)).toBe('reject')
    expect(ard.problems.map((x) => x.reason).join('\n')).toMatch(/\bsetup\b/)
  })

  /**
   * 🔴 **這兩支釘的是那條規則的【邊界】，而它們是兩次翻車換來的**（第一版只問函式 → 144 支紅；第二版漏了空程式）。
   *
   * > **「沒有進入點」與「進入點不是一個函式」是兩件事。**
   *
   * Cella 那一側：學生只寫本體時，骨架（`main.json`／`arduino.json`）把它包進進入點——`withEntryFunctions`，與產碼同一條規則。
   */
  it('★ 頂層敘述【本身就是進入點】（骨架包進 main）——不得因為沒有函式就報錯', async () => {
    const a = await checkWithSkeleton('cout << "T";', 'main')
    expect(a.verdict?.verdict, JSON.stringify(a.verdict?.problems)).toBe('accept')
    expect(a.verdict?.out).toBe('T')
  })

  it('★ 空程式不算「找不到進入點」——學生剛打開編輯器按執行，不該看到錯誤（main 與 Arduino 骨架）', async () => {
    const main = await checkWithSkeleton('', 'main')
    expect(main.verdict?.verdict, JSON.stringify(main.verdict?.problems)).toBe('accept')
    expect(main.verdict?.out).toBe('')
    const ard = await checkWithSkeleton('', 'arduino', 'arduino-uno')
    expect(ard.verdict?.verdict, JSON.stringify(ard.verdict?.problems)).toBe('accept')
  })

  it('★ main 與 setup 同時存在 → main 贏（不看載入順序；C++ 與板子都是）', async () => {
    const both = H + cppFn('setup', 'S') + 'int main() {\n  cout << "M";\n  return 0;\n}\n'
    const reversed = H + 'int main() {\n  cout << "M";\n  return 0;\n}\n' + cppFn('setup', 'S')
    await expectCellaOut(both, 'M')
    await expectCellaOut(reversed, 'M')
    // 板子：自己寫了 main 就不走核心的 main.cpp（核心是靜態函式庫，main 已有定義就不連進來）——依據是 AVR 核心的連結方式
    const ard = await runCella(ardFn('setup', 'S') + 'int main() {\n  Serial.begin(9600);\n  Serial.print("M");\n  return 0;\n}\n', { board: 'uno' })
    expect(ard.verdict, describeCellaResult(ard)).toBe('accept')
    expect(ard.out).toBe('M')
  })

  /**
   * 🔴 **第二次按執行，loop 也要跑**（2026-10-13，cella 讀我們的 code 時指出來的：JS 直譯器的模擬時鐘是模組層的狀態，沒有人歸零）。
   * Cella 的判決是程式 JSON 的純函式——這一條留著當回歸：同一支 sketch 判兩次，輸出逐字相同。
   */
  it('★ 同一個 sketch 連跑兩次，第二次的 loop 圈數與第一次相同', async () => {
    const sketch = ardFn('setup', 'S') + ARD_LOOP
    const first = await runCella(sketch, { board: 'uno' })
    const second = await runCella(sketch, { board: 'uno' })
    expect(first.out.length, '前提：第一次 loop 有在重複').toBeGreaterThan(2)
    expect(second.out, '🔴 第二次執行的 loop 圈數不同——狀態跨執行殘留').toBe(first.out)
  })

  /**
   * setup 在執行期出錯 → loop 不得繼續跑。判決 reject 時 `out` 一律是空的（看不出 loop 有沒有跑），
   * 所以走工作階段（學生按執行的那條路）：出錯前印的 `S` 看得到、停在那一顆、後面沒有任何 `L`。
   * （原本用「setup 讀一個不存在的名字」——那在 C++ 是編譯錯誤，整支不會跑；改成真正的執行期錯誤：讀未初始化的變數。）
   */
  it('★ setup 執行期出錯 → loop 不繼續跑', async () => {
    const tree = lift('void setup() {\n  Serial.begin(9600);\n  Serial.print("S");\n  int a;\n  int b = a + 1;\n  Serial.print(b);\n}\n' + ARD_LOOP)
    const formal = { tree, targetId: 'arduino-uno', styleId: 'apcs', skeletonId: 'arduino' }
    await waitSession(p, tree, formal)
    const { s, out } = openCella(p, tree, { formal })
    const o = await s.launch(tree, { stopOnEntry: false })
    expect(o, '🔴 setup 的錯應該讓執行停下').toMatchObject({ kind: 'failed', error: { i18nKey: 'RUNTIME_ERR_UB_UNINIT' } })
    expect(out(), `🔴 setup 失敗了而 loop 還在跑（輸出 ${JSON.stringify(out())}）`).toBe('S')
  }, 120_000)
})
