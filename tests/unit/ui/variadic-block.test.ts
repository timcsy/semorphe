/**
 * spec 162：**可變參數的積木建構器——存檔重開那條路。**
 *
 * ## ⚠️ 這一支是注射逼出來的
 *
 * 把 `loadExtraState` 裡長插槽的那一行拿掉之後，
 * `python-block-both-paths` 的七支**一支都沒紅**。
 *
 * 而它是使用者**關掉分頁、隔天再打開**會走的路——**渲染那條路不經過它**。
 *
 * > **一條只有「載入舊檔」才會走的路，用「現在畫一次」是量不到的。**
 *
 * ## 🔴 而 `{ itemCount }` 這個格式不准改
 *
 * 舊存檔裡就是那個形狀（命令式那版寫的）。換一個鍵名等於讓使用者的檔案打不開
 * ——而症狀是**引數靜靜地少掉**，不是報錯。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { defineVariadicBlock } from '../../../src/ui/variadic-block'

const TYPE = '__variadic_probe__'

beforeAll(() => {
  defineVariadicBlock(TYPE, {
    inputPattern: 'EXPR{i}', labelFallback: '輸出', check: 'Expression', colour: '#5CB1D6',
  })
})

/** 一個假的 Blockly 積木——只記下「誰被呼叫了」。 */
function fakeBlock(def: Record<string, unknown>): { self: Record<string, unknown>; inputs: string[]; removed: string[] } {
  const inputs: string[] = []
  const removed: string[] = []
  const chain = { setCheck: () => chain, appendField: () => chain }
  const self = Object.create(def) as Record<string, unknown>
  Object.assign(self, {
    itemCount_: 1,
    appendValueInput: (n: string) => { inputs.push(n); return chain },
    appendDummyInput: () => chain,
    moveInputBefore: () => {}, removeInput: (n: string) => { removed.push(n) },
    getField: () => null, setInputsInline: () => {}, setPreviousStatement: () => {},
    setNextStatement: () => {}, setColour: () => {}, setTooltip: () => {}, setOutput: () => {},
  })
  return { self, inputs, removed }
}

describe('spec 162 · 可變參數的積木建構器', () => {
  it('★ 錨點：型別真的被定義了（否則下面每一條都在測 undefined）', () => {
    expect((Blockly.Blocks as Record<string, unknown>)[TYPE], '建構器沒有註冊型別').toBeTruthy()
  })

  it('🔴 `loadExtraState({itemCount: 3})` 要長出 EXPR1、EXPR2', () => {
    const def = (Blockly.Blocks as Record<string, unknown>)[TYPE] as Record<string, unknown>
    const { self, inputs } = fakeBlock(def)
    ;(def.loadExtraState as (this: unknown, s: { itemCount?: number }) => void).call(self, { itemCount: 3 })
    expect(inputs, '⚠️ 舊存檔說有三個引數而重開只長出一個 → 後兩個【靜靜消失】')
      .toEqual(['EXPR1', 'EXPR2'])
    expect(self.itemCount_).toBe(3)
  })

  it('🔴 `saveExtraState` 的鍵**必須**是 `itemCount`——舊存檔認的是它', () => {
    const def = (Blockly.Blocks as Record<string, unknown>)[TYPE] as Record<string, unknown>
    const { self } = fakeBlock(def)
    self.itemCount_ = 4
    expect((def.saveExtraState as (this: unknown) => unknown).call(self),
      '換一個鍵名 → 使用者的舊檔打開之後引數少掉，而且不報錯').toEqual({ itemCount: 4 })
  })

  it('★ 反向：`minus_` 不得把最後一個插槽也拿掉', () => {
    const def = (Blockly.Blocks as Record<string, unknown>)[TYPE] as Record<string, unknown>
    const { self, removed } = fakeBlock(def)
    ;(def.minus_ as (this: unknown) => void).call(self)
    expect(removed, '剩一個的時候還能減 → 積木會變成沒有插槽的空殼').toEqual([])
    expect(self.itemCount_).toBe(1)
  })

  it('★ 反向：`init` 先長 EXPR0（沒有它，載入時會從 EXPR1 開始）', () => {
    const def = (Blockly.Blocks as Record<string, unknown>)[TYPE] as Record<string, unknown>
    const { self, inputs } = fakeBlock(def)
    ;(def.init as (this: unknown) => void).call(self)
    expect(inputs).toEqual(['EXPR0'])
  })
})
