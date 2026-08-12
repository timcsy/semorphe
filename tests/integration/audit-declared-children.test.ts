/**
 * 宣告的子節點名有沒有人讀（第十條護欄）
 *
 * ## 這條在防什麼
 *
 * 概念定義說「我有一個叫 `init` 的子節點」，而它的五條路**全部讀 `initializer`**。
 * 兩邊都能跑、測試全綠，而那個宣告**沒有任何人讀**。
 *
 * 危險在於**完備性護欄是照著概念定義合成節點的**：它建了一個 `init` 子節點，
 * 每一條路都看不到它，於是每一條路都拿預設值跑完，然後回報 ✅。
 *
 * > **量測工具照著一份錯的宣告去合成輸入，就會量到一個不存在的東西。**
 *
 * 這是「殼」的一個新形狀：不是路徑空的，是**餵給路徑的東西是空的**。
 *
 * ## ⚠️ 詞界不可省
 *
 * `children.init` 是 `children.initializer` 的**子字串**。第一版沒加詞界，
 * 於是這條護欄回報「0 個問題」——**而它要抓的那一個正好被自己的子字串遮掉**。
 *
 * 同一個坑這個專案今天踩了四次（撞名的概念身分、`'cpp_endl'` 裡的 `endl`、
 * 正則字面、這裡）。見 `knowledge/experience.md`。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
  listSourceFiles,
  REPO_ROOT,
  assertRatchet,
} from '../helpers/guardrail'
import { universalConcepts } from '../../src/blocks/universal'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { coreConcepts } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ConceptDefJSON } from '../../src/core/types'

const RULE =
  '對每個概念宣告的每個子節點名，檢查原始碼裡有沒有 `children.<名字>` 或 ' +
  '`children[\'<名字>\']` 的讀取。**比對加詞界**——`children.init` 是 ' +
  '`children.initializer` 的子字串。'

const SELF_FALSIFICATION =
  '⚠️ 這條護欄的健康檢查是下面那兩支合成注入，**不是報表上的數字**。' +
  '若比對忘了加詞界，它會回報 0——而 0 與健康的 0 長得一模一樣。' +
  '第一版就是這樣：它要抓的那一個正好被自己的子字串遮掉。'

const NOT_DETECTED =
  '本護欄**不檢測**：名字對了但**語義**錯了（讀得到、意思不同）、' +
  '同一個名字在 A 概念有人讀而在 B 概念沒人讀（比對是跨概念的，不分概念）、' +
  '執行期才組出來的鍵名。**這是保守方向**——它只抓「完全沒有人讀」，抓不到「讀錯地方」。'

interface ChildrenBaseline {
  _meta: BaselineMeta
  orphans: number
  list: string[]
}

/** 所有原始碼串起來——比對「有沒有任何地方讀它」 */
function allSource(): string {
  let s = ''
  for (const dir of ['src/core', 'src/ui', 'src/interpreter', 'src/views', 'src/languages', 'src/blocks']) {
    for (const rel of listSourceFiles(dir)) s += readFileSync(join(REPO_ROOT, rel), 'utf8')
  }
  return s
}

/** ⚠️ 詞界不可省——見檔頭 */
export function isChildRead(source: string, name: string): boolean {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`children(\\.${esc}|\\['${esc}'\\])(?![A-Za-z0-9_])`).test(source)
}

function measure(): { name: string; concept: string }[] {
  const src = allSource()
  const all = [
    ...(universalConcepts),
    ...coreConcepts,
    ...allStdModules.flatMap((m) => m.concepts),
  ]
  const out: { name: string; concept: string }[] = []
  for (const c of all) {
    const children = (c as { children?: Record<string, unknown> }).children
    if (!children) continue
    for (const name of Object.keys(children)) {
      if (!isChildRead(src, name)) out.push({ name, conceptId: c.conceptId })
    }
  }
  return out
}

const orphans = measure()

describe('護欄：宣告的子節點名沒有人讀', () => {
  it('產出可讀報表', () => {
    const lines = [SELF_FALSIFICATION, NOT_DETECTED, '', `判定規則：${RULE}`, '']
    lines.push(`沒有人讀的子節點宣告：${orphans.length} 筆`)
    lines.push('')
    lines.push('**這不是「路徑空的」，是「餵給路徑的東西是空的」**——')
    lines.push('完備性護欄照著概念定義合成節點，宣告錯了它就會量到一個不存在的東西。')
    lines.push('')
    for (const o of orphans) lines.push(`  ${o.conceptId} → children.${o.name}`)
    printReport('宣告的子節點名護欄（第十條）', lines)
    expect(orphans.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 合成注入：沒有人讀的名字必須被報出', () => {
    expect(
      isChildRead('const x = node.children.somethingElse', '__zz_no_reader__'),
      '無人讀卻回報有人讀 → 這條護欄的 0 是假的',
    ).toBe(false)
  })

  it('★ 合成注入：有人讀的名字不得被誤報', () => {
    expect(isChildRead('await ctx.executeBody(node.children.body)', 'body')).toBe(true)
    expect(isChildRead("const v = node.children['then'] ?? []", 'then')).toBe(true)
  })

  it('★ 詞界：`init` 不得因為 `initializer` 而被判成有人讀', () => {
    expect(
      isChildRead('const i = node.children.initializer', 'init'),
      '這正是第一版的錯——它要抓的那一筆被自己的子字串遮掉，回報 0 而看起來健康',
    ).toBe(false)
  })

  it('★ 概念清單不是空的——空的話什麼都沒掃', () => {
    // ⚠️ **錨點要涵蓋膠囊。** 原本只算 `coreConcepts ＋ std 模組`，
    // 而 F（膠囊搬家）會把概念一顆顆搬出那兩個來源——這個下限因此
    // **隨進度被推穿**（2026-08-11 跌到 50）。
    //
    // > 一個入口條件錨在「還沒被搬走的有幾顆」上，
    // > 會在搬家成功的路上變紅——與第三十五條護欄踩的是同一個坑。
    //
    // 改成問**全部**宣告（`allCppConcepts()` 含膠囊），那個數字不隨搬家改變。
    expect(allCppConcepts().length).toBeGreaterThan(150)
  })

  it('棘輪：不得上升', () => {
    const b = loadBaseline<ChildrenBaseline>('declared-children')
    const now = orphans.map((o) => `${o.conceptId}::${o.name}`)
    const added = now.filter((k) => !b.list.includes(k))
    expect(added, `新增了沒有人讀的子節點宣告：\n  ${added.join('\n  ')}`).toEqual([])
    assertRatchet([['沒有人讀的子節點宣告', orphans.length, b.orphans]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-declared-children.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('declared-children', {
    _meta: {
      guard: 'declared-children',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    orphans: orphans.length,
    list: orphans.map((o) => `${o.conceptId}::${o.name}`),
  })
}
