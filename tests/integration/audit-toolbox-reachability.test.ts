/**
 * 第十九條護欄：**使用者拿不拿得到**
 *
 * ## 自我否證聲明（⚠️ 這一段寫在量測邏輯之前，不是事後補的）
 *
 * > **如果這條護欄回報零違規，而下面那兩支合成注入——一顆「沒有任何分類收它」
 * > 的積木沒有被報出、或一顆「有分類收它」的積木被報出——任一支失敗，
 * > 代表護欄壞了，不是工具箱完整。**
 *
 * 錨點刻意挑**合成的輸入**，不挑真實世界的狀態。同一個 session 裡錨點爛掉五次，
 * 最近一次是錨在「身分健檢的『確定』桶非空」上，然後 B 項把那個桶修到零——
 * 那句聲明於是變成叫未來的讀者不要相信一個正確的結果。
 *
 * > **護欄修好了它要量的東西，就是它的錨點爛掉的時候。**
 *
 * 合成規則不隨真實世界的修復而失效。
 *
 * ## 為什麼需要這一條
 *
 * 既有的十八條全部在量「做得出來」——五路完備、就近性、中立性、身分健檢。
 * **沒有一條在量「拿得到」。**
 *
 * 097 做完多形態、全套綠、十七條護欄零上升之後，使用者拖了一次積木，
 * 第一句話是「這樣會不會讓學生困擾找不到積木？」。會——變體做出來了，
 * 而工具箱裡沒有。
 *
 * 動工前實測：**183 顆積木，7 顆使用者拿不到**，其中兩顆是同一個 session 加的，
 * 而其中一顆是在寫完「機制做對了，而使用者拿不到它」那條教訓**之後**加的。
 *
 * > 一條教訓寫進知識庫，不會讓下一次不發生。**只有機械檢查會。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「放對分類」**——它只保證「在某個分類裡」。把 `cpp_sort` 放進
 *   「程式設定」它照樣綠。放對分類要人看。
 * - **不檢測積木好不好用**——標籤看不看得懂、預設值合不合理，都不在範圍。
 * - **不檢測課程有沒有收錄**——那是策展，見 `audit-curriculum-coverage`。
 *
 * ## 明確排除是怎麼判的（不是一份手寫清單）
 *
 * | 排除 | 判準 | 誰宣告的 |
 * |---|---|---|
 * | 中性形態 | 兄弟形態所在那條軸的 `from` 是 `property`，而這一顆沒有 `form` | 積木自己（097） |
 * | 分類排除 | 出現在某個分類的 `excludeTypes` | 分類定義 |
 *
 * 兩種都**推導得出來**。「忘了加進清單」推導不出來——那正是要抓的東西。
 *
 * ⚠️ 中性形態的判準**不是**「有沒有宣告 `form`」。`role` 軸上沒宣告 `form` 的
 * 那一顆是**敘述版**——位置永遠取得到，那條軸不需要退路。把它一律當退路排掉，
 * 會讓 `u_var_declare`／`u_input`／`u_func_call` 等最常用的積木從工具箱消失。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadToolbox } from '../helpers/toolbox'
import { isTypeLookupFallback } from '../../src/ui/toolbox-builder'
import { loadBaseline, writeBaseline, printReport, newItems, assertRatchet, REPO_ROOT } from '../helpers/guardrail'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'

type Bucket = '缺陷' | '中性形態' | '分類排除'
interface Finding {
  type: string
  owner: string
  bucket: Bucket
}

const GENERATE = process.env.GENERATE_BASELINE === '1'

/** 所有分類明確宣告的排除——**這是宣告，不是清單** */
const declaredExcludes = new Set(cppCategoryDefs.flatMap((d) => d.excludeTypes ?? []))

/**
 * 命令式註冊器裡的積木型別（`Blockly.Blocks['x'] = {…}`）。
 *
 * 用原始碼掃的，不是手寫清單——手寫的話它會與 `block-registrar.ts` 漂移，
 * 而漂移的方向剛好是「愈來愈寬鬆」（有人加了新的命令式積木，清單沒跟上，
 * 於是它被誤報成幽靈；或反過來被誤放行）。
 */
const imperativelyRegistered = new Set(
  (
    fs
      .readFileSync(path.join(REPO_ROOT, 'src/ui/block-registrar.ts'), 'utf8')
      .match(/Blockly\.Blocks\['([a-z0-9_]+)'\]/g) ?? []
  ).map((m) => m.replace(/^Blockly\.Blocks\['/, '').replace(/'\]$/, '')),
)

function measure(
  extraConcepts: ConceptDefJSON[] = [],
  extraProjections: BlockProjectionJSON[] = [],
): { findings: Finding[]; ghosts: string[]; imperativeOnly: string[]; total: number; categoriesOf: Map<string, string[]> } {
  const { registry, origins, categoriesOf } = loadToolbox(extraConcepts, extraProjections)

  const findings: Finding[] = []
  for (const { type, owner } of origins) {
    if (categoriesOf.has(type)) continue

    // 判定保守（第 5 步）：判不出來就歸「缺陷」。
    // 為了讓數字好看而樂觀歸類，比沒有護欄更糟。
    const spec = registry.getByBlockType(type)

    // ⚠️ 判準是**軸的 `from`**，不是「有沒有宣告 form」——
    // `role` 軸上沒宣告 form 的那一顆是**敘述版**（一個真正的選項），
    // 不是退路。用同一個函式，不要在這裡重寫一份會漂移的判準。
    const isFallback = Boolean(spec && isTypeLookupFallback(registry, spec))

    findings.push({
      type,
      owner,
      bucket: declaredExcludes.has(type) ? '分類排除' : isFallback ? '中性形態' : '缺陷',
    })
  }

  // 反向：工具箱不得指向幽靈（TB-2）
  //
  // ⚠️ **「不在 JSON 宣告裡」不等於「不存在」。** 第一次跑報了 `u_input_expr`
  // 是幽靈，而它其實活著——只是活在 `block-registrar.ts` 的命令式註冊裡，
  // 登錄表看不見它。那是 MEMORY.md 早就記過的「雙重真相來源」。
  //
  // 這裡刻意**分成兩桶**而不是放過：真的幽靈要硬紅，只在命令式註冊器裡的
  // 要**指名並棘輪**——它不會讓學生拖出壞積木，但它是導出導不到的死角。
  const known = new Set(origins.map((o) => o.type))
  const missing = [...categoriesOf.keys()].filter((t) => !known.has(t))
  const imperativeOnly = missing.filter((t) => imperativelyRegistered.has(t)).sort()
  const ghosts = missing.filter((t) => !imperativelyRegistered.has(t)).sort()

  return {
    findings: findings.sort((a, b) => a.type.localeCompare(b.type)),
    ghosts,
    imperativeOnly,
    total: origins.length,
    categoriesOf,
  }
}

// ─── 合成注入：兩個方向都要釘（第 9 步）─────────────────────────────

const 合成概念 = (id: string): ConceptDefJSON =>
  ({ conceptId: id, category: '__不存在的分類__', properties: {}, children: {} }) as unknown as ConceptDefJSON

const 合成積木 = (id: string, type: string, category: string, owner = '(core)'): BlockProjectionJSON =>
  ({
    conceptId: id,
    category,
    owner,
    blockDef: { type, message0: '合成 %1', args0: [{ type: 'input_value', name: 'A' }] },
    conceptMapping: { conceptId: id },
  }) as unknown as BlockProjectionJSON

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入一顆沒有任何分類收它的積木 → **必須被報成缺陷**', () => {
    const { findings } = measure(
      [合成概念('__合成_拿不到__')],
      [合成積木('__合成_拿不到__', '__合成_拿不到__', '__不存在的分類__')],
    )
    const hit = findings.find((f) => f.type === '__合成_拿不到__')
    expect(hit, '合成的不可拿積木沒有被報出來 → **護欄壞了，不是工具箱完整**').toBeDefined()
    // 釘住**理由**，不只釘結果（第 8 步）：分錯桶但總數對的護欄，
    // 看起來與健康的完全一樣。
    expect(hit!.bucket, '報出來了但歸錯桶——「缺陷」被當成「明確排除」會靜靜地放過它').toBe('缺陷')
  })

  it('★ 注入一顆有分類收它的積木 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    // `(core)/pointers` 是「指標與記憶體」分類的段落之一。
    const { findings } = measure(
      [合成概念('__合成_拿得到__')],
      [合成積木('__合成_拿得到__', '__合成_拿得到__', 'pointers')],
    )
    expect(
      findings.find((f) => f.type === '__合成_拿得到__'),
      '一顆確實出現在分類裡的積木被報成違規 → 這條護欄會亂叫，而亂叫的護欄很快就會被忽略',
    ).toBeUndefined()
  })

  it('★ 中性形態不在工具箱裡，且被歸為「中性形態」不是「缺陷」', () => {
    const { findings, categoriesOf } = measure()
    for (const t of ['c_container_push', 'c_container_pop']) {
      expect(categoriesOf.has(t), `${t} 是型別查不到時的退路，不該讓學生選（097）`).toBe(false)
      expect(
        findings.find((f) => f.type === t)?.bucket,
        '歸成「缺陷」的話，有人會「修好它」——把退路放進工具箱，正是學生回報的那個困惑',
      ).toBe('中性形態')
    }
  })

  it('★ 反向：`role` 軸上沒宣告 form 的**敘述版**不是退路，必須留在工具箱', () => {
    // 沒有這一支的話，「所有沒宣告 form 的都是退路」這個錯誤判準會通過上一支
    // ——而它會讓 u_var_declare／u_input／u_func_call 等七顆最常用的敘述版
    // 積木從工具箱裡消失。實作時真的踩到了。
    const { categoriesOf } = measure()
    for (const t of ['u_var_declare', 'u_input', 'u_func_call', 'cpp_method_call', 'c_increment', 'c_scanf']) {
      expect(categoriesOf.has(t), `${t} 是敘述版，位置永遠取得到，它不需要也不是退路`).toBe(true)
    }
  })

  it('★ R-3：加一顆元件到既有模組，**不編輯任何清單**，它自己出現', () => {
    // 這是「導出」與「把手寫換個地方」的分界線（FR-003 / P3）。
    const { categoriesOf } = measure(
      [合成概念('__合成_新元件__')],
      [合成積木('__合成_新元件__', '__合成_新元件__', 'containers', '<stack>')],
    )
    expect(
      categoriesOf.get('__合成_新元件__'),
      '一顆宣告在 <stack> 模組裡的新積木沒有自己出現在「堆疊與佇列」——那代表歸屬仍然是手寫的',
    ).toContain('堆疊與佇列')
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    const { total } = measure()
    expect(total, '零顆積木 → 是載入壞了，不是專案空了').toBeGreaterThan(150)
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('可拿性護欄', () => {
  const { findings, ghosts, imperativeOnly, total } = measure()
  const 缺陷 = findings.filter((f) => f.bucket === '缺陷')

  it('報表', () => {
    const byBucket = (b: Bucket): Finding[] => findings.filter((f) => f.bucket === b)
    printReport('工具箱可拿性', [
      `積木 ${total}｜可拿到 ${total - findings.length}｜拿不到 ${findings.length}`,
      '',
      `  缺陷（忘了加進工具箱）      ${byBucket('缺陷').length}`,
      `  中性形態（刻意，097）        ${byBucket('中性形態').length}`,
      `  分類排除（excludeTypes）     ${byBucket('分類排除').length}`,
      '',
      ...findings.map((f) => `  ${f.bucket === '缺陷' ? '⚠️' : '  '} ${f.bucket}  ${f.owner} ${f.type}`),
      '',
      `  幽靈（工具箱指向根本不存在的積木）  ${ghosts.length}${ghosts.length ? '：' + ghosts.join(', ') : ''}`,
      `  只在命令式註冊器裡（導出導不到）    ${imperativeOnly.length}${imperativeOnly.length ? '：' + imperativeOnly.join(', ') : ''}`,
    ])
    expect(true).toBe(true)
  })

  it('★ 工具箱不得指向不存在的積木型別（TB-2）', () => {
    expect(ghosts, '刪掉一顆元件而忘了清理清單 → 使用者拖出一顆壞掉的積木').toEqual([])
  })

  it('★ 棘輪：缺陷與命令式死角只准下降，上升時指名', () => {
    const current = { guard: 'toolbox-reachability', 缺陷, imperativeOnly, findings }
    if (GENERATE) {
      writeBaseline('toolbox-reachability', current)
      return
    }
    const base = loadBaseline<typeof current>('toolbox-reachability')
    const added = newItems(缺陷, base.缺陷, (f) => f.type)
    expect(added.map((f) => `${f.owner} ${f.type}`), '新增了拿不到的積木').toEqual([])
    expect(
      newItems(imperativeOnly, base.imperativeOnly ?? [], (t) => t),
      '新增了只在命令式註冊器裡的積木——登錄表看不見它，導出也導不到它',
    ).toEqual([])
    assertRatchet([
      ['缺陷', 缺陷.length, base.缺陷.length],
      ['命令式死角', imperativeOnly.length, (base.imperativeOnly ?? []).length],
    ])
  })
})
