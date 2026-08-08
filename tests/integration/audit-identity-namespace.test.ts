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
import { printReport, loadBaseline, writeBaseline, newItems, assertRatchet } from '../helpers/guardrail'
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

/** JSON 裡 `blockDef.type` 落在身分清單中的處數——**這個數字不得變動** */
function 同名積木型別(): number {
  return scanJsonRefs(全部身分).filter((r) => r.role === 'blockType').length
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

  it('★ 改名表的每一筆目標都必須是合法身分', () => {
    const 壞 = Object.entries(registeredIdMigrations())
      .filter(([, neo]) => !isValidComponentId(neo))
      .map(([old, neo]) => `${old} → ${neo}`)
    expect(壞, '改名的目標格式不合法或 scope 不在白名單').toEqual([])
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('元件身分命名空間', () => {
  const 違規 = 檢格式()
  const 引用 = 舊格式引用()
  const 同名 = 同名積木型別()
  const 殘留 = residualRefs(new Set([...全部身分].filter((id) => !isNamespaced(id))))

  it('報表', () => {
    const scope分佈 = new Map<string, number>()
    for (const c of allCppConcepts()) {
      const s = isNamespaced(c.conceptId) ? c.conceptId.slice(0, c.conceptId.indexOf(':')) : '（裸名）'
      scope分佈.set(s, (scope分佈.get(s) ?? 0) + 1)
    }
    printReport('身分命名空間', [
      `元件 ${全部身分.size}｜格式違規 ${違規.length}｜舊格式引用 ts ${引用.ts} ／ json ${引用.json}`,
      `同名積木型別 ${同名}（**不得變動**）｜殘留待人看 ${殘留.length}`,
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

  it('★ 同名積木型別的處數**不得變動**', () => {
    // ⚠️ 這一條不是「越少越好」。66 顆元件身分與積木型別字串相同，
    // 而積木型別**必須原地不動**（B 項已定加法式保留）。
    // 這個數字動了 = 改名改到了不該改的那一邊，而症狀（積木消失）
    // 有十幾種成因，等到有人回報時已經無從歸因。
    const base = loadBaseline<{ 同名積木型別: number }>('identity-namespace')
    expect(同名, '改名動到了積木型別——立刻回退，不要就地修補').toBe(base.同名積木型別)
  })

  it('★ 棘輪：格式違規與舊格式引用只准下降', () => {
    const current = { guard: 'identity-namespace', 違規, 引用, 同名積木型別: 同名 }
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
