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
 */
import { describe, it, expect } from 'vitest'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import type { SemanticNode } from '../../../core/types'

registerCppLanguage()

const node = (conceptId: string, properties: Record<string, unknown> = {}, children: Record<string, SemanticNode[]> = {}): SemanticNode =>
  ({ conceptId, properties, children } as SemanticNode)

/** `void <name>(){ cout << <text> << endl; }` */
const printingFunc = (name: string, text: string): SemanticNode =>
  node('cpp:func_def', { name, return_type: 'void' }, {
    params: [],
    body: [node('cpp:print', {}, { values: [node('cpp:literal_string', { value: text })] })],
  })

const program = (...body: SemanticNode[]): SemanticNode => node('cpp:program', {}, { body })

async function run(tree: SemanticNode): Promise<{ out: string; err: string }> {
  const i = new SemanticInterpreter({ maxSteps: 50_000 })
  try {
    await i.execute(tree)
    return { out: i.getOutput().join(''), err: '' }
  } catch (e) {
    return { out: i.getOutput().join(''), err: (e as Error).message }
  }
}

describe('cpp:program 的進入點', () => {
  it('★ 有 main → 跑 main（既有行為，不得改變）', async () => {
    const { out } = await run(program(printingFunc('main', 'M')))
    expect(out).toBe('M')
  })

  it('★ 沒有 main 而有 setup → setup 跑一次', async () => {
    const { out, err } = await run(program(printingFunc('setup', 'S')))
    expect(err, '🔴 setup 應該跑得起來').toBe('')
    expect(out).toBe('S')
  })

  it('★ setup 先於 loop，而 loop 會重複', async () => {
    const { out } = await run(program(printingFunc('setup', 'S'), printingFunc('loop', 'L')))
    expect(out.startsWith('S'), `🔴 setup 沒有先跑：${out}`).toBe(true)
    expect(
      out.length,
      `🔴 loop 只跑了一次（輸出 ${JSON.stringify(out)}）——那不是「重複執行」，是「多呼叫了一次」。`,
    ).toBeGreaterThan(2)
  })

  /**
   * 🔴 **這一支在修好之前必須是紅的。**
   *
   * 今天的行為是**安靜結束**——而那正是本功能的起因：
   * 「找不到進入點」與「跑完了什麼都沒印」在報表上長得一樣。
   */
  it('★ 都沒有 → 出聲，不得安靜結束', async () => {
    const { err } = await run(program(printingFunc('helper', 'H')))
    expect(
      err,
      '🔴 一個沒有任何進入點的程式【安靜地結束了】。\n' +
        '而那與「跑完了什麼都沒印」在報表上長得一模一樣——' +
        '那正是十段 Arduino 語料曾經被誤報成「跑完了」的原因。',
    ).not.toBe('')
  })

  /**
   * 🔴 **這兩支釘的是那條規則的【邊界】，而它們是兩次翻車換來的。**
   *
   * ```
   * 第一版   只問 `ctx.functions` → 144 支既有測試當場紅
   *          而它們是對的：body 裡直接放敘述的程式【沒有函式，而它跑得好好的】
   * 第二版   補了「有非函式節點就放行」→ 剩 1 支紅：【空程式】
   *          `[].some()` 是 false ——⚠️ 一支比 144 支難發現
   * ```
   *
   * > **「沒有進入點」與「進入點不是一個函式」是兩件事，
   * > 而只問 `functions` 的話，第二種會被誤判成第一種。**
   */
  it('★ 頂層敘述【本身就是進入點】——不得因為沒有函式就報錯', async () => {
    const { out, err } = await run(program(
      node('cpp:print', {}, { values: [node('cpp:literal_string', { value: 'T' })] })))
    expect(err, '🔴 一個沒有函式、而直接放敘述的程式被判成「找不到進入點」').toBe('')
    expect(out).toBe('T')
  })

  it('★ 空程式不算「找不到進入點」——它什麼都沒有', async () => {
    const { err } = await run(program())
    expect(err, '🔴 學生剛打開編輯器按執行，不該看到錯誤').toBe('')
  })

  it('★ main 與 setup 同時存在 → main 贏（不看載入順序）', async () => {
    const both = program(printingFunc('setup', 'S'), printingFunc('main', 'M'))
    const reversed = program(printingFunc('main', 'M'), printingFunc('setup', 'S'))
    expect((await run(both)).out, '🔴 兩者都在時應該跑 main').toBe('M')
    expect(
      (await run(reversed)).out,
      '🔴 換個順序結果就不同 → 勝負由【載入順序】決定，而那個順序不是任何人設計的',
    ).toBe('M')
  })

  it('★ setup 拋錯 → loop 不繼續跑', async () => {
    const boom = node('cpp:func_def', { name: 'setup', return_type: 'void' }, {
      params: [], body: [node('cpp:var_ref', { name: '這個名字不存在' })],
    })
    const { out, err } = await run(program(boom, printingFunc('loop', 'L')))
    expect(err, '🔴 setup 拋的錯應該傳出來').not.toBe('')
    expect(out, `🔴 setup 失敗了而 loop 還在跑（輸出 ${JSON.stringify(out)}）`).toBe('')
  })
})
