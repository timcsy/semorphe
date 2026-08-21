/**
 * 第二十九條護欄：**符合性**——一顆元件宣告的接點，形態表達得出來嗎
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果下面「注入」那一節合成的輸入沒有得到預期的判定
 * > ——(a) 一個接點被丟掉的合成形態必須被報，
 * > (b) 一個接點完整保留的合成形態必須**不**被報，
 * > (c) 渲染不出來的必須進「無法確定」而不是進「安全」——
 * > 代表護欄壞了，不是符合性成立。**
 *
 * 錨在**合成輸入**與**輸入量**（掃到幾顆元件）上，不錨在「還剩幾筆違規」上。
 * 後者會在成功的那天變紅（`build-guardrail` 第 2 步的語法簽名）。
 *
 * ## 這條規範從哪來
 *
 * `components/元件.md:346`：
 *
 * > | 投影忠實度不變式 | **符合性** | `conformance` | （原無名） |
 *
 * 它一直沒有機制，而 `components/執行機構.md` 的「宣稱 / 檢查 / 後果」表
 * 2026-08-10 新增的第六列就是它。後果使用者看得到：
 * `vector<int> v = {3,1,4}` 走一次投影就變成 `vector<int> v;`
 * ——切語言、切風格、存檔重載都會走那條路。
 *
 * ## ⚠️ 這條護欄的第一版是**靜態**的，而它錯了
 *
 * 第一版比對「`blockDef` 的 input 名 ＋ `renderMapping`」與接點名，報 **9 筆**。
 * 實測（合成節點走一次投影）只有 **1 筆**——差額全是**動態積木**：
 * `cpp_print` 的插槽叫 `EXPR0`、`cpp_var_declare` 的叫 `INIT_0`，由
 * `src/ui/block-registrar.ts` 在執行期加上，靜態比對看不到，
 * 名字也對不上接點（`values`／`initializer`）。
 *
 * 我一度想改讀 `block-registrar.ts` 的 `appendValueInput('X')` 來補——
 * **那仍然是代理**，而且名字還是對不上。
 *
 * > `build-guardrail` 第 6 步：**靜態判斷不能下結論，只能排順序。
 * > 有辦法實測就實測。**
 *
 * 而救它的正是那一步要求的動作——**先在已知答案的樣本上驗過**
 * （`cpp:vector_declare` 必須被報、`cpp:print` 必須不被報）。
 * 沒有那個樣本，9 筆會被當成真相寫進基線。
 *
 * ## 量什麼
 *
 * 對每顆宣告了接點的元件：合成一個帶子節點的最小節點 → 走**生產入口**
 * `renderToBlocklyState` → 再走生產的反向 `PatternExtractor.extract` →
 * **比對回來的子節點集合**。
 *
 * ⚠️ **不比插槽名。** 第二版比了（`values` vs `EXPR0`），於是 `cpp:arithmetic`
 * 被誤報——它的插槽叫 `A`／`B` 而接點叫 `left`／`right`，靠 `renderMapping` 對應。
 * **而 `extract` 本身就會套用 `renderMapping`**——走完來回，名字問題自動消失。
 *
 * > 這是第二次在同一條護欄上踩到「拿名字做判斷」。第一次是靜態 `blockDef`，
 * > 第二次是插槽名對接點名。**兩次都是因為我在量代理，不是量那件事本身。**
 *
 * ⚠️ **必須走生產入口。** 直接呼叫 `PatternRenderer.render()` 會多報
 * `cpp:var_declare`——那條路繞過了 `renderStatementChain`。
 * 生產路徑是 `sync-controller.ts:202 → renderToBlocklyState`。
 *
 * ## 三個桶——判不出來的不計入安全
 *
 * | 桶 | 意義 |
 * |---|---|
 * | **確定違規** | 合成節點有那個子節點，走完投影之後不見了 |
 * | **無法確定** | 合成不出來、渲染不出來（例如只能當運算式的元件） |
 * | 安全 | 每個放得進去的接點都出得來 |
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測插槽裝的東西對不對**——只問「這個接點表達得出來嗎」。
 *   一個 `values` 插槽拿來裝條件式，這裡照樣綠。
 * - **不檢測 lift／generate／execute**——那三路由完備性護欄管。
 * - **不檢測反方向**（形態有插槽而語義沒有那個接點）——下面有量，
 *   但那是**報表不是硬關卡**：`renderMapping` 允許插槽對到欄位而非接點，
 *   而這裡分不出那種情形。
 * - **不經過 Blockly**——`happy-dom` 跑不動 Blockly 12 的 FocusManager。
 *   量的是「語義樹 → Blockly state」，不是「Blockly state → 畫面」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { loadBaseline, writeBaseline, RATCHET_NOTE, assertRatchet, printReport } from '../helpers/guardrail'
import { synthMinimalNode } from '../helpers/synth-node'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { createNode } from '../../src/core/semantic-tree'
import { allCppComponents } from '../../src/languages/cpp/all-declarations'
import type { SemanticNode } from '../../src/core/types'

const GUARD = 'conformance'

interface decision {
  componentId: string
  bucket: '確定違規' | '無法確定' | '安全'
  missing: string[]
  reason: string
}

interface Baseline {
  _meta: { guard: string; measuredAt: string; rule: string; note: string }
  certainViolations: number
  undetermined: number
  violationList: string[]
}

interface BlockState {
  type?: string
  inputs?: Record<string, { block?: BlockState }>
  [k: string]: unknown
}


/**
 * 判定一顆元件的符合性。**純函式**（渲染函式注入）——注入才餵得進合成輸入。
 *
 * 分出來的理由與 `scanText` 從 `scanFile` 分出來的相同：錨在真實資料上的
 * 注入測試，會在那些資料被修好的那天失效。
 */
export function judgeConformance(
  componentId: string,
  slotsPutIn: readonly string[],
  slotsGotBack: readonly string[] | null,
): decision {
  if (!slotsPutIn.length) return { componentId, bucket: '安全', missing: [], reason: '沒有宣告接點，或合成不出子節點' }
  if (slotsGotBack === null) {
    return {
      componentId,
      bucket: '無法確定',
      missing: [...slotsPutIn],
      reason: '走不完 render → extract（可能只能當運算式，也可能是漏了）；判不出來不計入安全',
    }
  }
  const missing = slotsPutIn.filter((k) => !slotsGotBack.includes(k))
  if (!missing.length) return { componentId, bucket: '安全', missing: [], reason: '每個放得進去的接點都回得來' }
  return {
    componentId,
    bucket: '確定違規',
    missing,
    reason: `接點 [${missing.join('、')}] 放得進語義樹，走完 render → extract 之後不見了（回來的：${slotsGotBack.join('、') || '無'}）`,
  }
}


interface form { componentId: string; renderMapping?: { childrenAsField?: { field: string; childSlot: string; childComponent: string; parts: string[] }[] } }
const formsOf = (id: string): form[] =>
  (allCppProjections() as never as form[]).filter((f) => f.componentId === id)

let extractor: PatternExtractor
let cache: decision[] | null = null

function measureOnce(): decision[] {
  if (cache) return cache
  const out: decision[] = []
  for (const c of allCppComponents() as never as { componentId: string; children?: Record<string, unknown> }[]) {
    const slotDecl = Object.keys(c.children ?? {})
    if (!slotDecl.length) continue
    let node: SemanticNode
    try {
      const s = synthMinimalNode(c as never) as { node?: SemanticNode }
      node = (s.node ?? (s as unknown as SemanticNode))
    } catch {
      out.push({ componentId: c.componentId, bucket: '無法確定', missing: slotDecl, reason: '合成不出最小節點' })
      continue
    }
    // ⚠️ **合成器不知道某個接點該放什麼型別的子節點**——它按 `allowed`
    // （`'expression'`）挑一顆，於是 `params` 會拿到 `cpp:literal_number`。
    // 那不是違規，是合成產物：一顆沒有 `type`／`name` 屬性的節點當然序列化不出東西。
    //
    // 而**宣告裡就寫著該放什麼**（`childrenAsField.childComponent`）。讀它，不要猜。
    for (const caf of formsOf(c.componentId).flatMap((f) => f.renderMapping?.childrenAsField ?? [])) {
      if (!(node.children[caf.childSlot] ?? []).length) continue
      node.children[caf.childSlot] = [
        createNode(caf.childComponent, Object.fromEntries(caf.parts.map((p, i) => [p, i === 0 ? 'int' : 'x']))),
      ]
    }
    // ⚠️ **一個接點合成一棵樹，不要一次全放。**
    //
    // 合成器不知道哪些接點是**互斥**的。實測：`cpp:var_declare` 在真實程式碼裡
    // `int a = 5;` 只有 `initializer`、`int a, b;` 只有 `declarators`——
    // **從來不會同時有**。一次全放會造出一棵真實世界不存在的樹，
    // 而 render 走了不該走的路，於是連本來好好的 `initializer` 也被報成掉了。
    //
    // 每個接點各自跑一次，它就只會為自己的失敗負責。
    const allSlots = Object.keys(node.children ?? {}).filter((k) => (node.children[k] ?? []).length > 0)
    const missing: string[] = []
    let renderedOnce = false
    for (const thisSlot of allSlots) {
      const singleSlot = { ...node, children: { [thisSlot]: node.children[thisSlot] } }
      let back: string[] | null = null
      try {
        const st = renderToBlocklyState(createNode('cpp:program', {}, { body: [singleSlot as SemanticNode] }))
        const extractBack = (st.blocks.blocks as BlockState[]).map((b) => extractor.extract(b as never)).filter(Boolean)
        const find = (n: SemanticNode | null): SemanticNode | null => {
          if (!n) return null
          if (n.componentId === c.componentId) return n
          for (const ks of Object.values(n.children ?? {})) for (const k of ks) { const r = find(k); if (r) return r }
          return null
        }
        const it = extractBack.map((x) => find(x as SemanticNode)).find(Boolean) ?? null
        back = it ? Object.keys(it.children ?? {}).filter((k) => (it.children[k] ?? []).length > 0) : null
      } catch { back = null }
      if (back !== null) { renderedOnce = true; if (!back.includes(thisSlot)) missing.push(thisSlot) }
    }
    out.push(
      renderedOnce
        ? judgeConformance(c.componentId, allSlots, allSlots.filter((k) => !missing.includes(k)))
        : judgeConformance(c.componentId, allSlots, null),
    )
  }
  cache = out
  return out
}


describe('護欄：符合性（宣告的接點，形態表達得出來嗎）', () => {
  beforeAll(() => {
    registerCppLanguage()
    setupTestRenderer()
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppComponents() as never, allCppProjections() as never)
    extractor = new PatternExtractor()
    extractor.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(extractor)
  })

  // ── 健康檢查：錨在輸入量，不在違規數 ────────────────────
  it('★ 健康檢查：掃到的元件數不得為零', () => {
    expect(measureOnce().length, '一顆有接點的元件都沒掃到 → 下面的數字是假的').toBeGreaterThan(100)
  })

  it('★ 健康檢查：動態積木的那個接點必須被判為走得過', () => {
    // 這一則釘的是**第一版錯在哪**：靜態比對把這幾顆報成違規，
    // 而它們的插槽由 `block-registrar.ts` 在執行期加上，名字與接點不同詞
    // （`EXPR0` vs `values`、`INIT_0` vs `initializer`）。
    // 沒有這一則，9 筆誤報會被當成真相寫進基線。
    //
    // ⚠️ **這一則的第一版錨錯了**：它斷言「這三顆整顆是安全的」，
    // 於是 `specs/106` 給 `cpp:var_declare` 補上 `declarators` 接點的當天
    // ——那是**正確的改動**——這條健康檢查自己變紅。
    //
    // 那是 `build-guardrail` 第 2 步那個形狀的又一個實例，而機制值得記：
    // **錨在「整顆乾淨」上，等於錨在「這顆元件的每一個接點都沒問題」**，
    // 而那是一個會隨世界變動的合取。正確的錨是**單一接點**——
    // 「`INIT_0` 那條動態插槽的路走得通」在補宣告前後都成立。
    const d = new Map(measureOnce().map((x) => [x.componentId, x]))
    for (const [id, slots] of [['cpp:print', 'values'], ['cpp:var_declare', 'initializer'], ['cpp:if', 'then_body']] as const) {
      expect(
        d.get(id)?.missing ?? [],
        `${id} 的 ${slots} 是動態積木的插槽，實測走得過投影——被判成掉了代表判準退回靜態了`,
      ).not.toContain(slots)
    }
  })

  // ── 棘輪 ────────────────────────────────────────────────
  it('棘輪：確定違規與無法確定都只准下降', () => {
    const all = measureOnce()
    const violations = all.filter((d) => d.bucket === '確定違規')
    const pending = all.filter((d) => d.bucket === '無法確定')

    printReport('符合性：確定違規', violations.map((d) => `  ✘ ${d.componentId} — ${d.reason}`))
    printReport('符合性：無法確定（不計入安全）', pending.map((d) => `  ？ ${d.componentId} — ${d.reason}`))

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          guard: GUARD,
          measuredAt: new Date().toISOString().slice(0, 10),
          rule:
            '合成一個帶子節點的最小節點 → 走生產入口 `renderToBlocklyState` → ' +
            '每個放得進去的接點都要出現在產出的插槽裡。⚠️ **是實測不是靜態比對**——' +
            '靜態版報 9 筆而實測只有 1 筆，差額全是動態積木（插槽名與接點名是不同的詞）。' +
            '判不出來的（合成不出、渲染不出）歸「無法確定」，**不計入安全**。',
          note: RATCHET_NOTE,
        },
        certainViolations: violations.length,
        undetermined: pending.length,
        violationList: violations.map((d) => `${d.componentId}: ${d.missing.join('、')}`).sort(),
      } satisfies Baseline)
    }

    const base = loadBaseline<Baseline>(GUARD)
    assertRatchet([
      ['確定違規', violations.length, base.certainViolations],
      ['無法確定', pending.length, base.undetermined],
    ])
  })

  // ── 注入：三個方向（build-guardrail 第 8、9 步）─────────
  describe('注入', () => {
    it('★ 注入 (a) 壞的輸入會報：接點放進去了、來回之後沒回來 → 確定違規', () => {
      const d = judgeConformance('cpp:fake', ['values', 'source'], [])
      expect(d.bucket).toBe('確定違規')
      expect(d.missing.sort()).toEqual(['source', 'values'])
      // 釘**理由**不只釘結果（第 8 步）——一個因為錯誤理由而給出正確結果的
      // 護欄，看起來與健康的完全一樣。
      expect(d.reason).toContain('走完 render → extract 之後不見了')
      expect(d.reason).toContain('無')
    })

    it('(b) 好的輸入不亂報：接點完整出來 → 安全', () => {
      // 不可省。沒有它，一個「什麼都報」的判定器也能通過 (a)。
      const d = judgeConformance('cpp:fake', ['values'], ['values'])
      expect(d.bucket).toBe('安全')
      expect(d.reason).toBe('每個放得進去的接點都回得來')
    })

    it('(b2) 好的輸入不亂報：插槽名與接點名不同詞也不影響 → 安全', () => {
      // `EXPR0` ↔ `values`、`A`/`B` ↔ `left`/`right` 都是這種。
      // **走完來回之後回來的是接點名**，所以名字問題根本不會出現在這一層
      // ——那正是第一、二版死掉的地方。
      const d = judgeConformance('cpp:fake', ['values'], ['values'])
      expect(d.bucket).toBe('安全')
    })

    it('(c) 判不出來的不計入安全：渲染不出來 → 無法確定', () => {
      const d = judgeConformance('cpp:fake', ['values'], null)
      expect(d.bucket).toBe('無法確定')
      expect(d.reason).toContain('不計入安全')
    })

    it('★ 部分缺只報缺的那幾個，不報全部', () => {
      const d = judgeConformance('cpp:fake', ['params', 'body'], ['body'])
      expect(d.missing).toEqual(['params'])
    })

    it('★ 沒有接點的元件不得被判成違規', () => {
      expect(judgeConformance('cpp:fake', [], []).bucket).toBe('安全')
    })

    // ── FR-003：第七顆忘了寫宣告，必須被抓到 ─────────────────
    //
    // 這一則是 spec 105 最容易漏的一條。六顆各寫一行修好了眼前的問題，
    // 而**下一個加元件的人不會知道要寫那一行**——沒有這條檢查，
    // 這次的修法只治了六顆。
    it('★ 有 params 接點但沒宣告 childrenAsField 的元件必須被報為違規', () => {
      // 合成一顆「有接點、沒宣告」的元件：它的參數走不過投影，
      // 而**沉默不得等於通過**。
      const notDeclared = judgeConformance('cpp:seventh', ['params'], ['body'])
      expect(notDeclared.bucket).toBe('確定違規')
      expect(notDeclared.missing).toEqual(['params'])
    })

    it('★ 已宣告的六顆，宣告確實存在（不是靠測試放水）', () => {
      // 釘住宣告本身——有人刪掉某一顆的 `childrenAsField`，這裡先紅，
      // 而不是等到來回轉換的樣本紅。兩者都會紅，但這一條**指得出是哪一顆**。
      const shouldHave = ['cpp:lambda', 'cpp:constructor', 'cpp:method_virtual',
        'cpp:method_virtual_pure', 'cpp:method_override', 'cpp:template_function']
      const missingDeclaration = shouldHave.filter((id) => !formsOf(id).some((f) => (f.renderMapping?.childrenAsField ?? []).length))
      expect(missingDeclaration, '這些元件的 params 沒有形態映射，參數會靜默消失').toEqual([])
    })
  })
})
