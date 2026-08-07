/**
 * 課程清單：**策展保留，但不得爛掉**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條檢查回報「零個懸空引用」，而下面合成注入的一個引用幽靈元件的
 * > 層級沒有被報出來，代表檢查壞了，不是清單健康。**
 *
 * 錨點是合成輸入，不是真實世界的狀態——真實世界的懸空引用遲早會被修掉，
 * 而錨在它上面的聲明會在那一天變成叫人不要相信一個正確的結果。
 *
 * ## 這條**刻意不做**的事：不導出成員
 *
 * ```
 * L0: 基礎          concepts: 19
 *   L1a: 函式與迴圈   concepts: 20
 *     L2a: 陣列與字串  concepts: 33
 *       L3a: STL 容器   concepts: 25
 * ```
 *
 * 那是**一條教學漸進線**。「`vector` 屬於 L3a 而不是 L0」是人的判斷，
 * 導不出來——導出它等於用演算法決定教學順序。
 *
 * 所以工具箱全導出、課程清單不導出，判準同一條：
 * **問「登錄表知道嗎」，不問「這是不是一份清單」。**
 *
 * ## 兩道檢查，強度刻意不同
 *
 * | | 判定 | 為什麼 |
 * |---|---|---|
 * | 引用**不存在**的元件 | **紅** | 清單爛掉了——學生會看到一個打不開的關卡 |
 * | 元件**未被任何課程收錄** | **報出，不算違規** | 沒收錄是策展決定，不是缺陷 |
 *
 * 第二條做成違規的話，會逼出「為了讓護欄綠而把新元件亂塞進課程」
 * ——那比不收錄更糟，而且**沒有任何測試抓得到那個損失**。
 *
 * ## 本檢查不檢測什麼
 *
 * - **不檢測層級分得對不對**（`vector` 該不該在 L3a）——那是教學判斷。
 * - **不檢測順序好不好**——快照測試只保證它沒有被演算法改掉。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { loadToolbox, curriculumSnapshot } from '../helpers/toolbox'
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import cppCompetitive from '../../src/languages/cpp/topics/cpp-competitive.json'

interface Level {
  id: string
  label: string
  concepts: string[]
}

const { allConcepts } = loadToolbox()
const 已知元件 = new Set(allConcepts.map((c) => c.conceptId))

const 課程 = [curriculumSnapshot(cppBeginner as never), curriculumSnapshot(cppCompetitive as never)]

/** 懸空引用：課程指向一顆不存在的元件 */
function dangling(levels: Level[], known: Set<string> = 已知元件): { level: string; concept: string }[] {
  const out: { level: string; concept: string }[] = []
  for (const lv of levels) {
    for (const c of lv.concepts) if (!known.has(c)) out.push({ level: lv.id, concept: c })
  }
  return out
}

describe('自我驗證：這條檢查真的量得到東西', () => {
  it('★ 注入一個引用幽靈元件的層級 → **必須被報出**', () => {
    const 合成: Level[] = [{ id: '__合成層級__', label: '合成', concepts: ['__不存在的元件__'] }]
    expect(
      dangling(合成),
      '合成的懸空引用沒有被報出來 → **檢查壞了，不是清單健康**',
    ).toEqual([{ level: '__合成層級__', concept: '__不存在的元件__' }])
  })

  it('★ 反向：注入一個引用真元件的層級 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的檢查也能通過上一支。
    const 合成: Level[] = [{ id: '__合成層級__', label: '合成', concepts: ['print'] }]
    expect(dangling(合成), '一個引用真元件的層級被報成懸空 → 這條檢查會亂叫').toEqual([])
  })

  it('★ 掃描器有真的掃到東西', () => {
    expect(已知元件.size, '零顆元件 → 是載入壞了，不是專案空了').toBeGreaterThan(150)
    for (const t of 課程) expect(t.levels.length, `${t.id} 沒有任何層級 → 是解析壞了`).toBeGreaterThan(0)
  })
})

describe('課程清單', () => {
  const 全部懸空 = 課程.flatMap((t) => dangling(t.levels).map((d) => `${t.id} · ${d.level} → ${d.concept}`))
  const 被收錄 = new Set(課程.flatMap((t) => t.levels.flatMap((l) => l.concepts)))
  const 未收錄 = [...已知元件].filter((c) => !被收錄.has(c)).sort()

  it('報表', () => {
    printReport('課程收錄', [
      `元件 ${已知元件.size}｜被至少一門課收錄 ${被收錄.size}｜未收錄 ${未收錄.length}`,
      '',
      ...課程.map((t) => `  ${t.id}：${t.levels.length} 層，${t.levels.reduce((n, l) => n + l.concepts.length, 0)} 筆引用`),
      '',
      '未收錄（**不是違規**——沒收錄是策展決定）：',
      ...未收錄.map((c) => `    ${c}`),
    ])
    expect(true).toBe(true)
  })

  it('★ TP-1：課程不得引用不存在的元件', () => {
    expect(全部懸空, '課程指向一顆不存在的元件 → 學生會看到一個打不開的關卡').toEqual([])
  })

  it('★ TP-2：未收錄要**報得出來**，但不算違規', () => {
    // 這一支釘的是「報得出來」，不是「數字是多少」。
    // ⚠️ 不要在這裡斷言 `未收錄.length === N`——那個數字會隨每次新增元件而變，
    //    而錨在真實世界狀態上的斷言遲早會爛掉（同一個 session 裡發生過五次）。
    expect(Array.isArray(未收錄)).toBe(true)
    expect(被收錄.size, '零筆收錄 → 是解析壞了，不是課程空了').toBeGreaterThan(50)
  })

  it('★ FR-006：成員是人選的——**這裡不導出任何東西**', () => {
    // 反向釘：如果哪天有人把課程改成「收錄全部元件」，這一支會紅。
    // 那不是進步，那是刪掉了整條教學漸進線。
    expect(
      被收錄.size,
      '課程收錄了全部元件 → 教學漸進線被導出取代了（L0 不該教 vector）',
    ).toBeLessThan(已知元件.size)
  })
})
