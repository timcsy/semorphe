/**
 * 第二十三條護欄：**參數規格與實際使用必須對得上**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面「已知答案的樣本」那一支沒有全過，
 * > 代表判準壞了，不是規格健康。**
 *
 * 錨點是**五個查證過的樣本**，不是總數——總數會隨每次補宣告而變，
 * 而樣本的答案是去讀程式碼確認的，不隨修復而失效。
 *
 * ## 為什麼這條護欄要**先於** 124 顆宣告
 *
 * `concepts/執行機構.md`「機制有了，沒人接上」目前有**七個實例**——
 * `skipPaths` 0/175、`abstractConcept` 33/131、`introduces_scope` 0/4、
 * 型別追蹤 0 呼叫者、`buildIoCategoryContents` 只有測試在叫、**CI 沒跑測試**。
 *
 * > **把 124 顆宣告寫得漂漂亮亮而沒有任何程式碼讀它，就是第八個。**
 *
 * 所以這條護欄是規格的**消費者**：先讓它紅、指名真違規，才動宣告。
 *
 * ## 三個方向，處置不同
 *
 * | | 意味著 | 處置 |
 * |---|---|---|
 * | **讀了沒宣告** | 規格不完整 | 補宣告 |
 * | **宣告了沒人讀** | 殘骸，或機制沒接上 | 刪，或說明它為誰而存在 |
 * | 寫了沒宣告也沒人讀 | 純粹的死資料（`cpp_include.local`） | 刪寫入端 |
 *
 * 第三種要走流程才看得到（靜態掃不到寫入端），本護欄**只管前兩種**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測參數的值對不對**——那要等 `ParamSpec` 的種類落地。
 * - **不追函式呼叫**：產生器把 `node` 傳給別的函式再讀，這裡看不到。
 *   那類會**低報**（判定保守，`build-guardrail` 第 5 步），不會誤報。
 */
import { describe, it, expect } from 'vitest'
import { printReport, loadBaseline, writeBaseline, newItems, assertRatchet } from '../helpers/guardrail'
import { paramReadsByComponent, scanParamReads, templateReads, fallbacksByComponent } from '../helpers/param-reads'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { paramNames, paramSpecs, isSpecified } from '../../src/core/param-spec'
import type { ParamSpec } from '../../src/core/types'

/** componentId → 宣告的參數名 */
const 宣告 = new Map(allCppConcepts().map((c) => [c.conceptId, new Set(paramNames(c.properties))]))

/**
 * componentId → 規格（只含**已規格化**的元件）。
 *
 * ⚠️ 只收 `isSpecified` 的。純名字清單經 `paramSpecs` 會變成
 * `kind: 'literal'` 的假規格——拿假規格去比對預設值，會對著 124 顆亂叫。
 */
const 規格 = new Map<string, ParamSpec[]>(
  allCppConcepts()
    .filter((c) => isSpecified(c.properties))
    .map((c) => [c.conceptId, paramSpecs(c.properties)]),
)

interface Finding {
  componentId: string
  param: string
  方向: '讀了沒宣告' | '宣告了沒人讀' | '預設值說謊'
  where: string
}

function measure(extra: { file: string; source: string }[] = []): Finding[] {
  const reads = paramReadsByComponent(extra)
  const out: Finding[] = []

  for (const [cid, params] of reads) {
    const decl = 宣告.get(cid)
    if (!decl) continue // 不是登錄表裡的元件——那是 audit-component-id-integrity 的事
    for (const [p, wheres] of params) {
      if (!decl.has(p)) out.push({ componentId: cid, param: p, 方向: '讀了沒宣告', where: wheres[0] })
    }
  }

  // ⚠️ **模板也是一種讀取。** 少了這一半，宣告式元件會被冤枉——
  // `cpp_string_find_first_not_of.obj` 就是這樣：它沒有 TS 產生器，
  // 產出走 `"${OBJ}.find_first_not_of(${ARG})"`。
  const fromTemplate = templateReads()
  for (const [cid, decl] of 宣告) {
    const read = reads.get(cid)
    const tpl = fromTemplate.get(cid)
    for (const p of decl) {
      if (read?.has(p) || tpl?.has(p)) continue
      out.push({ componentId: cid, param: p, 方向: '宣告了沒人讀', where: '（無）' })
    }
  }

  // ─── 第三個方向：**宣告的 `default` 與產生器的退路不符** ───
  //
  // 這一段只有在參數規格化之後才可能存在——純名字清單裡沒有 `default` 可比。
  // 它就是 SC-004 要的「消費者會叫」：規格不是寫給人看的裝飾，
  // 寫錯一個字，這裡會指名。
  const fallbacks = fallbacksByComponent(extra)
  for (const [cid, specs] of 規格) {
    const fb = fallbacks.get(cid)
    if (!fb) continue
    for (const sp of specs) {
      const actual = fb.get(sp.name)
      if (!actual || actual.length === 0) continue
      const 不符 = actual.filter((a) => a.value !== sp.default)
      for (const a of 不符) {
        out.push({
          componentId: cid,
          param: sp.name,
          方向: '預設值說謊',
          where: `宣告 default=${JSON.stringify(sp.default)}，而 ${a.where} 退路是 ${JSON.stringify(a.value)}`,
        })
      }
    }
  }

  return out.sort((a, b) => a.componentId.localeCompare(b.componentId) || a.param.localeCompare(b.param))
}

// ─── 自我驗證 ─────────────────────────────────────────────────────

describe('自我驗證：這條護欄的判準是準的', () => {
  const reads = paramReadsByComponent()
  const 讀了 = (c: string, p: string): boolean => reads.get(c)?.has(p) ?? false

  it('★ 已知答案的樣本——**答案是查過的，不是記得的**', () => {
    // ⚠️ 這一支是整條護欄的錨點。判準改過三次，三種不同的錯法，
    // 而每一次抓到它的都是這五個樣本：
    //
    //   1. 正則切區塊     → `print.value` 其實屬於 `cpp_define`
    //   2. AST 但不綁參數  → `print.value` 其實是子節點 `v.properties.value`
    //   3. AST ＋ 綁參數   → 全過
    //
    // 而 `cpp_include.local` 那一筆是**我的期望答案錯了**（我以為有人讀它，
    // 查了之後沒有）——`build-guardrail` 第 6 步說「先在已知答案上驗」，
    // 這一輪補上它沒說出來的前提：**那個答案必須是查過的**。
    const 樣本: [string, string, boolean, string][] = [
      ['var_declare', 'init_style', true, 'core/generators/declarations.ts:30 用它分支'],
      ['array_declare', 'size', true, 'interpreter/executors/arrays.ts:16 讀它'],
      ['cpp_define', 'value', true, 'core/generators/statements.ts:248，真的是自己的'],
      ['print', 'value', false, '那一行是子節點的 value（values.map(v => v.properties.value)）'],
      ['cpp_include', 'local', false, '沒有任何程式碼讀它——實例帶著它，而它是死資料'],
    ]
    for (const [cid, p, exp, why] of 樣本) {
      expect(讀了(cid, p), `${cid}.${p} 應為「${exp ? '讀了' : '沒讀'}」——${why}`).toBe(exp)
    }
  })

  it('★ 注入：合成一個讀了未宣告參數的產生器 → **必須被報出**', () => {
    const hit = measure([
      {
        file: '合成/讀了沒宣告.ts',
        source: "g.set('var_declare', (node, ctx) => node.properties.__合成_沒宣告__)\n",
      },
    ]).filter((f) => f.param === '__合成_沒宣告__')
    expect(hit, '合成的違規沒有被報出來 → **護欄壞了**').toHaveLength(1)
    expect(hit[0].方向).toBe('讀了沒宣告')
    expect(hit[0].where, 'FR-002：只說有幾筆修不了，要指名檔案行號').toContain('合成/讀了沒宣告.ts:1')
  })

  it('★ 反向：合成一個讀了**已宣告**參數的產生器 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    const hit = measure([
      { file: '合成/正確.ts', source: "g.set('var_declare', (node, ctx) => node.properties.name)\n" },
    ]).filter((f) => f.componentId === 'var_declare' && f.param === 'name' && f.方向 === '讀了沒宣告')
    expect(hit, '一個已宣告的參數被報成違規 → 這條護欄會亂叫').toEqual([])
  })

  it('★ 反向：**子節點**的屬性讀取不得算給父元件', () => {
    // 這是判準第二版的錯法，值得一支專屬的迴歸釘。
    const hit = measure([
      {
        file: '合成/子節點.ts',
        source:
          "g.set('var_declare', (node, ctx) => (node.children.values ?? []).map(v => v.properties.__子節點的__))\n",
      },
    ]).filter((f) => f.param === '__子節點的__')
    expect(hit, '子節點的參數被算給父元件——那正是 print.value 那筆假報的成因').toEqual([])
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(scanParamReads().length, '零筆讀取 → 是掃描壞了，不是沒有人讀參數').toBeGreaterThan(100)
    expect(宣告.size, '登錄表是空的 → 每一顆都會被誤報').toBeGreaterThan(150)
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('參數規格與實際使用的一致性', () => {
  const findings = measure()
  const 讀了沒宣告 = findings.filter((f) => f.方向 === '讀了沒宣告')
  const 宣告了沒人讀 = findings.filter((f) => f.方向 === '宣告了沒人讀')
  const 預設值說謊 = findings.filter((f) => f.方向 === '預設值說謊')

  it('報表', () => {
    printReport('參數規格一致性', [
      `元件 ${宣告.size}（已規格化 ${規格.size}）｜讀了沒宣告 ${讀了沒宣告.length}｜` +
        `宣告了沒人讀 ${宣告了沒人讀.length}｜預設值說謊 ${預設值說謊.length}`,
      '',
      ...(預設值說謊.length
        ? ['**預設值說謊**（規格與產生器退路不符——改其中一邊）：', ...預設值說謊.map((f) => `  ⚠️ ${f.componentId}.${f.param}  ${f.where}`), '']
        : []),
      '**讀了沒宣告**（規格不完整——補宣告）：',
      ...讀了沒宣告.map((f) => `  ⚠️ ${f.componentId}.${f.param}  ${f.where}`),
      '',
      '**宣告了沒人讀**（殘骸或機制沒接上——刪，或說明它為誰而存在）：',
      ...宣告了沒人讀.slice(0, 30).map((f) => `     ${f.componentId}.${f.param}`),
      宣告了沒人讀.length > 30 ? `     …還有 ${宣告了沒人讀.length - 30} 筆` : '',
    ])
    expect(true).toBe(true)
  })

  it('★ 棘輪：讀了沒宣告只准下降，上升時指名', () => {
    // ⚠️ **我先前把這條判成「硬性零」，那是錯的。**
    //
    // 硬性零的前提是「修法便宜」。而我實際去修的時候發現：
    // **`properties` 不是描述，是驅動抽取的資料**——`PatternExtractor` 的
    // `deriveRenderMapping` 拿它去比對積木欄位名（`findMatchingProperty`）。
    //
    // 所以「把宣告改成符合實際」**會改變行為**。我改了 `input` 的參數列，
    // 來回轉換當場紅（`input → arithmetic, var_ref`）；刪了 `cpp_increment`
    // 看似死掉的大寫退路，來回轉換也紅——那個退路是抽取器餵的。
    //
    // → 這是 `build-guardrail` 第 6.8 步的判準在真實情境下的第二種答案：
    //   **「留一筆還成立嗎」要問的是規範，而「用棘輪還是硬性零」要看修法的代價。**
    //   大量既有違規 ＋ 每一筆修法都要驗行為 = 棘輪，慢慢還。
    const current = { guard: 'param-spec', 讀了沒宣告 }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('param-spec', current)
      return
    }
    const base = loadBaseline<typeof current>('param-spec')
    const added = newItems(讀了沒宣告, base.讀了沒宣告, (f) => `${f.componentId}.${f.param}`)
    expect(
      added.map((f) => `${f.componentId}.${f.param}  ${f.where}`),
      '新增了「程式碼讀了規格裡沒有的參數」——規格更不完整了。',
    ).toEqual([])
    assertRatchet([['讀了沒宣告', 讀了沒宣告.length, base.讀了沒宣告.length]])
  })

  it('★ 已規格化的元件：宣告的 default 不得與產生器退路不符 = 0', () => {
    // ⚠️ **硬性零，而且範圍只在已規格化的元件上**——這是 6.8 步的判準：
    // 這條規範「留一筆還成立嗎」→ 不成立（一筆說謊的預設值就是一顆會誤導人的規格），
    // 而「修法貴不貴」→ 不貴（規格是這一輪自己寫的，寫錯就改）。
    //
    // 範圍限定讓它可以是硬性零：124 顆未規格化的不在裡面，不會逼出棘輪。
    // 規格化推進到哪，這條就守到哪。
    expect(
      預設值說謊.map((f) => `${f.componentId}.${f.param}｜${f.where}`),
      '規格宣告的預設值與程式碼實際的退路不一樣——規格在說謊。',
    ).toEqual([])
  })
})
