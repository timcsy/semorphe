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
