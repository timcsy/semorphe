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
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { paramNames, paramSpecs, isSpecified } from '../../src/core/param-spec'
import type { ParamSpec } from '../../src/core/types'

/** componentId → 宣告的參數名 */
const declare = new Map(allCppConcepts().map((c) => [c.conceptId, new Set(paramNames(c.properties))]))

/**
 * componentId → 規格（只含**已規格化**的元件）。
 *
 * ⚠️ 只收 `isSpecified` 的。純名字清單經 `paramSpecs` 會變成
 * `kind: 'literal'` 的假規格——拿假規格去比對預設值，會對著 124 顆亂叫。
 */
const spec = new Map<string, ParamSpec[]>(
  allCppConcepts()
    .filter((c) => isSpecified(c.properties))
    .map((c) => [c.conceptId, paramSpecs(c.properties)]),
)

interface Finding {
  componentId: string
  param: string
  direction: '讀了沒宣告' | '宣告了沒人讀' | '預設值說謊' | '退路自相矛盾'
  where: string
}

function measure(extra: { file: string; source: string }[] = []): Finding[] {
  const reads = paramReadsByComponent(extra)
  const out: Finding[] = []

  for (const [cid, params] of reads) {
    const decl = declare.get(cid)
    if (!decl) continue // 不是登錄表裡的元件——那是 audit-component-id-integrity 的事
    for (const [p, wheres] of params) {
      if (!decl.has(p)) out.push({ componentId: cid, param: p, direction: '讀了沒宣告', where: wheres[0] })
    }
  }

  // ⚠️ **模板也是一種讀取。** 少了這一半，宣告式元件會被冤枉——
  // `cpp_string_find_first_not_of.obj` 就是這樣：它沒有 TS 產生器，
  // 產出走 `"${OBJ}.find_first_not_of(${ARG})"`。
  const fromTemplate = templateReads()
  for (const [cid, decl] of declare) {
    const read = reads.get(cid)
    const tpl = fromTemplate.get(cid)
    for (const p of decl) {
      if (read?.has(p) || tpl?.has(p)) continue
      out.push({ componentId: cid, param: p, direction: '宣告了沒人讀', where: '（無）' })
    }
  }

  // ─── 第三個方向：**宣告的 `default` 與產生器的退路不符** ───
  //
  // 這一段只有在參數規格化之後才可能存在——純名字清單裡沒有 `default` 可比。
  // 它就是 SC-004 要的「消費者會叫」：規格不是寫給人看的裝飾，
  // 寫錯一個字，這裡會指名。
  const fallbacks = fallbacksByComponent(extra)
  for (const [cid, specs] of spec) {
    const fb = fallbacks.get(cid)
    if (!fb) continue
    for (const sp of specs) {
      const actual = fb.get(sp.name)
      if (!actual || actual.length === 0) continue
      const distinct = [...new Set(actual.map((a) => a.value))]

      // ⚠️ **程式碼自己就有兩個不同的退路** —— 那不是「宣告寫錯」，
      // 是那個值根本沒有共識。實測 `cpp_define.name`：產生器 `?? 'MACRO'`、
      // 執行器 `?? ''`，而後者是**守衛**（缺名字就不定義巨集），
      // 「對齊」成 MACRO 會憑空定義一個巨集——兩邊都不該動。
      //
      // 這種情形宣告 `required: true` 不宣告 `default`，而這裡照樣報出來：
      // 它是真實的分歧，只是處置不是改宣告。**棘輪，不是硬性零。**
      if (distinct.length > 1) {
        if (sp.default === undefined && sp.required) {
          out.push({
            componentId: cid,
            param: sp.name,
            direction: '退路自相矛盾',
            where: actual.map((a) => `${a.where}→${JSON.stringify(a.value)}`).join('  '),
          })
          continue
        }
      }

      for (const a of actual.filter((x) => x.value !== sp.default)) {
        out.push({
          componentId: cid,
          param: sp.name,
          direction: '預設值說謊',
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
  const read2 = (c: string, p: string): boolean => reads.get(c)?.has(p) ?? false

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
    const samples: [string, string, boolean, string][] = [
      ['cpp:var_declare', 'init_style', true, 'core/generators/declarations.ts:30 用它分支'],
      ['cpp:array_declare', 'size', true, 'interpreter/executors/arrays.ts:16 讀它'],
      ['cpp:define', 'value', true, 'core/generators/statements.ts:248，真的是自己的'],
      ['cpp:print', 'value', false, '那一行是子節點的 value（values.map(v => v.properties.value)）'],
      ['cpp:include', 'local', false, '沒有任何程式碼讀它——實例帶著它，而它是死資料'],
    ]
    for (const [cid, p, exp, why] of samples) {
      expect(read2(cid, p), `${cid}.${p} 應為「${exp ? '讀了' : '沒讀'}」——${why}`).toBe(exp)
    }
  })

  it('★ 注入：合成一個讀了未宣告參數的產生器 → **必須被報出**', () => {
    const hit = measure([
      {
        file: '合成/讀了沒宣告.ts',
        source: "g.set('cpp:var_declare', (node, ctx) => node.properties.__合成_沒宣告__)\n",
      },
    ]).filter((f) => f.param === '__合成_沒宣告__')
    expect(hit, '合成的違規沒有被報出來 → **護欄壞了**').toHaveLength(1)
    expect(hit[0].direction).toBe('讀了沒宣告')
    expect(hit[0].where, 'FR-002：只說有幾筆修不了，要指名檔案行號').toContain('合成/讀了沒宣告.ts:1')
  })

  it('★ 反向：合成一個讀了**已宣告**參數的產生器 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    const hit = measure([
      { file: '合成/正確.ts', source: "g.set('cpp:var_declare', (node, ctx) => node.properties.name)\n" },
    ]).filter((f) => f.componentId === 'cpp:var_declare' && f.param === 'name' && f.direction === '讀了沒宣告')
    expect(hit, '一個已宣告的參數被報成違規 → 這條護欄會亂叫').toEqual([])
  })

  it('★ 反向：**子節點**的屬性讀取不得算給父元件', () => {
    // 這是判準第二版的錯法，值得一支專屬的迴歸釘。
    const hit = measure([
      {
        file: '合成/子節點.ts',
        source:
          "g.set('cpp:var_declare', (node, ctx) => (node.children.values ?? []).map(v => v.properties.__子節點的__))\n",
      },
    ]).filter((f) => f.param === '__子節點的__')
    expect(hit, '子節點的參數被算給父元件——那正是 print.value 那筆假報的成因').toEqual([])
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(scanParamReads().length, '零筆讀取 → 是掃描壞了，不是沒有人讀參數').toBeGreaterThan(100)
    expect(declare.size, '登錄表是空的 → 每一顆都會被誤報').toBeGreaterThan(150)
  })
})

// ─── 規格自身的自洽（規格化之後才可能檢查的三件事）─────────────────

interface specIssues { conceptId: string; issue: string }

/**
 * @param inject 合成的元件宣告，用來自我否證。
 */
function checkSpec(inject: { conceptId: string; properties: ParamSpec[]; blockDef?: unknown }[] = []): specIssues[] {
  const out: specIssues[] = []
  const concepts = [...(allCppConcepts() as unknown as { conceptId: string; properties?: unknown }[]), ...inject]

  // 積木下拉的選項——`values` 的來源真相
  const dropdown = new Map<string, Map<string, string[]>>()
  for (const proj of allCppProjections() as unknown as Record<string, any>[]) {
    const bd = proj.blockDef as Record<string, unknown> | undefined
    const rm = (proj.renderMapping as { fields?: Record<string, string> } | undefined)?.fields ?? {}
    const args: Record<string, unknown>[] = []
    for (let i = 0; i <= 9; i++) if (bd?.[`args${i}`]) args.push(...(bd[`args${i}`] as Record<string, unknown>[]))
    for (const a of args) {
      if (a.type !== 'field_dropdown' || !Array.isArray(a.options)) continue
      const param = rm[String(a.name)]
      if (!param) continue
      const m = dropdown.get(proj.conceptId as string) ?? new Map<string, string[]>()
      m.set(param, (a.options as unknown[][]).map((o) => String(o[1])))
      dropdown.set(proj.conceptId as string, m)
    }
  }

  for (const c of concepts) {
    const raw = c.properties as string[] | ParamSpec[] | undefined
    if (!raw || raw.length === 0) continue

    // ① 有參數就要規格化——否則新元件會靜靜地退回純名字清單
    if (!isSpecified(raw)) {
      out.push({ conceptId: c.conceptId, issue: `參數未規格化（仍是純名字：${paramNames(raw).join('、')}）` })
      continue
    }

    for (const sp of paramSpecs(raw)) {
      // ② enum 必須有 values，且 default 必須在 values 裡
      if (sp.kind === 'enum') {
        if (!sp.values || sp.values.length === 0) {
          out.push({ conceptId: c.conceptId, issue: `${sp.name} 是 enum 卻沒有 values` })
        } else if (sp.default !== undefined && !sp.values.includes(sp.default)) {
          out.push({
            conceptId: c.conceptId,
            issue: `${sp.name} 的 default ${JSON.stringify(sp.default)} 不在自己的 values（${sp.values.join('|')}）裡`,
          })
        }
      }
      // ③ enum 的 values 必須與積木下拉的選項一致——**雙重真相的老病**
      const opts = dropdown.get(c.conceptId)?.get(sp.name)
      if (sp.kind === 'enum' && opts && JSON.stringify(opts) !== JSON.stringify(sp.values ?? [])) {
        out.push({
          conceptId: c.conceptId,
          issue: `${sp.name} 的 values（${(sp.values ?? []).join('|')}）與積木下拉（${opts.join('|')}）不一致`,
        })
      }
    }
  }
  return out
}

describe('規格自身要自洽', () => {
  const synthetic = (properties: ParamSpec[]): { conceptId: string; properties: ParamSpec[] } => ({
    conceptId: '__合成__',
    properties,
  })

  it('★ 注入：default 不在 values 裡 → **必須被報出**', () => {
    // 這不是假想的錯法。`cpp_malloc` 真的長這樣：下拉給 `int|float|double|char`，
    // 而產生器的退路是 `int*`——因為 `type` 在那顆元件裡是**轉型型別**（指標）。
    // 結果使用者從積木選 `int`，產出 `(int)malloc(…)`，不合法的 C++。
    const hit = checkSpec([synthetic([{ name: 'k', kind: 'enum', values: ['a', 'b'], default: 'c' }])])
    expect(hit.filter((x) => x.conceptId === '__合成__')).toHaveLength(1)
  })

  it('★ 注入：enum 沒有 values → **必須被報出**', () => {
    expect(checkSpec([synthetic([{ name: 'k', kind: 'enum' }])]).filter((x) => x.conceptId === '__合成__')).toHaveLength(1)
  })

  it('★ 注入：參數沒規格化（純名字） → **必須被報出**', () => {
    const hit = checkSpec([{ conceptId: '__合成2__', properties: ['just_a_name'] as unknown as ParamSpec[] }])
    expect(hit.filter((x) => x.conceptId === '__合成2__')).toHaveLength(1)
  })

  it('★ 注入：values 與積木下拉不一致 → **必須被報出**', () => {
    // ⚠️ 這一支不能省。第 ③ 條（values 對得上下拉）目前在真實資料上是
    // **由建構保證的綠**——那 29 筆 `values` 本來就是從下拉抄出來的。
    // 「綠」在這裡不代表檢查有效，只代表來源同一份。
    //
    // 用一顆**真的有下拉的元件**（`arithmetic` 的 `operator`）宣告錯的值域，
    // 才證明得了這條有接上。
    const hit = checkSpec([
      { conceptId: 'cpp:arithmetic', properties: [{ name: 'operator', kind: 'enum', values: ['+'], default: '+' }] },
    ]).filter((x) => x.conceptId === 'cpp:arithmetic')
    expect(hit, '值域與積木下拉不一致沒被報出 → 第 ③ 條沒有接上').toHaveLength(1)
    expect(hit[0].issue).toContain('與積木下拉')
  })

  it('★ 反向：一筆完全正確的規格 → **必須不被報出**', () => {
    const ok = checkSpec([synthetic([{ name: 'k', kind: 'enum', values: ['a', 'b'], default: 'a' }])])
    expect(ok.filter((x) => x.conceptId === '__合成__'), '正確的規格被報成問題 → 這條會亂叫').toEqual([])
  })

  it('★ 規格自洽 = 0', () => {
    // 硬性零：規格是這一輪自己寫的，寫錯就改——修法便宜（第 6.8 步）。
    expect(checkSpec().map((x) => `${x.conceptId}：${x.issue}`)).toEqual([])
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('參數規格與實際使用的一致性', () => {
  const findings = measure()
  const readButUndeclared = findings.filter((f) => f.direction === '讀了沒宣告')
  const declaredUnread = findings.filter((f) => f.direction === '宣告了沒人讀')
  const defaultLies = findings.filter((f) => f.direction === '預設值說謊')
  const fallbackContradicts = findings.filter((f) => f.direction === '退路自相矛盾')

  it('報表', () => {
    printReport('參數規格一致性', [
      `元件 ${declare.size}（已規格化 ${spec.size}）｜讀了沒宣告 ${readButUndeclared.length}｜` +
        `宣告了沒人讀 ${declaredUnread.length}｜預設值說謊 ${defaultLies.length}｜` +
        `退路自相矛盾 ${fallbackContradicts.length}`,
      '',
      ...(fallbackContradicts.length
        ? ['**退路自相矛盾**（程式碼自己有兩個缺省——已宣告 required，處置要逐條看）：', ...fallbackContradicts.map((f) => `     ${f.componentId}.${f.param}  ${f.where}`), '']
        : []),
      ...(defaultLies.length
        ? ['**預設值說謊**（規格與產生器退路不符——改其中一邊）：', ...defaultLies.map((f) => `  ⚠️ ${f.componentId}.${f.param}  ${f.where}`), '']
        : []),
      '**讀了沒宣告**（規格不完整——補宣告）：',
      ...readButUndeclared.map((f) => `  ⚠️ ${f.componentId}.${f.param}  ${f.where}`),
      '',
      '**宣告了沒人讀**（殘骸或機制沒接上——刪，或說明它為誰而存在）：',
      ...declaredUnread.slice(0, 30).map((f) => `     ${f.componentId}.${f.param}`),
      declaredUnread.length > 30 ? `     …還有 ${declaredUnread.length - 30} 筆` : '',
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
    const current = { guard: 'param-spec', readButUndeclared, fallbackContradicts }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('param-spec', current)
      return
    }
    const base = loadBaseline<typeof current>('param-spec')
    const added = newItems(readButUndeclared, base.readButUndeclared, (f) => `${f.componentId}.${f.param}`)
    expect(
      added.map((f) => `${f.componentId}.${f.param}  ${f.where}`),
      '新增了「程式碼讀了規格裡沒有的參數」——規格更不完整了。',
    ).toEqual([])
    const added2 = newItems(fallbackContradicts, base.fallbackContradicts ?? [], (f) => `${f.componentId}.${f.param}`)
    expect(
      added2.map((f) => `${f.componentId}.${f.param}  ${f.where}`),
      '新增了「同一個參數在兩處有不同退路」——產生與解讀對缺省的看法不一致。',
    ).toEqual([])
    assertRatchet([
      ['讀了沒宣告', readButUndeclared.length, base.readButUndeclared.length],
      ['退路自相矛盾', fallbackContradicts.length, (base.fallbackContradicts ?? []).length],
    ])
  })

  it('★ 已規格化的元件：宣告的 default 不得與產生器退路不符 = 0', () => {
    // ⚠️ **硬性零，而且範圍只在已規格化的元件上**——這是 6.8 步的判準：
    // 這條規範「留一筆還成立嗎」→ 不成立（一筆說謊的預設值就是一顆會誤導人的規格），
    // 而「修法貴不貴」→ 不貴（規格是這一輪自己寫的，寫錯就改）。
    //
    // 範圍限定讓它可以是硬性零：124 顆未規格化的不在裡面，不會逼出棘輪。
    // 規格化推進到哪，這條就守到哪。
    expect(
      defaultLies.map((f) => `${f.componentId}.${f.param}｜${f.where}`),
      '規格宣告的預設值與程式碼實際的退路不一樣——規格在說謊。',
    ).toEqual([])
  })
})
