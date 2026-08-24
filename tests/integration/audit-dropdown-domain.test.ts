/**
 * @vitest-environment happy-dom
 *
 * **第五十九條護欄：值域開放的欄位，使用者要造得出清單外的值。**
 *
 * 起點是使用者 2026-08-24 的回報：「C++ 那邊的 function return type 是不是
 * **無法自訂**？例如我要 `int**` 就找不到了。」
 *
 * 實測那天的結論是**讀得回來，寫不出去**：語義樹與積木狀態都收得下 `int**`，
 * 而 Blockly 的 `field_dropdown` 把清單外的值當成非法。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果這支護欄在「`field_dropdown` 其實會保留清單外的值」的情況下仍然
 * > 報出一堆待還的欄位，代表它量的是宣告而不是行為——那是工具壞了。**
 *
 * 判斷依據是 `★ 行為注入`那兩支：它們**真的建一個工作區、真的載一份狀態、
 * 真的把欄位值讀回來**。兩種欄位一個保值一個不保值，這條護欄才有意義。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「自訂的值合不合法」**——P6：我們不是編譯器。使用者打 `int**` 或
 *   一個自訂類別名都該收下，**驗它等於把「我們沒實作」講成「你寫錯了」**。
 * - **不檢測選單的文字與翻譯**——`retire-imperative-block` 第 5 步逐字：
 *   「**沒有任何測試在看標籤**」。那一步是人工開瀏覽器。
 * - **不判斷一個值域到底開不開放**——那是判斷，落在
 *   `tests/assets/dropdown-domain-decisions.json`，而**每一筆都要有理由**。
 *
 * ## 為什麼一半硬性零、一半棘輪
 *
 * `build-guardrail` 6.8 的兩問：
 *
 * | 量 | 留一筆規範還成立嗎 | 修一筆要付多少 | 判定 |
 * |---|---|---|---|
 * | 沒有判定的下拉 | ✗（一個沒判過的下拉＝沒有人想過它） | 一行 JSON | **硬性零** |
 * | 開放而仍封閉的欄位 | ✗ | **每一筆都要開瀏覽器驗標籤** | **棘輪** |
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { componentBlocks } from '../../src/core/component/registry'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { assertRatchet, assertCorpus, printReport } from '../helpers/guardrail'

const ROOT = path.resolve(__dirname, '../..')

interface Decision { decision: 'open' | 'closed'; field: string; reason: string }
const DECISIONS: Record<string, Decision> = JSON.parse(
  readFileSync(path.join(ROOT, 'tests/assets/dropdown-domain-decisions.json'), 'utf8'),
).decisions

/** 掃出每一顆積木宣告裡的下拉欄位 */
function dropdownFields(): { key: string; field: string }[] {
  const out: { key: string; field: string }[] = []
  const walk = (o: unknown, blockType: string): void => {
    if (Array.isArray(o)) return o.forEach((v) => walk(v, blockType))
    if (!o || typeof o !== 'object') return
    const rec = o as Record<string, unknown>
    if (rec['type'] === 'field_dropdown' || rec['type'] === 'field_dynamic_dropdown') {
      out.push({ key: `${blockType}.${String(rec['name'])}`, field: String(rec['type']) })
    }
    for (const v of Object.values(rec)) walk(v, blockType)
  }
  for (const form of componentBlocks() as { blockDef?: { type?: string } }[]) {
    const t = form.blockDef?.type
    if (t) walk(form.blockDef, t)
  }
  // 同一個鍵可能出現在多個形態上——去重
  return [...new Map(out.map((o) => [o.key, o])).values()]
}

/** 真的建一個工作區、載一份帶著清單外的值的狀態，把欄位讀回來 */
function survivesLoad(blockType: string, fieldName: string, probe: string): boolean {
  const ws = new Blockly.Workspace()
  try {
    Blockly.serialization.workspaces.load(
      { blocks: { languageVersion: 0, blocks: [{ type: blockType, fields: { [fieldName]: probe } }] } },
      ws,
    )
    const b = ws.getAllBlocks(false)[0]
    return b?.getFieldValue(fieldName) === probe
  } catch {
    return false
  } finally {
    ws.dispose()
  }
}

const PROBE = 'zzz_probe_value'
let fields: { key: string; field: string }[] = []
let ws: Blockly.Workspace

beforeAll(async () => {
  // 🔴 **要走產品那條註冊路**——真積木沒被定義進 Blockly 的話，
  //    `survivesLoad` 對每一顆都回 false，而報表會印出一個看起來像發現的數字。
  //    第一版就是這樣：印 46（＝全部），而真實是 31。
  //    > **一個比產品乾淨的量測環境，量到的是一個不存在的系統。**
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [['甲', 'a']])
  }
  declareDropdownSource('__probe_source__', () => [['甲', 'a']])
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()
  const { BlockRegistrar, setLanguageInputNames } = await import('../../src/ui/block-registrar')
  const n = await import('../../src/languages/cpp/block-input-names')
  setLanguageInputNames({
    compoundAssign: n.C_COMPOUND_ASSIGN_INPUTS, compoundAssignExpr: n.C_COMPOUND_ASSIGN_EXPR_INPUTS,
    varDeclareExpr: n.C_VAR_DECLARE_EXPR_INPUTS, whileBlock: n.WHILE_INPUTS,
    countLoop: n.COUNT_LOOP_INPUTS, returnBlock: n.RETURN_INPUTS,
    arrayAccess: n.ARRAY_ACCESS_INPUTS, arrayAssign: n.ARRAY_ASSIGN_INPUTS, varAssign: n.VAR_ASSIGN_INPUTS,
  } as never)
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
  Blockly.defineBlocksWithJsonArray([
    { type: '__probe_closed__', message0: '%1', args0: [{ type: 'field_dropdown', name: 'F', options: [['甲', 'a']] }] },
    { type: '__probe_open__', message0: '%1', args0: [{ type: 'field_dynamic_dropdown', name: 'F', options: [['甲', 'a']], allowCustom: true }] },
    { type: '__probe_source__', message0: '%1', args0: [{ type: 'field_dynamic_dropdown', name: 'F', source: '__probe_source__' }] },
  ] as never)
  fields = dropdownFields()
})

describe('護欄：值域開放的欄位要寫得出來（第五十九條）', () => {
  it('★ 行為注入：封閉的 `field_dropdown` **會**把清單外的值換掉', () => {
    expect(
      survivesLoad('__probe_closed__', 'F', PROBE),
      '如果它其實會保值，這條護欄整個沒有意義——那 31 筆待還是憑空的',
    ).toBe(false)
  })

  it('★ 行為注入：`field_dynamic_dropdown`（靜態清單）**保住**清單外的值', () => {
    expect(survivesLoad('__probe_open__', 'F', PROBE)).toBe(true)
  })

  it('★ 行為注入：`field_dynamic_dropdown`（動態來源）也保住', () => {
    expect(survivesLoad('__probe_source__', 'F', PROBE)).toBe(true)
  })

  it('★ 入口條件：真的掃到下拉了，而且真積木真的定義進 Blockly 了', () => {
    // ⚠️ 錨在**輸入量**上：下拉的總數只會隨著新增積木變大，
    //    不會因為這條護欄想推向零的東西被修好而變小
    expect(fields.length, '一個下拉都沒掃到 → 下面每一條都是空過的').toBeGreaterThan(50)
    // 🔴 第二個入口條件是第一版漏掉的那個：**掃到宣告 ≠ 積木建得出來**
    expect(Blockly.Blocks['cpp_var_declare'], '產品那條註冊路沒跑 → 每一顆都會「失敗」，而那是假的').toBeTruthy()
  })

  it('🔴 硬性零：每一個下拉都要有判定，而判定要說得出理由', () => {
    const missing = fields.filter((f) => !DECISIONS[f.key]).map((f) => f.key)
    const noReason = Object.entries(DECISIONS).filter(([, d]) => !d.reason).map(([k]) => k)
    expect(missing, '一個沒被判過的下拉，代表沒有人想過它的值域開不開放').toEqual([])
    expect(noReason, '說不出理由的判定，是把「懶得看」寫成「看過了」').toEqual([])
  })

  it('★ 判定會過期：判定裡有而程式碼裡沒有的，要報成孤兒', () => {
    const live = new Set(fields.map((f) => f.key))
    const orphans = Object.keys(DECISIONS).filter((k) => !live.has(k))
    expect(orphans, '底下的事實變了，而判定還留著——留著會讓一個過期的結論繼續生效').toEqual([])
  })

  it('棘輪：判定為開放而仍然改掉使用者的值的欄位，只准下降', () => {
    const debt: string[] = []
    // ⚠️ **動態編號不進棘輪**（同第三十四條護欄的處置）：`TYPE_{i}` 是樣板名，
    //    真正的欄位叫 `TYPE_0`。拿樣板名去載一定失敗，而那是**量測的假象**不是缺陷。
    //    🔴 而它們要**另立一欄**，不是靜默排除——縮分母比修分子容易。
    const templated: string[] = []
    for (const f of fields) {
      const d = DECISIONS[f.key]
      if (d?.decision !== 'open') continue
      if (f.key.includes('{')) {
        templated.push(f.key)
        continue
      }
      if (!survivesLoad(f.key.split('.')[0], f.key.split('.').slice(1).join('.'), PROBE)) {
        debt.push(`${f.key}（${d.reason.slice(0, 24)}…）`)
      }
    }
    printReport('值域開放的欄位（第五十九條）', [
      `下拉總數：${fields.length}｜判定為開放：${Object.values(DECISIONS).filter((d) => d.decision === 'open').length}`,
      '',
      '**「開放」＝ 這個欄位的值域在現實中是無窮的**，於是有限的選項只能是建議。',
      '而封閉的那些（運算子、`public/private`、`begin/end`）**下拉是對的**。',
      '',
      `仍然會改掉使用者的值：${debt.length} 個`,
      ...debt.map((d) => `  ${d}`),
      '',
      `動態編號的樣板名（量不到，另計）：${templated.length} 個  ${templated.join(' ')}`,
    ])
    assertCorpus([['下拉總數', fields.length]], 'dropdown-domain')
    assertRatchet([['開放而不保值', debt.length]], 'dropdown-domain', { detail: debt })
  })
})
