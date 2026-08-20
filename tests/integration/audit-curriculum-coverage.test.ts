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
/**
 * 🔴 **課程清單是【掃】出來的，不是手寫的兩個 import。**
 *
 * ⚠️ 2026-08-17 發現：這裡原本硬寫著 `cpp-beginner` 與 `cpp-competitive` 兩個
 * import，而 spec 136 加的 `c-beginner.json` **它從來沒看到過**——
 * 於是「這顆概念有沒有被收錄」這個問題，答案取決於**它被收進哪一份清單**。
 *
 * > **一條檢查如果自己維護一份「要看哪些檔」的清單，
 * > 那份清單就是它的盲點，而盲點不會出聲。**
 *
 * 與 `component/registry.ts` 同一個處置：**加一份課程清單＝新增一個檔，零編輯。**
 */
const topicModules = import.meta.glob('../../src/languages/cpp/topics/*.json', { eager: true }) as
  Record<string, { default: { id: string; levelTree: Level } }>

interface Level {
  id: string
  label: string
  concepts: string[]
}

const ALL_TOPICS = Object.values(topicModules).map((m) => m.default)

const { allConcepts } = loadToolbox()
const knownComponents = new Set(allConcepts.map((c) => c.conceptId))

/**
 * **刻意不收進任何課程**的元件——每筆附理由。
 *
 * ⚠️ 這不是「還沒收錄」的暫存區。沒有理由的省略會讓下一顆新元件也靜靜地
 * 對學生隱形（`priority_queue` 就是這樣被使用者發現的）。
 */
const deliberatelyExcluded: Record<string, string> = {
  'cpp:program':
    '程式的根鷹架。它不是學生選得出來的積木——每個程式都有一個，由系統自動建立，' +
    '收進課程等於在工具箱裡放一顆「整個程式」。',
  // 🔴 **spec 156：第一顆 Python 元件**——而它不收錄的理由與上面那顆完全不同。
  'python:print':
    'Python 【還沒有課程】。所有 topic（`cpp-beginner`／`c-beginner`／`arduino`／' +
    '`cpp-competitive`）都是 C++ 的課，把一顆 Python 概念收進去會讓學 C++ 的學生' +
    '在工具箱裡看到 `print(...)`。' +
    '⚠️ 而這【不是】「忘了收錄」：spec 156 明確排除工具箱切換與 Python 課程' +
    '——它此刻只是一個【有性狀的身分】，用來產生第一條跨語言的等價邊。' +
    '🟢 重開條件是「Python 有了自己的 topic」，不是「又想到它了」。',
}

const course = ALL_TOPICS.map((t) => curriculumSnapshot(t as never))

/** 懸空引用：課程指向一顆不存在的元件 */
function dangling(levels: Level[], known: Set<string> = knownComponents): { level: string; concept: string }[] {
  const out: { level: string; concept: string }[] = []
  for (const lv of levels) {
    for (const c of lv.concepts) if (!known.has(c)) out.push({ level: lv.id, concept: c })
  }
  return out
}

describe('自我驗證：這條檢查真的量得到東西', () => {
  it('★ 注入一個引用幽靈元件的層級 → **必須被報出**', () => {
    const synthetic: Level[] = [{ id: '__合成層級__', label: '合成', concepts: ['__不存在的元件__'] }]
    expect(
      dangling(synthetic),
      '合成的懸空引用沒有被報出來 → **檢查壞了，不是清單健康**',
    ).toEqual([{ level: '__合成層級__', concept: '__不存在的元件__' }])
  })

  it('★ 反向：注入一個引用真元件的層級 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的檢查也能通過上一支。
    const synthetic: Level[] = [{ id: '__合成層級__', label: '合成', concepts: ['cpp:print'] }]
    expect(dangling(synthetic), '一個引用真元件的層級被報成懸空 → 這條檢查會亂叫').toEqual([])
  })

  it('★ 掃描器有真的掃到東西', () => {
    expect(knownComponents.size, '零顆元件 → 是載入壞了，不是專案空了').toBeGreaterThan(150)
    for (const t of course) expect(t.levels.length, `${t.id} 沒有任何層級 → 是解析壞了`).toBeGreaterThan(0)
  })
})

describe('課程清單', () => {
  const allDangling = course.flatMap((t) => dangling(t.levels).map((d) => `${t.id} · ${d.level} → ${d.concept}`))
  const included = new Set(course.flatMap((t) => t.levels.flatMap((l) => l.concepts)))
  const notIncluded = [...knownComponents].filter((c) => !included.has(c)).sort()

  it('報表', () => {
    printReport('課程收錄', [
      `元件 ${knownComponents.size}｜被至少一門課收錄 ${included.size}｜未收錄 ${notIncluded.length}`,
      '',
      ...course.map((t) => `  ${t.id}：${t.levels.length} 層，${t.levels.reduce((n, l) => n + l.concepts.length, 0)} 筆引用`),
      '',
      '未收錄（**不是違規**——沒收錄是策展決定）：',
      ...notIncluded.map((c) => `    ${c}`),
    ])
    expect(true).toBe(true)
  })

  it('★ TP-1：課程不得引用不存在的元件', () => {
    expect(allDangling, '課程指向一顆不存在的元件 → 學生會看到一個打不開的關卡').toEqual([])
  })

  it('★ TP-2：未收錄要**報得出來**，但不算違規', () => {
    // 這一支釘的是「報得出來」，不是「數字是多少」。
    // ⚠️ 不要在這裡斷言 `未收錄.length === N`——那個數字會隨每次新增元件而變，
    //    而錨在真實世界狀態上的斷言遲早會爛掉（同一個 session 裡發生過五次）。
    expect(Array.isArray(notIncluded)).toBe(true)
    expect(included.size, '零筆收錄 → 是解析壞了，不是課程空了').toBeGreaterThan(50)
  })

  it('★ 未收錄 MUST 是**明確的策展決定**，不得是「忘了」', () => {
    // ⚠️ **這一支是使用者逼出來的**：`priority_queue` 補齊了五路、進了工具箱、
    // 測試全綠——而**它沒有被任何課程收錄**，於是 `getVisibleConcepts` 把它擋掉，
    // 學生永遠看不到。使用者的話是「priority_queue 我沒看到呀」。
    //
    // TP-2 刻意不把「未收錄」算成違規（做成違規會逼出「為了讓護欄綠而亂塞課程」）。
    // **而那讓「忘了收錄」變成完全靜默的。**
    //
    // 解法與這個專案其他地方一致：**不強迫收錄，但強迫做決定**。
    // 沒收錄就要說為什麼——「沒有理由的省略」與「刻意不教」分不出來。
    //
    // 這是同一個坑的第三次（標籤說謊 → 通用積木消失 → 這次），
    // 而共同形狀是：**測試量的是最大狀態，使用者看到的是課程狀態。**
    const undeclared = notIncluded.filter((c) => !deliberatelyExcluded[c])
    expect(
      undeclared,
      '這些元件不在任何課程裡，學生看不到它們。要嘛收進某一層，' +
        '要嘛在 `刻意不收錄` 裡寫下為什麼不教。',
    ).toEqual([])
  })

  it('★ FR-006：成員是人選的——**這裡不導出任何東西**', () => {
    // 反向釘：如果哪天有人把課程改成「收錄全部元件」，這一支會紅。
    // 那不是進步，那是刪掉了整條教學漸進線。
    expect(
      included.size,
      '課程收錄了全部元件 → 教學漸進線被導出取代了（L0 不該教 vector）',
    ).toBeLessThan(knownComponents.size)
  })
})
