/**
 * 第二十五條護欄：**每顆積木都要自己宣告欄位對應**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的「有欄位卻沒宣告對應」的積木
 * > 沒有被報出來，代表護欄壞了，不是宣告都齊。**
 *
 * ## 它取代了什麼
 *
 * 在此之前，沒有 `renderMapping` 的積木由 `deriveRenderMapping` **自動推導**
 * 對應——拿 `concept.properties` 去比對積木欄位名。方便，而代價有兩層：
 *
 * 1. **推導有兩份，而兩份不一樣**（`audit-derive-agreement` 抓到的）：
 *    `cpp_block_comment` 的內容渲染得出去、抽取不回來，使用者寫的註解會消失。
 * 2. **參數宣告驅動了抽取行為**：改一顆元件的參數列，就會改變它的積木怎麼被
 *    讀回來。那是 C1（參數規格化）動不了 124 顆宣告的原因——實測改兩次、
 *    來回轉換紅兩次。
 *
 * 186 筆對應已固化成顯式宣告（驗過「合併結果一字不差」），推導已刪除。
 * **代價是新積木必須自己宣告**——這條護欄就是那個代價的收據：
 * 忘了不會靜默推導，會被當場指名。
 *
 * > **顯式 ＋ 護欄，不是隱式魔法。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測對應對不對**——只檢測「有欄位就要有對應」。對錯由來回轉換測試管。
 * - **不檢測手寫策略的積木**：`registerExtractStrategy` 註冊的走另一條路，
 *   它們的欄位由手寫程式碼讀。判定保守——這類會**低報**，不會誤報。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import type { BlockProjectionJSON, BlockSpec } from '../../src/core/types'

/** 手寫抽取策略的積木——它們的欄位由程式碼讀，不走宣告式對應 */
const 手寫策略 = new Set([
  'cpp_var_declare', 'cpp_var_assign', 'cpp_var_ref', 'cpp_print', 'cpp_input', 'cpp_input_expression',
  'cpp_if', 'cpp_if_else', 'cpp_func_call', 'cpp_func_call_expression', 'cpp_func_def',
  'cpp_var_declare_expression', 'cpp_increment_expression', 'cpp_var_assign_compound_expression',
  'cpp_input_formatted', 'cpp_input_formatted_expression', 'cpp_print_formatted', 'cpp_doc_comment',
])

interface Finding {
  blockType: string
  缺: string[]
}

function measure(extra: BlockProjectionJSON[] = []): Finding[] {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts(), [...allCppProjections(), ...extra])

  const out: Finding[] = []
  for (const spec of reg.getAll() as BlockSpec[]) {
    const bd = spec.blockDef as Record<string, unknown>
    const blockType = bd?.type as string | undefined
    if (!blockType || 手寫策略.has(blockType)) continue

    const args: Record<string, unknown>[] = []
    for (let i = 0; i <= 9; i++) {
      const a = bd[`args${i}`] as Record<string, unknown>[] | undefined
      if (a) args.push(...a)
    }
    const has = (pred: (t: string) => boolean): boolean =>
      args.some((a) => pred(String(a.type ?? '')))

    const rm = spec.renderMapping
    const 缺: string[] = []
    // 只在「這顆積木確實有這類參數」而且「概念確實有對應的槽」時才要求宣告
    const props = spec.conceptMapping?.properties ?? []
    const children = Object.keys(spec.conceptMapping?.children ?? {})

    if (props.length > 0 && has((t) => t.startsWith('field_')) && !(rm?.fields && Object.keys(rm.fields).length)) {
      缺.push('fields')
    }
    if (children.length > 0 && has((t) => t === 'input_value') && !(rm?.inputs && Object.keys(rm.inputs).length)) {
      缺.push('inputs')
    }
    if (
      children.length > 0 &&
      has((t) => t === 'input_statement') &&
      !(rm?.statementInputs && Object.keys(rm.statementInputs).length)
    ) {
      缺.push('statementInputs')
    }
    if (缺.length) out.push({ blockType, 缺 })
  }
  return out.sort((a, b) => a.blockType.localeCompare(b.blockType))
}

const 合成 = (type: string): BlockProjectionJSON =>
  ({
    id: type,
    conceptId: 'cpp:var_declare', // 有 properties 的真概念
    language: 'cpp',
    category: 'data',
    version: '1.0.0',
    blockDef: { type, message0: '%1', args0: [{ type: 'field_input', name: 'NAME', text: 'x' }] },
  }) as unknown as BlockProjectionJSON

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入「有欄位卻沒宣告對應」的積木 → **必須被報出**', () => {
    const hit = measure([合成('__合成_沒宣告對應__')]).find((f) => f.blockType === '__合成_沒宣告對應__')
    expect(hit, '合成的違規沒有被報出來 → **護欄壞了**').toBeDefined()
    expect(hit!.缺).toContain('fields')
  })

  it('★ 反向：注入一個**有宣告**的積木 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    const p = 合成('__合成_有宣告__') as unknown as { renderMapping?: unknown }
    p.renderMapping = { fields: { NAME: 'name' }, inputs: {}, statementInputs: {} }
    expect(
      measure([p as BlockProjectionJSON]).find((f) => f.blockType === '__合成_有宣告__'),
      '一顆已宣告的積木被報成違規 → 這條護欄會亂叫',
    ).toBeUndefined()
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppConcepts(), allCppProjections())
    expect(reg.getAll().length, '零筆 spec → 是載入壞了').toBeGreaterThan(150)
  })
})

describe('欄位對應必須是顯式宣告', () => {
  const findings = measure()

  it('報表', () => {
    printReport('顯式欄位對應', [
      `缺宣告的積木：${findings.length}`,
      '',
      ...findings.map((f) => `  ⚠️ ${f.blockType.padEnd(28)} 缺 ${f.缺.join('、')}`),
    ])
    expect(true).toBe(true)
  })

  it('★ 缺宣告 = 0', () => {
    // ⚠️ **硬性零**：推導已經刪除，所以「缺宣告」不再有退路——
    // 那顆積木的欄位會**靜靜地讀不回來**，症狀與 `cpp_block_comment` 一模一樣。
    expect(
      findings.map((f) => `${f.blockType} 缺 ${f.缺.join('、')}`),
      '這顆積木有欄位／輸入，而沒有宣告對應。推導已退場，沒有東西會替它補上——' +
        '它的內容會在 積木 → 語義樹 的方向靜靜消失。',
    ).toEqual([])
  })
})
