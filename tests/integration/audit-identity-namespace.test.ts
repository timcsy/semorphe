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
 * （`concepts/執行機構.md`）。
 *
 * 代價是分類器會低報，而低報讓棘輪**提早喊零**。
 * → 收硬性零之前必須看過 `residualRefs()`，那份清單就是為此存在的。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, REPO_ROOT, printReport, loadBaseline, writeBaseline, newItems, assertRatchet } from '../helpers/guardrail'
import { scanTsRefs, scanJsonRefs, residualRefs } from '../helpers/identity-refs'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { registeredIdMigrations } from '../../src/core/storage-version'
import { isValidComponentId, isNamespaced, SCOPES } from '../../src/core/identity'
import type { ConceptDefJSON } from '../../src/core/types'

const 全部身分 = new Set(allCppConcepts().map((c) => c.conceptId))

interface 格式違規 { conceptId: string; 為何: string }

function 檢格式(注入: ConceptDefJSON[] = []): 格式違規[] {
  const out: 格式違規[] = []
  for (const c of [...allCppConcepts(), ...注入]) {
    if (!isNamespaced(c.conceptId)) {
      out.push({ conceptId: c.conceptId, 為何: '沒有命名空間（裸名或缺 scope）' })
    } else if (!isValidComponentId(c.conceptId)) {
      out.push({ conceptId: c.conceptId, 為何: `scope 不在白名單（${SCOPES.join('｜')}）` })
    }
  }
  return out.sort((a, b) => a.conceptId.localeCompare(b.conceptId))
}

/** 舊格式（沒有命名空間）的身分引用——**只算角色分類得出的** */
function 舊格式引用(extra: { file: string; source: string }[] = []): { ts: number; json: number } {
  const 舊 = new Set([...全部身分].filter((id) => !isNamespaced(id)))
  if (舊.size === 0) return { ts: 0, json: 0 }
  return {
    ts: scanTsRefs(舊, extra).filter((r) => r.role === 'conceptId').length,
    json: scanJsonRefs(舊).filter((r) => r.role === 'conceptId').length,
  }
}

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
function 積木型別指紋(): string {
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

const 合成概念 = (id: string): ConceptDefJSON =>
  ({ conceptId: id, layer: 'universal', properties: [], children: {} }) as unknown as ConceptDefJSON

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入一顆裸名身分 → **必須被報出**', () => {
    const hit = 檢格式([合成概念('__合成_裸名__')])
    expect(hit.find((f) => f.conceptId === '__合成_裸名__'), '裸名沒被報出 → **護欄壞了**').toBeDefined()
  })

  it('★ 注入一顆 scope 不在白名單的身分 → **必須被報出**', () => {
    // 沒有這一支，`cop:foo`（打錯的 `cpp`）會被當成一個合法的新命名空間。
    const hit = 檢格式([合成概念('cop:foo')])
    expect(hit.find((f) => f.conceptId === 'cop:foo')?.為何).toContain('白名單')
  })

  it('★ 反向：注入一顆格式正確的身分 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的檢查也能通過上面兩支。
    expect(
      檢格式([合成概念('cpp:__合成_正確__')]).find((f) => f.conceptId === 'cpp:__合成_正確__'),
      '一顆格式正確的身分被報成違規 → 這條會亂叫',
    ).toBeUndefined()
  })

  it('★ 注入一處舊格式引用 → **必須被計入**', () => {
    const 舊 = [...全部身分].filter((id) => !isNamespaced(id))
    if (舊.length === 0) return // 遷移完成後這一支自然不適用
    const before = 舊格式引用().ts
    const after = 舊格式引用([
      { file: '合成/舊引用.ts', source: `createNode('${舊[0]}', {})\n` },
    ]).ts
    expect(after - before, '合成的舊格式引用沒被計入 → 計數器沒接上').toBe(1)
  })

  it('★ 反向：非身分位置的同名字串 **不得**被計入', () => {
    // 這是整條護欄最重要的一支。`document.createElement('input')` 裡的 `'input'`
    // 與元件身分 `input` 是同一個字串，而它們毫無關係。
    const 舊 = [...全部身分].filter((id) => !isNamespaced(id))
    if (舊.length === 0) return
    const before = 舊格式引用().ts
    const after = 舊格式引用([
      { file: '合成/非身分.ts', source: `document.createElement('${舊[0]}')\nconst x = { type: '${舊[0]}' }\n` },
    ]).ts
    expect(after, 'DOM 呼叫與 blockType 屬性被算成身分引用 → 這條護欄永遠收不到零').toBe(before)
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(全部身分.size, '登錄表是空的 → 每一個量測都會是假的零').toBeGreaterThan(150)
    expect(scanTsRefs(全部身分).length, '零筆引用 → 是掃描壞了').toBeGreaterThan(1000)
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
    // 但登錄式機制天生有 `concepts/執行機構.md` 的病：**套件忘了登錄，
    // 存檔就靜靜地不轉換**，而症狀要等到使用者打開舊檔才出現。
    //
    // > 建一個機制時，同時交付一條量採用率的檢查。
    const 表 = registeredIdMigrations()
    const 漏 = [...全部身分].filter((id) => !isNamespaced(id) && !表[id])
    expect(漏, '這些身分沒有任何套件登錄改名——舊存檔打開後它們會留在舊格式').toEqual([])
  })

  it('★ 任何舊 id 都要能被帶到一個合法的現存身分（**組合**，不是單張表）', () => {
    // ⚠️ 第一版檢查「每一筆的目標是否合法」——**那在第二次改名之後就錯了**。
    // v2→v3 把裸名帶到 `lang:*`，而 D1（v4→v5）又把 `lang:*` 帶到 `cpp:*`。
    // 中間那一站**本來就不該是合法的現存身分**，它是歷史的一個中繼點。
    //
    // 要檢查的是**組合的終點**：反覆套用改名表，最後必須落在登錄表裡。
    const 表 = registeredIdMigrations()
    const 解析 = (id: string): string => {
      let cur = id
      for (let i = 0; i < 10 && 表[cur]; i++) cur = 表[cur]
      return cur
    }
    const 壞 = Object.keys(表)
      .map((old) => [old, 解析(old)] as const)
      .filter(([, fin]) => !isValidComponentId(fin) || !全部身分.has(fin))
      .map(([old, fin]) => `${old} → … → ${fin}`)
    expect(壞, '這些舊 id 走完改名鏈之後，落在一個不存在或格式不合法的身分上').toEqual([])
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('元件身分命名空間', () => {
  const 違規 = 檢格式()
  const 引用 = 舊格式引用()
  const 同名 = 積木型別指紋()
  const 殘留 = residualRefs(new Set([...全部身分].filter((id) => !isNamespaced(id))))

  it('報表', () => {
    const scope分佈 = new Map<string, number>()
    for (const c of allCppConcepts()) {
      const s = isNamespaced(c.conceptId) ? c.conceptId.slice(0, c.conceptId.indexOf(':')) : '（裸名）'
      scope分佈.set(s, (scope分佈.get(s) ?? 0) + 1)
    }
    printReport('身分命名空間', [
      `元件 ${全部身分.size}｜格式違規 ${違規.length}｜舊格式引用 ts ${引用.ts} ／ json ${引用.json}`,
      `積木型別 ${同名.split('|').length} 顆（指紋不得變動）｜殘留待人看 ${殘留.length}`,
      '',
      'scope 分佈：' + [...scope分佈].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join('｜'),
      '',
      ...違規.slice(0, 12).map((f) => `  ⚠️ ${f.conceptId.padEnd(30)} ${f.為何}`),
      違規.length > 12 ? `     …還有 ${違規.length - 12} 顆` : '',
      '',
      '**殘留**（角色分類不到、看起來與概念有關——收硬性零前要逐筆看）：',
      ...殘留.slice(0, 10).map((r) => `     ${r.file}:${r.line}  ${r.text.slice(0, 80)}`),
      殘留.length > 10 ? `     …還有 ${殘留.length - 10} 處` : '',
    ])
    expect(true).toBe(true)
  })

  it('★ 積木型別集合**不得變動**', () => {
    // ⚠️ 這一條不是「越少越好」。66 顆元件身分與積木型別字串相同，
    // 而積木型別**必須原地不動**（B 項已定加法式保留）。
    // 這個數字動了 = 改名改到了不該改的那一邊，而症狀（積木消失）
    // 有十幾種成因，等到有人回報時已經無從歸因。
    const base = loadBaseline<{ 積木型別指紋: string }>('identity-namespace')
    const 現 = new Set(同名.split('|'))
    const 舊 = new Set(base.積木型別指紋.split('|'))
    expect(
      [...舊].filter((t) => !現.has(t)),
      '積木型別消失了——改名動到了不該改的那一邊。立刻回退，不要就地修補',
    ).toEqual([])
    expect([...現].filter((t) => !舊.has(t)), '積木型別憑空多出來了').toEqual([])
  })

  it('★ 硬性零：沒有任何身分是舊格式', () => {
    // ⚠️ **硬性零，不是棘輪。**（`build-guardrail` 第 6.8 步）
    //
    // 「留一筆還成立嗎」→ 不成立：一顆沒有命名空間的身分就是一顆沒有擁有者的
    // 身分，第三方套件與硬體域都建立在「身分有主」這件事上。
    // 「修法貴不貴」→ 遷移已經做完了，維持它是免費的。
    expect(違規.map((f) => `${f.conceptId}：${f.為何}`), '身分格式退回舊樣了').toEqual([])
    expect(引用.ts, '程式碼裡還有舊格式的身分引用').toBe(0)
    expect(引用.json, '宣告裡還有舊格式的身分引用').toBe(0)
  })

  it('★ 棘輪：格式違規與舊格式引用只准下降', () => {
    const current = { guard: 'identity-namespace', 違規, 引用, 積木型別指紋: 同名 }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('identity-namespace', current)
      return
    }
    const base = loadBaseline<typeof current>('identity-namespace')
    const added = newItems(違規, base.違規, (f) => f.conceptId)
    expect(
      added.map((f) => `${f.conceptId}  ${f.為何}`),
      '新增了一顆沒有命名空間的身分——格式退回去了。',
    ).toEqual([])
    assertRatchet([
      ['格式違規', 違規.length, base.違規.length],
      ['舊格式引用(ts)', 引用.ts, base.引用.ts],
      ['舊格式引用(json)', 引用.json, base.引用.json],
    ])
  })
})
