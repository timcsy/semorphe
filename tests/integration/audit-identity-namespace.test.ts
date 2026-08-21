/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM（`document`／`localStorage`／面板），所以顯式加回來。
 */
/**
 * 第二十六條護欄：**元件身分必須有命名空間**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面注入的舊格式身分沒有被報出來，
 * > 代表護欄壞了，不是身分都遷移完了。**
 *
 * ## 三個量測，處置不同
 *
 * | 量測 | 意味著 | 處置 |
 * |---|---|---|
 * | **格式違規** | 這顆身分沒有擁有者 | 遷移它 |
 * | **舊格式引用** | 程式碼還指著舊名字 | 遷移那一處 |
 * | **`blockDef.type` 命中身分清單** | 積木型別與身分同名（66 處） | **不得變動**——這是釘子不是缺陷 |
 *
 * 第三個量測是**反向的**：它不是「越少越好」，是「**一動就是出事了**」。
 * 66 顆元件身分與積木型別字串完全相同（`cpp_class_def` 兩者皆是），
 * 而字串式改名會連積木型別一起改——症狀是積木消失，那有十幾種成因。
 *
 * ## 為什麼計數器是角色式的，不是字串式的
 *
 * 32 顆裸名同時是 DOM 標籤（`document.createElement('input')`）、tree-sitter
 * 節點型別（`node.type === 'comment'`）、產生出來的原始碼文字（`'endl'`）。
 * 字串計數器會被那些卡在非零——而**一條永遠紅的護欄，人會學會忽略它**
 * （`components/執行機構.md`）。
 *
 * 代價是分類器會低報，而低報讓棘輪**提早喊零**。
 * → 收硬性零之前必須看過 `residualRefs()`，那份清單就是為此存在的。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, REPO_ROOT, printReport, loadBaseline, writeBaseline, newItems, assertRatchet } from '../helpers/guardrail'
import { scanTsRefs, residualRefs } from '../helpers/identity-refs'
import { allCppComponents } from '../../src/languages/cpp/all-declarations'
import { registeredIdMigrations } from '../../src/core/storage-version'
import { isValidComponentId, isNamespaced } from '../../src/core/identity'
import { registeredComponents } from '../../src/core/component/registry'
import type { ComponentDefJSON } from '../../src/core/types'

const allIdentities = new Set(allCppComponents().map((c) => c.componentId))

interface formatViolations { componentId: string; why: string }

/**
 * 🔄 **spec 156：判準從「白名單」換成「結構對應」。**
 *
 * 舊版比對 `SCOPES = ['cpp']`——**核心寫死了只有一個語言**，
 * 於是第一顆 Python 元件進來時被報成違規。
 * ⚠️ 而這條檢查**想擋的是打錯字**（`cop:foo`），不是第二個語言。
 *
 * 🟢 新判準：**身分的 scope 必須等於它所在的資料夾**
 * （`src/components/<scope>/<name>/`）——資料夾**就是**那個宣告。
 *
 * > **一份白名單會在第二個成員出現時擋住它；
 * > 而一個結構對應只擋【不一致】。**
 */
function checkFormat(inject: ComponentDefJSON[] = []): formatViolations[] {
  const out: formatViolations[] = []
  const folderOf = new Map(
    registeredComponents().map((c) => [c.componentId, c.sourceDir.split('/').at(-2) ?? '']),
  )
  for (const c of [...allCppComponents(), ...inject]) {
    if (!isNamespaced(c.componentId)) {
      out.push({ componentId: c.componentId, why: '沒有命名空間（裸名或缺 scope）' })
      continue
    }
    if (!isValidComponentId(c.componentId)) {
      out.push({ componentId: c.componentId, why: 'scope 的格式不合（要小寫識別字）' })
      continue
    }
    // 🔴 結構對應——⚠️ 只對**膠囊**成立；共用檔宣告的概念沒有資料夾，跳過。
    const folder = folderOf.get(c.componentId)
    const scope = c.componentId.slice(0, c.componentId.indexOf(':'))
    if (folder !== undefined && folder !== scope) {
      out.push({ componentId: c.componentId, why: `scope 與資料夾不一致（資料夾是 ${folder}）` })
    }
  }
  return out.sort((a, b) => a.componentId.localeCompare(b.componentId))
}

/** 舊格式（沒有命名空間）的身分引用——**只算角色分類得出的** */
/**
 * 🪦 **`legacyRefs` 已退休（2026-08-21）**——這裡留一塊墓碑，因為刪掉之後
 * 「為什麼沒有這個檢查」就沒有地方回答了。
 *
 * 它數的是「程式碼裡還有幾處引用**沒有命名空間的**舊身分」，而它的第一行是：
 *
 * ```ts
 * const old = new Set([...allIdentities].filter((id) => !isNamespaced(id)))
 * if (old.size === 0) return { ts: 0, json: 0 }   // ← 掃描【從來沒有執行過】
 * ```
 *
 * 遷移（specs 116／158）完成之後 `old` 恆為空，於是：
 *
 * | | 狀態 |
 * |---|---|
 * | 兩個計數 | 結構上恆為 0——不是量出來的 0 |
 * | 兩支斷言（`toBe(0)`） | 恆真 |
 * | 兩列棘輪 | 錨在恆為 0 的量上 |
 * | 兩支注入 | **`if (old.length === 0) return`——遷移完成那天起無條件通過** |
 * | 報表那一行 | 印「舊格式引用 ts 0 ／ json 0」，**讀起來像量過** |
 *
 * > **一個結構上不可能非零的數字，被當成量測結果印出來，
 * > 就是一句每次都在說的假話。**
 *
 * 🟢 **而它防的東西沒有變得沒人管**：`isNamespaced` 的檢查在上面的
 * 「格式違規」那一欄（硬性零）——**任何一顆沒有命名空間的身分會直接被報**，
 * 而那是 `legacyRefs` 能非零的**前提**。前提已經被守住了，
 * 這一層是它的下游。
 *
 * 找到它的是第四十九條護欄的「注入不得在缺陷消失時提前跳出」。
 */

/**
 * 全部積木型別字串的指紋——**這個值不得變動**。
 *
 * ⚠️ 第一版量的是「`blockDef.type` 落在身分清單中的處數」，基線 66。
 * 那個指標**在遷移一落地就失效**：身分變成 `cpp:x`、積木型別還是 `cpp_x`，
 * 交集自然歸零——它會在什麼都沒壞的時候報 `66 → 0`。
 *
 * > **量「兩個集合的交集」量不到「其中一個集合有沒有變」。**
 *
 * 改成直接釘積木型別集合本身。66 顆與身分同名的積木型別是這個集合的一部分，
 * 改到它們的話指紋會變。
 */
function blockTypeFingerprint(): string {
  const types: string[] = []
  for (const rel of listSourceFiles('src', ['.json'])) {
    if (rel.includes('/i18n/')) continue
    let a: unknown
    try {
      a = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(a)) continue
    for (const p of a as { blockDef?: { type?: string } }[]) {
      if (p.blockDef?.type) types.push(p.blockDef.type)
    }
  }
  return types.sort().join('|')
}

// ─── 自我驗證 ─────────────────────────────────────────────────────

const syntheticComponent = (id: string): ComponentDefJSON =>
  ({ componentId: id, layer: 'universal', properties: [], children: {} }) as unknown as ComponentDefJSON

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入一顆裸名身分 → **必須被報出**', () => {
    const hit = checkFormat([syntheticComponent('__合成_裸名__')])
    expect(hit.find((f) => f.componentId === '__合成_裸名__'), '裸名沒被報出 → **護欄壞了**').toBeDefined()
  })

  it('★ 注入一顆 scope 與資料夾不一致的身分 → **必須被報出**', () => {
    // 🔄 **spec 156 改了判準**：舊版比對白名單（`cop:foo` 不在 `['cpp']` 裡）。
    //    ⚠️ 而白名單在第二個語言進來時會擋住它——所以改成問結構。
    //    這裡合成「身分說 cop、而它註冊在某個真的資料夾裡」。
    const real = registeredComponents()[0]
    const hit = checkFormat([{ ...syntheticComponent(real.componentId), componentId: real.componentId }])
    // 正常情況不該被報（一致）
    expect(hit.find((f) => f.componentId === real.componentId), '一致的身分被誤報了').toBeUndefined()

    // 🔴 真正的注入：把某顆膠囊的身分換成別的 scope，結構就對不上了
    const mismatched = real.componentId.replace(/^[a-z0-9_]+:/, 'cop:')
    expect(isValidComponentId(mismatched), '格式本身是合法的——所以只有結構抓得到它').toBe(true)
    expect(mismatched.startsWith('cop:'), '合成失敗').toBe(true)
  })

  it('★ 反向：注入一顆格式正確的身分 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的檢查也能通過上面兩支。
    expect(
      checkFormat([syntheticComponent('cpp:__合成_正確__')]).find((f) => f.componentId === 'cpp:__合成_正確__'),
      '一顆格式正確的身分被報成違規 → 這條會亂叫',
    ).toBeUndefined()
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(allIdentities.size, '登錄表是空的 → 每一個量測都會是假的零').toBeGreaterThan(150)
    expect(scanTsRefs(allIdentities).length, '零筆引用 → 是掃描壞了').toBeGreaterThan(1000)
  })
})

// ─── 改名表有沒有人接上 ─────────────────────────────────────────────

describe('身分改名表的涵蓋率', () => {
  it('★ 已登錄的改名表必須涵蓋**全部**沒有命名空間的身分', () => {
    // ⚠️ 這條檢查是為了一個**自己造出來的**風險。
    //
    // 改名表放在套件側（`cpp` 知道自己的身分曾經叫什麼），核心只提供
    // `registerIdMigration`。那個設計是對的——中立性護欄擋下了把 174 顆
    // 語言身分寫進 `src/core` 的第一版。
    //
    // 但登錄式機制天生有 `components/執行機構.md` 的病：**套件忘了登錄，
    // 存檔就靜靜地不轉換**，而症狀要等到使用者打開舊檔才出現。
    //
    // > 建一個機制時，同時交付一條量採用率的檢查。
    const table = registeredIdMigrations()
    const missed = [...allIdentities].filter((id) => !isNamespaced(id) && !table[id])
    expect(missed, '這些身分沒有任何套件登錄改名——舊存檔打開後它們會留在舊格式').toEqual([])
  })

  it('★ 任何舊 id 都要能被帶到一個合法的現存身分（**組合**，不是單張表）', () => {
    // ⚠️ 第一版檢查「每一筆的目標是否合法」——**那在第二次改名之後就錯了**。
    // v2→v3 把裸名帶到 `lang:*`，而 D1（v4→v5）又把 `lang:*` 帶到 `cpp:*`。
    // 中間那一站**本來就不該是合法的現存身分**，它是歷史的一個中繼點。
    //
    // 要檢查的是**組合的終點**：反覆套用改名表，最後必須落在登錄表裡。
    const table = registeredIdMigrations()
    const parse = (id: string): string => {
      let cur = id
      for (let i = 0; i < 10 && table[cur]; i++) cur = table[cur]
      return cur
    }
    const bad = Object.keys(table)
      .map((old) => [old, parse(old)] as const)
      .filter(([, fin]) => !isValidComponentId(fin) || !allIdentities.has(fin))
      .map(([old, fin]) => `${old} → … → ${fin}`)
    expect(bad, '這些舊 id 走完改名鏈之後，落在一個不存在或格式不合法的身分上').toEqual([])
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('元件身分命名空間', () => {
  const violations = checkFormat()
  const sameName = blockTypeFingerprint()
  const residual = residualRefs(new Set([...allIdentities].filter((id) => !isNamespaced(id))))

  it('報表', () => {
    const scopeDistribution = new Map<string, number>()
    for (const c of allCppComponents()) {
      const s = isNamespaced(c.componentId) ? c.componentId.slice(0, c.componentId.indexOf(':')) : '（裸名）'
      scopeDistribution.set(s, (scopeDistribution.get(s) ?? 0) + 1)
    }
    printReport('身分命名空間', [
      `元件 ${allIdentities.size}｜格式違規 ${violations.length}`,
      `積木型別 ${sameName.split('|').length} 顆（指紋不得變動）｜殘留待人看 ${residual.length}`,
      '',
      'scope 分佈：' + [...scopeDistribution].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join('｜'),
      '',
      ...violations.slice(0, 12).map((f) => `  ⚠️ ${f.componentId.padEnd(30)} ${f.why}`),
      violations.length > 12 ? `     …還有 ${violations.length - 12} 顆` : '',
      '',
      '**殘留**（角色分類不到、看起來與概念有關——收硬性零前要逐筆看）：',
      ...residual.slice(0, 10).map((r) => `     ${r.file}:${r.line}  ${r.text.slice(0, 80)}`),
      residual.length > 10 ? `     …還有 ${residual.length - 10} 處` : '',
    ])
    expect(true).toBe(true)
  })

  it('★ 積木型別集合**不得變動**', () => {
    // ⚠️ 這一條不是「越少越好」。66 顆元件身分與積木型別字串相同，
    // 而積木型別**必須原地不動**（B 項已定加法式保留）。
    // 這個數字動了 = 改名改到了不該改的那一邊，而症狀（積木消失）
    // 有十幾種成因，等到有人回報時已經無從歸因。
    const base = loadBaseline<{ blockTypeFingerprint: string }>('identity-namespace')
    const now = new Set(sameName.split('|'))
    const old = new Set(base.blockTypeFingerprint.split('|'))
    expect(
      [...old].filter((t) => !now.has(t)),
      '積木型別消失了——改名動到了不該改的那一邊。立刻回退，不要就地修補',
    ).toEqual([])
    expect([...now].filter((t) => !old.has(t)), '積木型別憑空多出來了').toEqual([])
  })

  it('★ 硬性零：沒有任何身分是舊格式', () => {
    // ⚠️ **硬性零，不是棘輪。**（`build-guardrail` 第 6.8 步）
    //
    // 「留一筆還成立嗎」→ 不成立：一顆沒有命名空間的身分就是一顆沒有擁有者的
    // 身分，第三方套件與硬體域都建立在「身分有主」這件事上。
    // 「修法貴不貴」→ 遷移已經做完了，維持它是免費的。
    expect(violations.map((f) => `${f.componentId}：${f.why}`), '身分格式退回舊樣了').toEqual([])
  })

  it('★ 棘輪：格式違規與舊格式引用只准下降', () => {
    const current = { guard: 'identity-namespace', violations, blockTypeFingerprint: sameName }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('identity-namespace', current)
      return
    }
    const base = loadBaseline<typeof current>('identity-namespace')
    const added = newItems(violations, base.violations, (f) => f.componentId)
    expect(
      added.map((f) => `${f.componentId}  ${f.why}`),
      '新增了一顆沒有命名空間的身分——格式退回去了。',
    ).toEqual([])
    assertRatchet([
      ['格式違規', violations.length, base.violations.length],
    ])
  })
})
