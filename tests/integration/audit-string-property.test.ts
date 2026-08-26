/**
 * 第七十二條護欄：**字串屬性不得裝結構**。
 *
 * ## 它守的是什麼
 *
 * 語義樹上的一格若宣告成 `property`（字串），它裝的就該是一個**原子**
 * ——一個識別字、一個數、一個運算子、一段文字。
 *
 * 而實測（2026-08-25）**44 個字串屬性裝著文法**：
 *
 * ```
 * cpp:range_sum.begin        原子 0 ｜ v.begin() · nums.begin()      ← 全部是運算式
 * cpp:var_assign.obj         原子 107｜ r.x · p.first · s.side       ← lvalue
 * cpp:var_declare.type       原子 551｜ vector<T> · Container<int>   ← 型別是文法
 * ```
 *
 * 起因是使用者的一句話：「**lvalue 的型態應該百百種吧，這樣不就寫死了？**」
 *
 * ## 🔴 為什麼它「今天全綠」而仍然是缺陷
 *
 * 那些值**來回得回去**——產生器是字串串接。所以殘差不動、測試全綠。
 * 而積木上那一格是**下拉**：`o.x += 1` 那顆列的是變數清單，
 * 學生點一下改成 `i`，成員存取就沒了，**沒有任何東西會出聲**。
 *
 * > **一個看起來結構化、實際上是字串的欄位，比一個誠實的 `raw_code` 更危險
 * > ——`raw_code` 至少長得像降級。**
 *
 * ## 🔴 自我否證
 *
 * > **如果「★ 注入①」那一段裡，一個裝著 `v.begin()` 的【合成】屬性
 * > 沒有被判成「裝了結構」，代表判定函式壞了，不是世界長這樣。**
 *
 * ⚠️ 錨在**合成輸入**上。而入口條件錨在**語料段數**——
 * 🔴 **不錨在「掃到幾個字串屬性」**：那個數字會因為屬性被改成接點而變小，
 * 也就是**這條護欄成功的那天它會紅**（`build-guardrail` 簽名三）。
 *
 * ## 本護欄不檢測什麼
 *
 * - ❌ **不判「這一格該不該是結構」**——它只報「裝了不只是原子的值」，
 *   判定由 `tests/assets/string-property-decisions.json` 落地，**而每一筆要有理由**。
 * - ❌ **只看語料上真的出現過的值**——語料沒碰到的形態它看不見。
 *   🔴 而那正是這一輪學到的：**語料乾淨不代表模型對，它代表語料是照著模型長的**。
 *   （`cpp:var_assign_compound` 在語料上「非原子 0 種」，而瀏覽器裡三十秒做出四種。）
 * - ❌ 只掃 C++。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Language, Parser } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, assertCorpus, RATCHET_NOTE } from '../helpers/guardrail'
import { backtickSpans } from '../helpers/backtick-corpus'

const GUARD = 'string-property'
const decisionFile = path.join(REPO_ROOT, 'tests/assets/string-property-decisions.json')

interface Decision { key: string; decision: '文字本來就是字串' | '要改成接點'; reason: string }

function readDecisions(): Decision[] {
  if (!fs.existsSync(decisionFile)) return []
  return JSON.parse(fs.readFileSync(decisionFile, 'utf8')) as Decision[]
}

/**
 * 一個**原子**：識別字、數、單一運算子、空字串。
 *
 * ⚠️ 判定**保守**——判不出來算「裝了結構」，不計入安全
 * （`build-guardrail` 第 5 步）。
 */
export const ATOM = /^(?:[A-Za-z_]\w*|-?\d+(?:\.\d+)?|[-+*/%<>=!&|^~]{1,3}|)$/

export interface Sample { componentId: string; property: string; value: string }

/** 每個 `componentId.property` 上，出現過幾種**非原子**的值。 */
export function structuredProps(samples: readonly Sample[]): { key: string; atoms: number; kinds: string[] }[] {
  const stat = new Map<string, { atoms: number; kinds: Set<string> }>()
  for (const s of samples) {
    const key = `${s.componentId}.${s.property}`
    const e = stat.get(key) ?? { atoms: 0, kinds: new Set<string>() }
    if (ATOM.test(s.value)) e.atoms++
    else e.kinds.add(s.value)
    stat.set(key, e)
  }
  return [...stat.entries()]
    .filter(([, e]) => e.kinds.size > 0)
    .map(([key, e]) => ({ key, atoms: e.atoms, kinds: [...e.kinds] }))
    .sort((a, b) => b.kinds.length - a.kinds.length)
}

/** 從整合測試裡撈 C++ 語料——與第五十一條同一份來源。 */
function corpus(): string[] {
  const out: string[] = []
  const dir = path.join(REPO_ROOT, 'tests/integration')
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const c of backtickSpans(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!/[;{]/.test(c) || c.includes('${')) continue
      out.push(c)
    }
  }
  return out
}

describe('第七十二條護欄：字串屬性不得裝結構', () => {
  it('★ 注入①：裝著運算式的合成屬性【必須】被報出', () => {
    const r = structuredProps([
      { componentId: 'zz:fake', property: 'begin', value: 'v.begin()' },
      { componentId: 'zz:fake', property: 'begin', value: 'arr + 5' },
    ])
    expect(r).toHaveLength(1)
    // 🔴 釘住**理由**不只釘結果：報的必須是那兩個值，不是別的
    expect(r[0].key).toBe('zz:fake.begin')
    expect(r[0].kinds.sort()).toEqual(['arr + 5', 'v.begin()'])
  })

  it('★ 注入②：全是原子的屬性【不得】被報出', () => {
    expect(structuredProps([
      { componentId: 'zz:fake', property: 'name', value: 'counter' },
      { componentId: 'zz:fake', property: 'op', value: '+=' },
      { componentId: 'zz:fake', property: 'n', value: '-3' },
      { componentId: 'zz:fake', property: 'empty', value: '' },
    ])).toEqual([])
  })

  it('★ 注入③：同一個屬性混著原子與結構 → 報出，而原子數要算對', () => {
    const r = structuredProps([
      { componentId: 'zz:fake', property: 'obj', value: 'a' },
      { componentId: 'zz:fake', property: 'obj', value: 'b' },
      { componentId: 'zz:fake', property: 'obj', value: 'p->x' },
    ])
    expect(r[0].atoms, '🔴 原子數算錯＝報表會誤導人以為那一格幾乎都是結構').toBe(2)
    expect(r[0].kinds).toEqual(['p->x'])
  })

  it('★ 入口條件：語料真的撈到了（否則上面在比空集合）', () => {
    // 🔴 錨在**語料段數**上——它不會因為「屬性改成接點」而變小。
    //    ⚠️ 對照：錨在「掃到幾個字串屬性」會在這條護欄成功的那天變紅
    //       （`build-guardrail` 簽名三，這個庫已經付過九次學費）。
    expect(corpus().length, '🔴 一段語料都沒撈到＝掃描器壞了').toBeGreaterThan(200)
  })

  it('🔴 每一筆判定都要有理由——說不出理由的判定是把「懶得看」寫成「看過了」', () => {
    expect(readDecisions().filter((d) => !d.reason || d.reason.length < 6).map((d) => d.key)).toEqual([])
  })

  it('棘輪：「要看」的字串屬性只准下降', async () => {
    await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
    const p = new Parser()
    p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    const lifter = createTestLifter()

    const segments = corpus()
    const samples: Sample[] = []
    let lifted = 0
    for (const code of segments) {
      let tree
      try { tree = p.parse(code) } catch { continue }
      if (!tree || (tree.rootNode as unknown as { hasError: boolean }).hasError) continue
      let tr
      try { tr = lifter.lift(tree.rootNode as never) } catch { continue }
      if (!tr) continue
      lifted++
      const walk = (n: { componentId?: string; properties?: Record<string, unknown>; children?: Record<string, unknown[]> }): void => {
        if (!n) return
        for (const [k, v] of Object.entries(n.properties ?? {})) {
          if (typeof v === 'string') samples.push({ componentId: n.componentId ?? '?', property: k, value: v })
        }
        for (const kk of Object.keys(n.children ?? {})) (n.children![kk] as never[]).forEach(walk)
      }
      walk(tr as never)
    }

    const found = structuredProps(samples)
    const decisions = readDecisions()
    const decided = new Map(decisions.map((d) => [d.key, d]))
    const toReview = found.filter((f) => !decided.has(f.key))
    const orphans = decisions.filter((d) => !found.some((f) => f.key === d.key))

    // ⚠️ 報表印在 `loadBaseline` 之前——否則第一次跑會在**指名之前**就拋。
    printReport('字串屬性裡裝了結構嗎', [
      `語料 ${segments.length} 段｜lift 成功 ${lifted} 段`,
      `非原子的字串屬性 ${found.length} 個（已判定 ${found.length - toReview.length}，要看 ${toReview.length}）`,
      `⚠️ 孤兒判定 ${orphans.length} 筆——那個信號不再出現，判定可能已經不成立`,
      '',
      ...toReview.slice(0, 20).map((f) => `  ${f.key.padEnd(34)} 原子 ${String(f.atoms).padStart(4)} ｜ 非原子 ${f.kinds.length} 種   ${f.kinds.slice(0, 2).map((v) => JSON.stringify(v)).join(' · ')}`),
      '',
      '⚠️ 「非原子」不等於「錯」——註解、字串常值、格式字串本來就是文字。',
      '   判定寫在 tests/assets/string-property-decisions.json，而**每一筆要有理由**。',
    ])

    expect(lifted, 'lift 成功的一段都沒有 → 語料沒撈到，這一條不算數').toBeGreaterThan(50)

    // ⚠️ 產基線那一趟要**先寫再比**——`assertCorpus` 在基線不存在時會拋，
    //    而那會讓「第一次跑」連基線都產不出來。
    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          note: '字串屬性不得裝結構。「非原子」不等於錯——判定在 tests/assets/string-property-decisions.json。\n'
            + '🔴 而語料乾淨不代表模型對：它代表語料是照著模型長的。',
          ratchet: RATCHET_NOTE,
        },
        // ⚠️ **扁平**——`withBaseline` 讀的是頂層那一格（`guardrail.ts` 檔頭寫著）。
        // ⚠️ **加引號**：不加的話它們是【識別字】，而第四十條禁止中文識別字。
        '語料段數': segments.length,
        '要看': toReview.length,
        '孤兒判定': orphans.length,
        details: toReview.map((f) => f.key),
      })
      return
    }
    void loadBaseline(GUARD)
    // 🔴 入口條件錨在**語料段數**——它不會因為屬性被改成接點而變小。
    //    ⚠️ 不錨在「掃到幾個字串屬性」：那個數字**會在這條護欄成功的那天變小**。
    assertCorpus([['語料段數', segments.length]], GUARD)
    assertRatchet([['要看', toReview.length], ['孤兒判定', orphans.length]], GUARD,
      { detail: toReview.map((f) => f.key) })
  }, 180_000)
})
