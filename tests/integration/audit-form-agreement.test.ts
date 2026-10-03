/**
 * **各式投影之間，從外面看不出差別**——同一個身分的多個形態要說同一件事。
 *
 * ## 它從哪來（2026-10-03）
 *
 * 使用者想用 λ 演算的三個基本運算當「意圖 ↔ 形式對齊」的測試框架：
 *
 * ```
 * α  換名不算數      身分不隨槽名／參數名而變
 * β  填了會算出什麼   跨 runtime 對答案
 * 🔴 η  從外面看不出差  同一個身分的多個形態,觀察不出差別
 * ```
 *
 * 而 η **就是這個產品標語的形式版本**：
 *
 * > 「唯一真實，各式投影。」——**各式投影之間，從外面看不出差別。**
 *
 * ## 🔴 而既有的兩條只驗到「名字」，沒驗到「內容」
 *
 * ```
 * roundtrip-all「Render coverage」   元件 → 對的【積木型別】
 * roundtrip-all「Extract coverage」  積木 → 對的【componentId】
 *                                   ⚠️ 它只比 componentId,不比 properties／slots
 * ⟹ 兩個形態【各自】知道自己叫什麼,而【沒有人問它們內容說的是不是同一件事】
 * ```
 *
 * ## 這一條驗什麼
 *
 * 母體是**宣告了 `role` 軸的身分**（語句↔運算式那一對）。同一棵語義樹渲染兩次
 * ——一次在語句位置、一次在運算式位置——extract 回來要是**同一棵**。
 *
 * ⚠️ **只收 `role` 那一根軸**。`container_kind`（stack／queue）那一根**不該**
 * 互換——推進堆疊與推進佇列是不同的情境，而它那一面由
 * `multi-form-container.test.ts` 的 CK-3 驗（「執行器 MUST NOT 讀 container_kind
 * ——改成錯的值，行為不變」）。
 *
 * ## ⚠️ 量測自己的兩個坑，都踩過了
 *
 * ```
 * ① 比較前要剝掉【每次都不同】的欄位：node.id 與 metadata.sourceBlockId
 *    不剝的話 23/23 全報「不同」—— 而差別只是一個新生的積木 id
 * ② 「兩邊相等」可以是【兩邊都空】
 *    ⟹ 下面有一條 ★ 入口條件：輸入有內容時,輸出不得兩邊都空
 * ```
 *
 * 🔴 ②那一條是這支測試的**第二個判準**，不是裝飾——少了它，一個把所有東西
 * 渲染成空積木的 renderer 也會全綠。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { createNode } from '../../src/core/semantic-tree'
import { printReport } from '../helpers/guardrail'
import type { BlockSpec, SemanticNode } from '../../src/core/types'

const registry = new BlockSpecRegistry()
registry.loadFromSplit(allCppComponents(), allCppProjections())
const allSpecs: BlockSpec[] = registry.getAll()

let renderer: PatternRenderer
let extractor: PatternExtractor
beforeAll(() => {
  renderer = new PatternRenderer()
  extractor = new PatternExtractor()
  renderer.loadBlockSpecs(allSpecs)
  extractor.loadBlockSpecs(allSpecs)
})

/**
 * 🔴 **判過的例外，不是靜默跳過**（體例同 `audit-corpus-shapes`：
 * 「零的那一格必須是【判過的】，不是【沒想到的】」）。
 */
const DECIDED: Record<string, string> = {
  'cpp:var_declare':
    '命令式積木定義——`PatternRenderer` 渲染它會得到一塊空積木（實測：真實的 '
    + '`int a = 1;` 進去,出來是 `{fields:{},inputs:{}}`）,而產品走 `block-registrar`。'
    + '那是既有的「雙重真相 ＋ PatternRenderer 的 fallback」類別,'
    + '由 `blockdef-consistency` 盯著,退場路徑是 `retire-imperative-block`。',
}

/** 剝掉每次都不同的欄位——`id` 帶計數器與時戳，`sourceBlockId` 是新生的積木 id。 */
const shape = (n: unknown): string =>
  JSON.stringify(n, (k, v) => (k === 'id' || k === 'sourceBlockId' ? undefined : v))

const rich = (n: SemanticNode): boolean =>
  Object.keys(n.properties ?? {}).length > 0 || Object.keys(n.slots ?? {}).length > 0

/** 照元件宣告造一棵最小的樹（與 `roundtrip-all` 的 `buildDummyNode` 同一招）。 */
function dummy(spec: BlockSpec): SemanticNode {
  const c = spec.componentMapping as never as
    { componentId: string; properties?: string[]; slots?: Record<string, string> | Record<string, string>[] }
  const props: Record<string, string> = {}
  for (const p of c.properties ?? []) props[p] = 'test'
  const slots: Record<string, SemanticNode[]> = {}
  const defs = Array.isArray(c.slots) ? Object.assign({}, ...c.slots) as Record<string, string> : (c.slots ?? {})
  for (const [n, role] of Object.entries(defs)) {
    slots[n] = role === 'statements' ? [] : [createNode('cpp:literal_number', { value: '0' })]
  }
  return createNode(c.componentId, props, slots)
}

/** 宣告了 `role` 軸的身分 → 它的中性（語句）spec。 */
function roleAxisBases(): Map<string, BlockSpec> {
  const ids = new Set<string>()
  for (const s of allSpecs) {
    if ((s as { form?: { axis?: string } }).form?.axis === 'role') {
      ids.add((s.componentMapping as { componentId: string }).componentId)
    }
  }
  const out = new Map<string, BlockSpec>()
  for (const s of allSpecs) {
    const id = (s.componentMapping as { componentId?: string } | undefined)?.componentId
    if (id && ids.has(id) && !(s as { form?: unknown }).form) out.set(id, s)
  }
  return out
}

interface finding { id: string; kind: 'divergent' | 'hollow' | 'null'; detail: string }

function walk(): { findings: finding[]; checked: number; decided: string[] } {
  const findings: finding[] = []
  const decided: string[] = []
  let checked = 0
  for (const [id, spec] of [...roleAxisBases()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const node = dummy(spec)
    // ⚠️ 語句那一側傳 `undefined`,不是 `'statement'`——產品內部只傳 `'expression'`,
    //    語句是預設。傳 `'statement'` 會讓渲染器報「那個軸值不在宣告的形態裡」。
    const st = renderer.render(node, undefined, undefined)
    const ex = renderer.render(node, undefined, 'expression')
    if (!st || !ex) { findings.push({ id, kind: 'null', detail: `render 回 null（語句=${!!st} 運算式=${!!ex}）` }); continue }
    const a = extractor.extract(st)
    const b = extractor.extract(ex)
    if (!a || !b) { findings.push({ id, kind: 'null', detail: `extract 回 null（語句=${!!a} 運算式=${!!b}）` }); continue }
    if (rich(node) && !rich(a) && !rich(b)) {
      findings.push({ id, kind: 'hollow', detail: '輸入有內容,而兩個形態 extract 回來【都是空的】——「相等」是假的' })
      continue
    }
    checked++
    if (shape(a) !== shape(b)) {
      if (DECIDED[id] !== undefined) { decided.push(id); continue }
      findings.push({
        id, kind: 'divergent',
        detail: `${st.type} ↔ ${ex.type}\n       語句 ${shape(a).slice(0, 160)}\n       運算 ${shape(b).slice(0, 160)}`,
      })
    }
  }
  return { findings, checked, decided }
}

describe('護欄：各式投影之間，從外面看不出差別（η）', () => {
  it('★ 入口條件：母體不是空的——否則下面那個零是假的', () => {
    expect(roleAxisBases().size, '🔴 一顆宣告 role 軸的身分都找不到 → 載入壞了，不是世界長這樣')
      .toBeGreaterThan(15)
  })

  it('★ 入口條件：不得有「兩邊都空」的——那種相等不算相等', () => {
    const hollow = walk().findings.filter((f) => f.kind === 'hollow')
    expect(hollow.map((f) => `${f.id} · ${f.detail}`),
      '🔴 輸入有內容而兩個形態都 extract 成空的——下面的「相等」量的是空氣').toEqual([])
  })

  it('★ 注入：把一個形態的內容動掉，必須被報出來', () => {
    // 合成一對「說法不同」的 extract 結果,驗判準本身抓得到。
    const a = createNode('zz:合成', { x: '1' }, {})
    const b = createNode('zz:合成', { x: '2' }, {})
    expect(shape(a), '🔴 判準連屬性不同都看不出來 → 它量不到任何東西').not.toBe(shape(b))
    // 而只差一個【每次都不同】的欄位時,不得被誤報
    const c = createNode('zz:合成', { x: '1' }, {})
    expect(shape(a), '🔴 只差 id 就被當成不同 → 23 顆會全報，而差別只是一個新生的積木 id')
      .toBe(shape(c))
  })

  it('🔴 硬性零：同一棵樹走兩個位置，extract 回來要是同一棵', () => {
    const { findings, checked, decided } = walk()
    const divergent = findings.filter((f) => f.kind !== 'hollow')
    printReport('各式投影之間看不出差別（母體＝宣告 role 軸的身分）', [
      `母體 ${roleAxisBases().size} 顆｜真的比對過 ${checked} 顆｜判過的例外 ${decided.length} 顆`,
      ...decided.map((id) => `   ⚖️ ${id}：${DECIDED[id]}`),
      '',
      '⚠️ 只收 `role` 那一根軸。`container_kind`（stack／queue）不該互換',
      '   ——它那一面由 multi-form-container 的 CK-3 驗。',
    ])
    expect(
      divergent.map((f) => `${f.id} · ${f.detail}`),
      '\n🔴 同一個身分的兩個形態，對內容的說法不一致：\n'
      + '要嘛其中一個形態漏讀了東西，要嘛它們本來就不是同一件事的兩個樣子。\n'
      + '🟢 而【不要】靠放寬比較讓它變綠——那會讓這條護欄退回成「只比名字」，\n'
      + '   而「只比名字」既有的兩條已經在做了。\n',
    ).toEqual([])
  })
})
