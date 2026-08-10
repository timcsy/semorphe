/**
 * **第三十四條護欄：屬性方向的宣告完整性**——lift 產出的屬性，宣告裡有嗎。
 *
 * ## 它是 `#30` 的另一個方向
 *
 * ```
 * #30  lift 產出的**接點**，宣告裡有嗎
 * #34  lift 產出的**屬性**，宣告裡有嗎    ← 本檔
 * ```
 *
 * `experience.md`：「蓋一條護欄時多問一句——**這條規範還有沒有另一個方向？**
 * 具體做法是把規範的主詞與受詞對調再讀一次。」
 * 而 `#30` 蓋好之後，屬性那一半在**四個月裡沒有任何東西在看**。
 *
 * ## ⚠️ 它一次會開出**三種形狀**，而第三種修不了
 *
 * 規劃時先量了活性（415 段語料、9316 個有宣告表的節點）並**先分形狀**
 * ——那是 `specs/111` 的教訓（「一叢共用一個根因是假設不是結論」）：
 *
 * | 形狀 | 例 | 該怎麼辦 |
 * |---|---|---|
 * | **漏宣告** | `cpp:include.local`、`class_def.base_class` | **補宣告** |
 * | **投影提示** | `cpp:if.isElseIf`、`container_*.container_kind` | **設計決定**，不在本輪 |
 * | **動態編號** | `doc_comment.param_0_name`／`param_1_desc`… | **宣告不了**——`N` 是變動的 |
 *
 * 第三種**不是缺陷**：靜態屬性表裝不下 `param_N`。把它算進棘輪等於
 * 逼人去「修」一個修不了的東西，而那會誘發「把缺陷洗成設計」的反向操作
 * ——**替一個真的修不了的東西發明一個假的宣告**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判定屬性該不該存在**——只問「宣告裡有沒有」。
 *   `isElseIf` 該不該長在語義樹上是設計題（見 `draft/2026-08-10-if-else的化石`）。
 * - **不看接點**——那是 `#30`。
 * - **不看值**——`#29`／`param-spec` 各管一段。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「有宣告表的節點數」是 0，代表宣告表沒載入，不是世界長這樣。**
 *
 * 錨在**宣告表的載入量**上（合成量），不錨在違規數——後者正是這條護欄要
 * 推向零的東西（`build-guardrail` 第 2 步，已犯過七次的形狀）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const GUARD = 'declared-props'

type 形狀 = '漏宣告' | '投影提示' | '動態編號'

interface 命中 {
  鍵: string
  概念: string
  屬性: string
  次數: number
  形狀: 形狀
}

interface 基線 {
  _meta: { note: string; ratchet: string }
  語料: { 段數: number; 有宣告表的節點: number }
  漏宣告: number
  投影提示: number
  動態編號: number
}

/**
 * 依屬性名的形狀分類。**純函式**——注入才餵得進合成輸入。
 *
 * ⚠️ 分不出來的歸「漏宣告」（最嚴格的那一桶），**不歸進不進棘輪的那兩桶**
 * ——`build-guardrail` 第 5 步：判不出來不計入安全。
 */
export function 分類屬性(概念: string, 屬性: string): 形狀 {
  // 動態編號：`param_0_name`、`param_1_desc`——`N` 是變動的，靜態表裝不下
  if (/_\d+(_|$)/.test(屬性)) return '動態編號'
  // 投影提示：只影響「怎麼畫」，同一棵樹在別的投影下不需要它
  if (屬性 === 'isElseIf' || 屬性 === 'container_kind') return '投影提示'
  return '漏宣告'
}

let parser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

function 宣告表(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const c of allCppConcepts() as unknown as { conceptId: string; properties?: ({ name: string } | string)[] }[]) {
    m.set(c.conceptId, new Set((c.properties ?? []).map((x) => (typeof x === 'string' ? x : x.name))))
  }
  return m
}

/** 語料：掃測試檔裡的 C++ 片段。**自我維護**——測試長，語料就跟著長。 */
function 取語料(): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/`([^`]{4,600})`/g)) {
      const c = m[1].replace(/\\\\/g, '\\')
      if (!/[;{]/.test(c) || c.includes('${')) continue
      out.push(c)
    }
  }
  return out
}

interface 結果 {
  段數: number
  節點: number
  有宣告表的節點: number
  命中: 命中[]
}

function 量(語料: readonly string[]): 結果 {
  const 宣告 = 宣告表()
  const acc = new Map<string, 命中>()
  const r: 結果 = { 段數: 0, 節點: 0, 有宣告表的節點: 0, 命中: [] }
  const 走 = (n: SemanticNode): void => {
    r.節點++
    const d = 宣告.get(n.conceptId)
    if (d) {
      r.有宣告表的節點++
      for (const k of Object.keys(n.properties ?? {})) {
        if (d.has(k)) continue
        const 鍵 = `${n.conceptId}.${k}`
        const 舊 = acc.get(鍵)
        if (舊) 舊.次數++
        else acc.set(鍵, { 鍵, 概念: n.conceptId, 屬性: k, 次數: 1, 形狀: 分類屬性(n.conceptId, k) })
      }
    }
    for (const ks of Object.values(n.children ?? {})) for (const c of ks) 走(c)
  }
  for (const c of 語料) {
    try {
      const t = parser.parse(c)
      if (!t || (t.rootNode as unknown as { hasError: boolean }).hasError) continue
      const s = lifter.lift(t.rootNode as never) as SemanticNode
      if (!s) continue
      走(s)
      r.段數++
    } catch {
      /* 解析或 lift 失敗的段落不計入——它們是語料問題，不是屬性問題 */
    }
  }
  r.命中 = [...acc.values()].sort((a, b) => b.次數 - a.次數)
  return r
}

describe('第三十四條護欄：屬性方向的宣告完整性', () => {
  // ── 健康檢查：錨在宣告表的載入量（合成量），不錨在違規數 ────────────
  it('★ 健康檢查：宣告表與語料都真的載入了', () => {
    const r = 量(取語料())
    expect(r.段數, '一段語料都沒撈到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    expect(r.有宣告表的節點, '沒有任何節點的概念查得到宣告表 → 宣告表沒載入').toBeGreaterThan(1000)
  })

  // ── 注入：分類器（形狀分錯會讓棘輪盯錯東西） ──────────────────────
  it('★ 注入①：三種形狀要分得開', () => {
    expect(分類屬性('cpp:doc_comment', 'param_0_name')).toBe('動態編號')
    expect(分類屬性('cpp:doc_comment', 'param_12_desc')).toBe('動態編號')
    expect(分類屬性('cpp:if', 'isElseIf')).toBe('投影提示')
    expect(分類屬性('cpp:container_push', 'container_kind')).toBe('投影提示')
    expect(分類屬性('cpp:include', 'local')).toBe('漏宣告')
  })

  it('★ 注入②：認不得的屬性名歸最嚴格的那一桶，不得被默許', () => {
    // 沒有這一支，一個「什麼都歸動態編號」的分類器會讓棘輪永遠是 0。
    expect(分類屬性('cpp:whatever', 'someBrandNewProp')).toBe('漏宣告')
  })

  // ── 注入：量測本身 ────────────────────────────────────────────
  it('★ 注入③：產出了宣告裡沒有的屬性必須被報出', () => {
    // ⚠️ **第一版錨在 `cpp:include.local` 這個真實缺陷上**，而同一輪就把它補了宣告
    // ——注入當場爛掉。那是 `build-guardrail` 第 2 步記了七次的形狀，這是第八次：
    // **錨在「缺陷還在不在」上，必然會在成功的那天失效。**
    //
    // 改成錨在**合成輸入**上：直接餵一顆宣告表裡查得到、而屬性名一定不在宣告裡的節點。
    // 合成規則不隨真實世界的修復而失效。
    const 假節點 = {
      conceptId: 'cpp:include',
      properties: { header: 'string', 這個屬性一定不在宣告裡: 'x' },
      children: {},
    } as unknown as SemanticNode
    const 宣告 = 宣告表()
    expect(宣告.has('cpp:include'), '宣告表沒載入 → 這支測試什麼都沒測到').toBe(true)
    const 未宣告 = Object.keys(假節點.properties).filter((k) => !宣告.get('cpp:include')!.has(k))
    expect(未宣告, '合成的未宣告屬性沒被認出來 → 判定邏輯壞了').toEqual(['這個屬性一定不在宣告裡'])
    expect(分類屬性('cpp:include', '這個屬性一定不在宣告裡')).toBe('漏宣告')
  })

  it('★ 注入④：宣告齊全的輸入不得被誤報', () => {
    // 基線非零時這一支仍不可省——它釘住的是「不亂報」，而那與「會報」是兩件事。
    const r = 量(['int main(){ int a = 1; return 0; }'])
    const 漏 = r.命中.filter((h) => h.形狀 === '漏宣告')
    expect(漏.map((h) => h.鍵), '一段最單純的程式不該有任何未宣告屬性').toEqual([])
  })

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('漏宣告只准下降；動態編號不進棘輪', () => {
    const r = 量(取語料())
    const 依形狀 = (s: 形狀): 命中[] => r.命中.filter((h) => h.形狀 === s)
    const 漏 = 依形狀('漏宣告')
    const 提示 = 依形狀('投影提示')
    const 動態 = 依形狀('動態編號')
    const 次 = (hs: 命中[]): number => hs.reduce((a, b) => a + b.次數, 0)

    printReport('屬性方向的宣告完整性（lift 產出的屬性，宣告裡有嗎）', [
      `語料   ${r.段數} 段｜語義節點 ${r.節點}｜其中有宣告表的 ${r.有宣告表的節點}`,
      '',
      `  **漏宣告**   ${漏.length} 種／${次(漏)} 次 ← 棘輪盯這一欄`,
      `  投影提示     ${提示.length} 種／${次(提示)} 次   設計決定，見 draft/2026-08-10-if-else的化石`,
      `  動態編號     ${動態.length} 種／${次(動態)} 次   **宣告不了**（param_N 的 N 是變動的），不進棘輪`,
      '',
      '⚠️ **種**與**次**都記：371 次的 include.local 很可能是一行宣告的事，',
      '   而 1 次的 class_def.base_class 也是一筆。**次數排嚴重性，種數排工作量。**',
      '',
      ...漏.map((h, i) => `  ${i + 1}. ${h.鍵}（${h.次數} 次）`),
    ])

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          note:
            '屬性方向的宣告完整性：lift 產出的屬性，概念宣告的 properties 裡有嗎。\n' +
            '這是 #30（接點方向）的另一半——把規範的主詞與受詞對調再讀一次。\n' +
            '⚠️ 命中分三種形狀，而**只有「漏宣告」進棘輪**：\n' +
            '  漏宣告   補一行宣告就好\n' +
            '  投影提示 isElseIf 那類——「這顆 if 是不是 else-if」是呈現不是語義，\n' +
            '           要不要搬出語義樹是設計決定（draft/2026-08-10-if-else的化石）\n' +
            '  動態編號 param_0_name／param_1_desc——**靜態屬性表裝不下 param_N**。\n' +
            '           把它算進棘輪等於逼人去修一個修不了的東西，而那會誘發反向操作：\n' +
            '           **替一個真的修不了的東西發明一個假的宣告。**\n' +
            '⚠️ 種與次都記：371 次的 include.local 可能是一行宣告的事。**次數排嚴重性，種數排工作量。**\n' +
            '⚠️ 分類器認不得的屬性名歸「漏宣告」（最嚴格的桶），不得被默許進不進棘輪的那兩桶。',
          ratchet: RATCHET_NOTE,
        },
        語料: { 段數: r.段數, 有宣告表的節點: r.有宣告表的節點 },
        漏宣告: 漏.length,
        投影提示: 提示.length,
        動態編號: 動態.length,
      })
      return
    }

    const base = loadBaseline<基線>(GUARD)
    assertRatchet([['漏宣告(種)', 漏.length, base.漏宣告]])
  })
})
