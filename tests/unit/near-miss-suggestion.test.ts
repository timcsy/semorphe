/**
 * **「你是不是要打 `score`？」——把名字打錯時，說出可見範圍裡那個長得很像的。**
 *
 * ## 它從哪來
 *
 * 2026-08-17 用 clangd 當裁判量涵蓋率（階段 6.6 ⑤），缺口只有兩筆，
 * 其中一筆 clang 給的代號是 **`undeclared_var_use_suggest`**
 * ——`suggest`：clang 會說「你是不是要打 `cout`」。
 *
 * 而**第二課第三步教的就是這件事**（`Score` vs `score`）。
 *
 * ## ⚠️ 這不是「改措辭」，是「加一個事實」
 *
 * `spec 119` 的研究記過：加強錯誤訊息**做了六十年而沒有共識**
 * （Becker 等 2019 回顧 107 篇）。
 *
 * > **而這一筆沒有把句子講得更漂亮——它告訴使用者
 * > 【可見範圍裡有一個長得很像的名字】。那是資訊，不是修辭。**
 *
 * ## 🔴 判準（而閾值要說得出理由）
 *
 * ```
 * 大小寫不同而其餘相同   → 建議   信心近乎 100%，而它是初學者最常犯的
 * 編輯距離 1 且【兩邊都 ≥ 4 個字元】 → 建議
 * 其餘                   → 🔴 不建議，訊息與今天【逐字相同】
 * ```
 *
 * ⚠️ **長度下限 4 是有理由的**：長度 ≤3 時，「編輯距離 1」涵蓋掉名字空間的
 * 一大塊——`a` 與 `b` 距離是 1。**在那個尺度上猜，就是亂猜。**
 *
 * > `experience`：「一個指錯地方的錯誤訊息，比沒有訊息更糟。」
 */
import { describe, it, expect } from 'vitest'
import { Scope } from '../../src/interpreter/scope'
import { RuntimeError } from '../../src/interpreter/errors'

const intVal = (v: number) => ({ type: 'int' as const, value: v })

function readAndCatch(scope: Scope, name: string): RuntimeError {
  try { scope.get(name) } catch (e) { if (e instanceof RuntimeError) return e; throw e }
  throw new Error(`讀 ${name} 竟然沒有拋錯`)
}

describe('近似名建議', () => {
  it('★ 大小寫打錯 → 說出正確的那個', () => {
    const s = new Scope()
    s.declare('score', intVal(90))
    const e = readAndCatch(s, 'Score')
    expect(e.i18nKey, '應該走【有建議】那一則').toBe('RUNTIME_ERR_UNDECLARED_VAR_SUGGEST')
    expect(JSON.stringify(e.params)).toContain('score')
  })

  it('★ 外層作用域的名字也算「可見」', () => {
    const outer = new Scope()
    outer.declare('total', intVal(1))
    const inner = outer.createChild()
    const e = readAndCatch(inner, 'Total')
    expect(e.i18nKey).toBe('RUNTIME_ERR_UNDECLARED_VAR_SUGGEST')
    expect(JSON.stringify(e.params)).toContain('total')
  })

  it.each([
    ['取代一個字元', 'scorx'],
    ['少一個字元', 'scre'],
    ['多一個字元', 'scoree'],
    ['🔴 相鄰兩字【對調】', 'scoer'],
  ])('★ 距離 1 且夠長 → 建議：%s', (_label, typo) => {
    const s = new Scope()
    s.declare('score', intVal(90))
    expect(readAndCatch(s, typo).i18nKey).toBe('RUNTIME_ERR_UNDECLARED_VAR_SUGGEST')
  })

  // 🔴 對調是寫測試時才發現的：`scoer` 在【Levenshtein 下是距離 2】，
  //    而它其實是一次對調。長度下限照樣擋住短名字的對調。
  it('★ 而短名字的對調仍然不猜', () => {
    const s = new Scope()
    s.declare('ab', intVal(1))
    expect(readAndCatch(s, 'ba').i18nKey).toBe('RUNTIME_ERR_UNDECLARED_VAR')
  })

  // 🔴 不亂猜那一側——**比會猜更重要**
  it.each([
    ['沒有任何名字', [] as string[], 'x'],
    ['完全不像', ['total'], 'q'],
    ['太短而距離 1（a vs b）', ['a'], 'b'],
    ['太短而距離 1（ab vs ac）', ['ab'], 'ac'],
    ['距離 2', ['score'], 'scrxe'],
  ])('★ 不亂猜：%s → 訊息與今天【逐字相同】', (_label, declared, lookup) => {
    const s = new Scope()
    for (const d of declared) s.declare(d, intVal(1))
    const e = readAndCatch(s, lookup)
    expect(e.i18nKey, `🔴 對「${lookup}」給了建議——而那是亂猜`).toBe('RUNTIME_ERR_UNDECLARED_VAR')
    expect(Object.keys(e.params)).toEqual(['%1'])
  })

  it('★ 有多個近似名時，只給一個——而它是最像的那個', () => {
    const s = new Scope()
    s.declare('score', intVal(1))
    s.declare('scores', intVal(2))
    const e = readAndCatch(s, 'Score')
    // 大小寫完全相符優先於編輯距離
    expect(e.params['%2']).toBe('score')
  })
})
