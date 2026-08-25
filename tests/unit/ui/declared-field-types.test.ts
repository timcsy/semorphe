/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（`vitest.config.ts`）——這個檔碰 DOM，所以顯式加回來。
 */
/**
 * **宣告裡用到的每一種欄位型別，Blockly 都要認得。**
 *
 * ## 🔴 它修的是什麼
 *
 * 2026-08-25 `cpp_doc_comment` 的命令式定義退場之後，tsc 說
 * `import { FieldMultilineInput } from '@blockly/field-multilineinput'`
 * 「宣告了而沒有被使用」——於是我刪了它。
 *
 * **而那個 import 是一次【註冊】**：那個套件在被 import 時把自己登記成
 * `field_multilinetext`，而宣告式的 `blockDef` 靠那個名字找它。
 *
 * ⚠️ **症狀不是報錯**：Blockly 對不認得的欄位型別是**安靜地丟掉那一格**。
 * 積木上的「說明」欄位整個不見，**而程式碼那側仍然是對的**
 *（`brief` 活在語義樹裡）——要到下一次從積木同步回去才會發現它沒了。
 *
 * > **一個「沒有被使用」的 import，可能正是別人賴以存在的那一行。**
 *
 * ## 🔴 自我否證
 *
 * > **如果掃到的宣告數是 0，代表登錄表沒載進來，不是「沒有人用特殊欄位」。**
 *
 * ## 本測試不檢測什麼
 *
 * - ❌ 不驗欄位**畫得對不對**（那是渲染）
 * - ❌ 不驗欄位的**值**會不會被存下來（那是 extraState 那一維）
 */
import { describe, it, expect } from 'vitest'
import * as Blockly from 'blockly'
import '../../../src/ui/block-registrar'
import { BlockSpecRegistry } from '../../../src/core/block-spec-registry'
import { allCppProjections } from '../../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../../helpers/component-scan'

/** 宣告裡出現過的所有欄位型別（含 `paramList`／`variadic` 那些動態的）。 */
function declaredFieldTypes(): string[] {
  const out = new Set<string>()
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (!v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    if (typeof o.type === 'string' && o.type.startsWith('field_')) out.add(o.type)
    Object.values(o).forEach(walk)
  }
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  walk(reg.getAll().map((s) => (s as { blockDef?: unknown }).blockDef))
  return [...out].sort()
}

describe('宣告裡用到的欄位型別，Blockly 都要認得', () => {
  const types = declaredFieldTypes()

  it('入口條件：真的掃到宣告了（否則下面在比空集合）', () => {
    // 🔴 錨在**掃到幾種**上——它不會因為缺陷被修好而變小。
    expect(types.length, '🔴 一種都沒掃到＝登錄表沒載進來').toBeGreaterThan(3)
  })

  it('🔴 硬性零：每一種都註冊得起來——**沒註冊的會被安靜丟掉**', () => {
    // ⚠️ **問「有沒有註冊」，不要問「建不建得起來」**——第一版用
    //    `fieldRegistry.fromJson({type})`，而 `field_dropdown` 沒有 `options`
    //    就會丟，於是三種正常的欄位被誤報成「沒註冊」。
    //
    // > **一個把「缺少參數」讀成「不存在」的探測，報的是自己的呼叫方式。**
    const missing = types.filter(
      (t) => !Blockly.registry.hasItem(Blockly.registry.Type.FIELD, t))
    expect(missing, '🔴 這幾種欄位在宣告裡用了，而 Blockly 不認得——那一格會消失而不報錯')
      .toEqual([])
  })

  it('正向錨點：`field_multilinetext` 真的在裡面（否則這條可能空過）', () => {
    // ⚠️ 它就是踩過的那一個——具名釘住，別讓它安靜地從清單裡消失。
    expect(types, '🔴 沒有人用它了？那 `cpp_doc_comment` 的「說明」呢').toContain('field_multilinetext')
  })
})
