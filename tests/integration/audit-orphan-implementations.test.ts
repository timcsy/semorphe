/**
 * 有實作卻沒有宣告（第八條護欄）
 *
 * ## 護欄一直只問了一個方向
 *
 * 完備性護欄迭代的是**概念註冊表**，所以它問的是：
 *
 * > 已宣告的概念，五條路都有實作嗎？
 *
 * 它**從來沒問過反方向**：
 *
 * > 有實作的東西，有被宣告嗎？
 *
 * 於是「有執行器卻沒有概念定義」的東西**完全不在任何報表上**。實測有 4 個。
 *
 * 它們可能是死碼，也可能是漏宣告的概念——**兩種都是問題**，而且第二種更糟：
 * 那個概念的其餘四條路有沒有缺口，沒有人知道，因為報表看不見它。
 *
 * ## 失效樣態
 *
 * ⚠️ 如果這個數字是 0，先確認「已註冊的執行器」真的取得到——空清單與零違規
 * 產出一樣。`★ 注入` 那支才是健康檢查。
 *
 * 見 specs/055-finish-executor-move/research.md F2
 */
import { describe, it, expect } from 'vitest'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, type BaselineMeta } from '../helpers/guardrail'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { allComponentDefs } from '../helpers/component-scan'

const RULE = '把「已註冊執行器的概念」與「概念定義檔宣告的概念」相減。'

const SELF_FALSIFICATION =
  '⚠️ 這個數字若是 0，先確認執行器清單真的取得到——空清單與零違規產出一樣。' +
  '判斷依據是「★ 注入」那支測試。'

const NOT_DETECTED =
  '本護欄**不檢測**：其餘四條路的孤兒實作（只看執行路）、' +
  '宣告了卻沒有任何實作的概念（那是完備性護欄的方向）。'

interface OrphanBaseline {
  _meta: BaselineMeta
  orphans: number
  concepts: string[]
}

registerCppLanguage()

function orphans(): string[] {
  const interp = new SemanticInterpreter({ maxSteps: 1 })
  const registered = (interp as unknown as {
    executorRegistry: { list(): string[] }
  }).executorRegistry.list()
  const declared = new Set(allComponentDefs().map((d) => d.conceptId))
  return registered.filter((c) => !declared.has(c)).sort()
}

const found = orphans()

describe('護欄：有實作卻沒有宣告', () => {
  it('產出可讀報表', () => {
    printReport('孤兒實作護欄', [
      SELF_FALSIFICATION,
      NOT_DETECTED,
      '',
      `判定規則：${RULE}`,
      '',
      `有執行器但沒有概念定義：**${found.length} 個**`,
      '',
      ...found.map((c) => `  ${c}`),
      '',
      '這些概念**完全不在完備性報表上**——報表照著定義走，看不見沒有定義的東西。',
      '每一個都要判定為「補宣告」或「刪死碼」，兩者都要寫出依據。',
    ])
    expect(found.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：故意註冊一個沒有宣告的概念，必須被抓到', () => {
    const probe = new SemanticInterpreter({ maxSteps: 1 })
    const reg = (probe as unknown as {
      executorRegistry: { register(c: string, e: () => Promise<void>): void; list(): string[] }
    }).executorRegistry
    reg.register('__orphan_probe__', async () => {})
    const declared = new Set(allComponentDefs().map((d) => d.conceptId))
    expect(
      reg.list().filter((c) => !declared.has(c)),
      '刻意註冊一個沒宣告的概念卻沒被抓到 → 這條護欄的 0 不可信',
    ).toContain('__orphan_probe__')
  })

  it('★ 注入：有宣告的概念不得被誤報', () => {
    const declared = new Set(allComponentDefs().map((d) => d.conceptId))
    expect(found.filter((c) => declared.has(c))).toEqual([])
  })

  it('棘輪：不得上升', () => {
    const b = loadBaseline<OrphanBaseline>('orphan-implementations')
    const 新增 = found.filter((c) => !b.concepts.includes(c))
    expect(
      新增,
      `新增的孤兒實作：${新增.join('、')}\n` +
        '加執行器之前要先宣告概念——否則它的其餘四條路有沒有缺口，沒有人看得到。',
    ).toEqual([])
    expect(found.length).toBeLessThanOrEqual(b.orphans)
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-orphan-implementations.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('orphan-implementations', {
    _meta: {
      guard: 'orphan-implementations',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    orphans: found.length,
    concepts: found,
  })
}
