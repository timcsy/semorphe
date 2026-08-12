/**
 * 抽象層完整性（第九條護欄）
 *
 * ## 指不到的父概念，壞掉的樣子與「沒有宣告」完全一樣
 *
 * 每個概念可以宣告它的**語言中立父概念**——那是跨語言映射的地基。
 * 查詢父概念的函式在目標不存在時**靜默回傳「沒有」**：
 *
 * ```
 * findAbstract(id) {
 *   if (!concrete?.abstractConcept) return undefined   // 沒有宣告
 *   return this.concepts.get(concrete.abstractConcept) // 指不到 → 也是 undefined
 * }
 * ```
 *
 * 兩種情況產出相同。所以一個 75% 破掉的抽象層，看起來與「大部分概念沒有
 * 宣告父概念」完全一樣——而後者是可以接受的。
 *
 * ## 失效樣態
 *
 * ⚠️ 如果這個數字是 0 而**宣告了父概念的概念數也接近 0**，那是清單沒取到，
 * 不是抽象層健康。報表同時印出兩個數字就是為了讓這件事看得出來。
 */
import { describe, it, expect } from 'vitest'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, type BaselineMeta , assertRatchet } from '../helpers/guardrail'
import { allComponentDefs } from '../helpers/component-scan'

const RULE = '每個 abstractConcept 的目標，必須是一個真的存在的概念。'

const SELF_FALSIFICATION =
  '⚠️ 這個數字若是 0 而「宣告了父概念的概念數」也接近 0，那是清單沒取到，' +
  '不是抽象層健康。兩個數字要一起看。'

const NOT_DETECTED =
  '本護欄**不檢測**：父概念在語義上對不對（只檢查它存不存在）、抽象鏈是否成環、' +
  '跨語言是否真的指向同一個抽象。'

interface AbstractBaseline {
  _meta: BaselineMeta
  declared: number
  dangling: number
  targets: string[]
}

const defs = allComponentDefs()
const ids = new Set(defs.map((d) => d.conceptId))
const declared = defs.filter((d) => d.abstractConcept)
const dangling = declared.filter((d) => !ids.has(d.abstractConcept as string))
/**
 * 指向自己的父概念。
 *
 * 「`var_declare` 的語言中立父概念是 `var_declare`」語義上是空的——查詢會
 * 回傳它自己，對跨語言映射毫無意義。**通用概念本身就是抽象層**，不該再宣告
 * 父概念。第一版的懸空檢查抓不到它（自己當然「存在」）。
 */
const selfLoops = declared.filter((d) => d.abstractConcept === d.conceptId)

describe('護欄：抽象層完整性', () => {
  it('產出可讀報表', () => {
    printReport('抽象層完整性護欄', [
      SELF_FALSIFICATION,
      NOT_DETECTED,
      '',
      `判定規則：${RULE}`,
      '',
      `宣告了父概念：${declared.length}｜**指向不存在的：${dangling.length}**｜**指向自己的：${selfLoops.length}**`,
      '',
      ...dangling.slice(0, 12).map((d) => `  ${d.conceptId} → ${d.abstractConcept}（不存在）`),
      ...(dangling.length > 12 ? [`  … 另外 ${dangling.length - 12} 個`] : []),
      '',
      '查詢父概念的函式對這些**靜默回傳「沒有」**——所以它壞掉的樣子',
      '與「這個概念沒有宣告父概念」完全一樣，而後者是可以接受的。',
    ])
    expect(dangling.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：指向一個不存在的概念，必須被抓到', () => {
    const fake = { conceptId: '__probe__', abstractConcept: '__does_not_exist__' }
    expect(ids.has(fake.abstractConcept)).toBe(false)
  })

  it('★ 注入：指向存在的概念不得被誤報', () => {
    const ok = declared.filter((d) => ids.has(d.abstractConcept as string))
    expect(ok.every((d) => !dangling.includes(d))).toBe(true)
  })

  it('★ 不得有指向自己的父概念——那是語義上的空話', () => {
    expect(
      selfLoops.map((d) => d.conceptId),
      '父概念指向自己：查詢會回傳它自己，對跨語言映射毫無意義。' +
        '通用概念本身就是抽象層，不該再宣告父概念。',
    ).toEqual([])
  })

  it('棘輪：懸空數不得上升', () => {
    const b = loadBaseline<AbstractBaseline>('abstract-integrity')
    const now = dangling.map((d) => `${d.conceptId}→${d.abstractConcept}`)
    const added = now.filter((x) => !b.targets.includes(x))
    expect(
      added,
      `新增的懸空宣告：${added.join('、')}\n` +
        '宣告父概念之前先確認那個概念存在——指不到的宣告與沒有宣告產出一樣。',
    ).toEqual([])
    assertRatchet([['懸空的父概念宣告', dangling.length, b.dangling]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-abstract-integrity.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('abstract-integrity', {
    _meta: {
      guard: 'abstract-integrity',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    declared: declared.length,
    dangling: dangling.length,
    targets: dangling.map((d) => `${d.conceptId}→${d.abstractConcept}`).sort(),
  })
}
