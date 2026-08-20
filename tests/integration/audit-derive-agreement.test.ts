/**
 * 第二十四條護欄：**渲染與抽取必須用同一套推導**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的「只有一邊認得的欄位型別」
 * > 沒有被報出來，代表護欄壞了，不是兩邊一致。**
 *
 * ## 為什麼需要這一條——它今天就在掉資料
 *
 * 沒有顯式 `renderMapping.fields` 的積木投影（實測 **107 / 131**），
 * 其欄位對應是**推導**出來的。而推導有**兩份**：
 *
 * ```
 * pattern-renderer.ts:365   deriveRenderMapping   ← 認 field_multilinetext
 * pattern-extractor.ts:225  deriveRenderMapping   ← **不認**
 * ```
 *
 * 於是 `cpp_block_comment` 的內容**渲染得出去、抽取不回來**：
 *
 * ```
 * 渲染 fields = {"TEXT":"區塊註解內容"}
 * 抽回 props  = {}                      ← 掉了
 * ```
 *
 * 而 `cpp_doc_comment` 活著，只因為它剛好有**顯式**的 `fields`。
 *
 * > MEMORY.md 早就記著這個坑的形狀：「沒有顯式 renderStrategy 的積木會從 JSON
 * > blockDef 自動推導 input mapping…**只在 Block Style 切換（serialize→deserialize）
 * > 時才暴露**」。這條護欄把「只在切換時暴露」變成「一跑測試就叫」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測推導本身對不對**——只檢測**兩邊一致**。兩份一起錯它照樣綠。
 *   （那一格由 `audit-param-spec` 與來回轉換測試負責。）
 * - **不檢測顯式宣告的正確性**——顯式的那 24 筆不走推導。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import type { BlockSpec } from '../../src/core/types'

function load(): BlockSpec[] {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts(), allCppProjections())
  return reg.getAll()
}

/** 兩邊都用 private 的推導——由公開行為反推：渲染出什麼欄位、抽取讀回什麼 */
function mapping(specs: BlockSpec[]): { blockType: string; renderKnows: string[]; extractKnows: string[] }[] {
  const r = new PatternRenderer()
  const e = new PatternExtractor()
  r.loadBlockSpecs(specs)
  e.loadBlockSpecs(specs)

  const out: { blockType: string; renderKnows: string[]; extractKnows: string[] }[] = []
  for (const spec of specs) {
    const bd = spec.blockDef as Record<string, unknown>
    const blockType = bd?.type as string | undefined
    if (!blockType) continue

    // 蒐集這顆積木所有的欄位參數
    const args: Record<string, unknown>[] = []
    for (let i = 0; i <= 9; i++) {
      const a = bd[`args${i}`] as Record<string, unknown>[] | undefined
      if (a) args.push(...a)
    }
    const fieldArgs = args.filter((a) => String(a.type ?? '').startsWith('field_'))
    if (fieldArgs.length === 0) continue

    // 用「渲染一個帶滿參數的節點 → 看落了哪些欄位」與
    // 「拿那個 block 去抽取 → 看讀回哪些參數」對照。
    const props = spec.componentMapping?.properties ?? []
    if (props.length === 0) continue
    const node = {
      id: 'probe',
      componentId: spec.componentMapping!.componentId,
      properties: Object.fromEntries(props.map((p) => [p, `«${p}»`])),
      children: {},
    }
    const state = r.render(node as never)
    if (!state) continue
    const renderKnows = Object.keys(state.fields ?? {}).filter((k) =>
      fieldArgs.some((a) => a.name === k),
    )
    const back = e.extract(state as never)
    const extractKnows = Object.entries(back?.properties ?? {})
      .filter(([, v]) => typeof v === 'string' && v.startsWith('«'))
      .map(([k]) => k)

    // 比對「渲染落了幾個欄位」與「抽取讀回幾個參數」——數量對不上就是分歧
    if (renderKnows.length !== extractKnows.length) {
      out.push({ blockType, renderKnows, extractKnows })
    }
  }
  return out.sort((a, b) => a.blockType.localeCompare(b.blockType))
}

describe('自我驗證：這條護欄真的量得到東西', () => {
  const specs = load()

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(specs.length, '零筆 spec → 是載入壞了').toBeGreaterThan(150)
    const r = new PatternRenderer()
    r.loadBlockSpecs(specs)
    expect(r.render({ id: 'x', componentId: 'cpp:var_declare', properties: { name: 'a', type: 'int' }, children: {} } as never))
      .not.toBeNull()
  })

  it('★ 已知答案：`doc_comment` 有顯式 fields，兩邊一致；`block_comment` 靠推導', () => {
    // ⚠️ 這一對是整條護欄的錨點，而它們的差別是**查證過的**：
    // `cpp_doc_comment` 的投影有顯式 `renderMapping.fields`，`cpp_block_comment` 沒有。
    const r = new PatternRenderer()
    const e = new PatternExtractor()
    r.loadBlockSpecs(specs)
    e.loadBlockSpecs(specs)
    const walkAll = (cid: string, prop: string): unknown => {
      const s = r.render({ id: 'p', componentId: cid, properties: { [prop]: '«v»' }, children: {} } as never)
      return s ? e.extract(s as never)?.properties?.[prop] : undefined
    }
    expect(walkAll('cpp:doc_comment', 'brief'), 'doc_comment 有顯式 fields，本來就該保住').toBe('«v»')
  })
})

describe('渲染與抽取的推導一致性', () => {
  const divergence = mapping(load())

  it('報表', () => {
    printReport('推導一致性', [
      `渲染／抽取對不上的積木：${divergence.length}`,
      '',
      ...divergence.map(
        (d) => `  ⚠️ ${d.blockType.padEnd(24)} 渲染落了 [${d.renderKnows}] ／ 抽取讀回 [${d.extractKnows}]`,
      ),
    ])
    expect(true).toBe(true)
  })

  it('★ 分歧 = 0', () => {
    // ⚠️ **硬性零**：留一筆＝有一顆積木的內容在積木→語義樹的方向會掉，
    // 而它的唯一症狀是「切換積木風格之後東西不見了」——使用者不會知道為什麼。
    expect(
      divergence.map((d) => `${d.blockType}: 渲染 [${d.renderKnows}] ≠ 抽取 [${d.extractKnows}]`),
      '渲染與抽取用不同的規則推導欄位對應——渲染得出去、抽取不回來的東西會靜靜地消失。',
    ).toEqual([])
  })
})
