/**
 * 工具箱與課程清單的**照片**——順序是教學設計，不能讓演算法決定
 *
 * ## 這支測試在防什麼
 *
 * 100 把 `toolbox-categories.ts` 的 80 筆手寫 `extraTypes` 換成從登錄表導出。
 * 導出最容易出的錯不是「少一顆」——那有可拿性護欄在看——而是**順序被接管**：
 * 分類變成字母序、積木變成登錄表載入序。
 *
 * 少一顆積木學生會回報。**順序悄悄變了學生不會回報，他只會覺得變難用。**
 *
 * ## 為什麼不用 vitest snapshot
 *
 * `-u` 會靜默更新，等於「跑一下就自動接受惡化」。基線檔要手動改，而且要與
 * 造成改變的那次修改同一個 commit。見 `knowledge/skills/build-guardrail`。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測「放對分類」**——它只保證與上一次相同。第一次拍照時放錯的，
 *   這支會忠實地把錯的釘住。放對分類要人看（tasks T038）。
 * - **不檢測拿不拿得到**——那是 `audit-toolbox-reachability` 的事。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadToolbox, curriculumSnapshot } from '../helpers/toolbox'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { buildToolbox } from '../../src/ui/toolbox-builder'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import { getVisibleConcepts } from '../../src/core/level-tree'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'
import { REPO_ROOT } from '../helpers/guardrail'
import cppBeginner from '../../src/languages/cpp/topics/cpp-beginner.json'
import cppCompetitive from '../../src/languages/cpp/topics/cpp-competitive.json'

const BASELINE_DIR = path.join(REPO_ROOT, 'tests/baselines')
const GENERATE = process.env.GENERATE_BASELINE === '1'

function baseline<T>(name: string, current: T): T {
  const file = path.join(BASELINE_DIR, `${name}.json`)
  if (GENERATE) {
    fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n', 'utf8')
    return current
  }
  if (!fs.existsSync(file)) {
    throw new Error(
      `基線檔不存在：tests/baselines/${name}.json\n` +
        `第一次跑請執行 GENERATE_BASELINE=1 npx vitest run tests/integration/toolbox-snapshot.test.ts 並 commit。`,
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

describe('工具箱快照', () => {
  const { snapshot } = loadToolbox()

  it('★ 分類的順序與標題一字不差', () => {
    const base = baseline('toolbox', snapshot)
    expect(
      snapshot.categories.map((c) => c.name),
      '分類順序變了——那是教學設計被演算法接管的第一個徵兆',
    ).toEqual(base.categories.map((c) => c.name))
  })

  it('★ 每個分類的積木順序與成員一字不差', () => {
    const base = baseline('toolbox', snapshot)
    const byName = new Map(base.categories.map((c) => [c.name, c.blocks]))
    for (const cat of snapshot.categories) {
      expect(cat.blocks, `分類「${cat.name}」的內容變了`).toEqual(byName.get(cat.name))
    }
  })

  it('★ 自我檢查：照片裡真的有東西', () => {
    // ⚠️ `build-guardrail` 第 10 步——一支「通過」的快照測試，與一支拍到空白的，
    // 產出完全相同。這個專案發生過五列假的通過。
    expect(snapshot.categories.length, '零個分類 → 是工具箱空了，不是它沒變').toBeGreaterThan(5)
    const total = snapshot.categories.reduce((n, c) => n + c.blocks.length, 0)
    expect(total, '零顆積木 → 同上').toBeGreaterThan(100)
  })
})

describe('起始關卡的工具箱——**使用者第一眼看到的東西**', () => {
  // ⚠️ **這一段是使用者截圖逼出來的。**
  //
  // 上面的快照用「全部概念可見」，而使用者打開瀏覽器看到的是**課程的起始關卡**。
  // 導出改完之後 `app.ts` 仍載入沒蓋 owner 章的原始 JSON，於是每個 `(universal)`
  // 段落回傳零筆——**學生只看到兩個分類、沒有任何 statement 積木**，
  // 而全套測試（走另一份組裝）全綠。
  //
  // 全部可見的快照**結構上看不到這個病**：核心與 std 的積木照樣在，
  // 少掉的那一批被其他分類的數量蓋過去。只有**起始關卡**會讓它裸露出來，
  // 因為那一關幾乎只有通用積木。
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts(), allCppProjections())

  /** 一門課的**起始關卡**——使用者第一次打開看到的就是這個 */
  function 起始關卡(topic: unknown): { 分類: string[]; 積木: string[] } {
    const tb = buildToolbox({
      blockSpecRegistry: reg,
      visibleConcepts: getVisibleConcepts(topic as never, new Set(['L0'])),
      ioPreference: 'iostream',
      msgs: {},
      categoryColors: CATEGORY_COLORS,
      categoryDefs: cppCategoryDefs,
    }) as { contents: { name: string; contents: { type: string }[] }[] }
    return {
      分類: tb.contents.map((c) => c.name),
      積木: tb.contents.flatMap((c) => c.contents.map((b) => b.type)),
    }
  }

  // ⚠️ **兩門課都要釘。** 只釘一門的話，另一門的起始關卡壞掉不會有人知道——
  // 而「只有其中一門壞了」正是這一類 bug 最可能的形狀（可見度是逐課算的）。
  const 課程 = [
    ['初學 C++', cppBeginner],
    ['競程 C++', cppCompetitive],
  ] as const

  for (const [名稱, topic] of 課程) {
    describe(名稱, () => {
      const { 分類, 積木 } = 起始關卡(topic)

      it('★ 起始關卡至少有五個分類——只剩兩個代表整批來源查無此章', () => {
        expect(分類.length, `學生第一眼只看到 ${分類.length} 個分類（${分類.join('、')}）→ 有整批來源消失了`)
          .toBeGreaterThanOrEqual(5)
      })

      it('★ 有 statement 積木——沒有的話學生連第一行都寫不出來', () => {
        for (const t of ['u_var_declare', 'u_var_assign', 'u_print', 'u_if']) {
          expect(積木, `${t} 不在起始關卡的工具箱裡`).toContain(t)
        }
      })

      it('★ 有基本資料積木——整數與字串是「基本資料」', () => {
        for (const t of ['u_number', 'u_string', 'u_var_ref']) {
          expect(積木, `${t} 不在起始關卡的工具箱裡`).toContain(t)
        }
      })

      it('★ 每個出現的分類都不是空的', () => {
        // 空分類會被 buildToolbox 濾掉，所以這一支釘的是「濾掉之後還有東西」
        expect(積木.length, '起始關卡一顆積木都沒有').toBeGreaterThan(10)
      })
    })
  }
})

describe('課程清單快照', () => {
  const snaps = [
    curriculumSnapshot(cppBeginner as never),
    curriculumSnapshot(cppCompetitive as never),
  ]

  it('★ 每一層的 id／標題／成員與順序一字不差', () => {
    const base = baseline('curriculum', snaps)
    expect(
      snaps,
      '課程清單的成員是策展——導出它等於用演算法決定教學順序（FR-006）',
    ).toEqual(base)
  })

  it('★ 自我檢查：兩份清單都有層級', () => {
    for (const s of snaps) {
      expect(s.levels.length, `${s.id} 沒有任何層級 → 是解析壞了`).toBeGreaterThan(0)
    }
  })
})
