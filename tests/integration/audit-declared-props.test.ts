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

type shape = '漏宣告' | '投影提示' | '動態編號'

interface hits {
  key: string
  concept: string
  props: string
  count: number
  shape: shape
}

interface Baseline {
  _meta: { note: string; ratchet: string }
  corpus: { segments: number; nodesWithDeclTable: number }
  missingDecl: number
  projectionHint: number
  dynamicNumbering: number
}

/**
 * 依屬性名的形狀分類。**純函式**——注入才餵得進合成輸入。
 *
 * ⚠️ 分不出來的歸「漏宣告」（最嚴格的那一桶），**不歸進不進棘輪的那兩桶**
 * ——`build-guardrail` 第 5 步：判不出來不計入安全。
 */
export function classifyProp(concept: string, props: string): shape {
  // 動態編號：`param_0_name`、`param_1_desc`——`N` 是變動的，靜態表裝不下
  if (/_\d+(_|$)/.test(props)) return '動態編號'
  // 投影提示：只影響「怎麼畫」，同一棵樹在別的投影下不需要它
  if (props === 'isElseIf' || props === 'container_kind') return '投影提示'
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

function declTable(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const c of allCppConcepts() as unknown as { conceptId: string; properties?: ({ name: string } | string)[] }[]) {
    m.set(c.conceptId, new Set((c.properties ?? []).map((x) => (typeof x === 'string' ? x : x.name))))
  }
  return m
}

/** 語料：掃測試檔裡的 C++ 片段。**自我維護**——測試長，語料就跟著長。 */
function takeCorpus(): string[] {
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

interface result {
  segments: number
  node: number
  nodesWithDeclTable: number
  hits: hits[]
}

function measure(corpus: readonly string[]): result {
  const declare = declTable()
  const acc = new Map<string, hits>()
  const r: result = { segments: 0, node: 0, nodesWithDeclTable: 0, hits: [] }
  const walk = (n: SemanticNode): void => {
    r.node++
    const d = declare.get(n.conceptId)
    if (d) {
      r.nodesWithDeclTable++
      for (const k of Object.keys(n.properties ?? {})) {
        if (d.has(k)) continue
        const key = `${n.conceptId}.${k}`
        const old = acc.get(key)
        if (old) old.count++
        else acc.set(key, { key, concept: n.conceptId, props: k, count: 1, shape: classifyProp(n.conceptId, k) })
      }
    }
    for (const ks of Object.values(n.children ?? {})) for (const c of ks) walk(c)
  }
  for (const c of corpus) {
    try {
      const t = parser.parse(c)
      if (!t || (t.rootNode as unknown as { hasError: boolean }).hasError) continue
      const s = lifter.lift(t.rootNode as never) as SemanticNode
      if (!s) continue
      walk(s)
      r.segments++
    } catch {
      /* 解析或 lift 失敗的段落不計入——它們是語料問題，不是屬性問題 */
    }
  }
  r.hits = [...acc.values()].sort((a, b) => b.count - a.count)
  return r
}

describe('第三十四條護欄：屬性方向的宣告完整性', () => {
  // ── 健康檢查：錨在宣告表的載入量（合成量），不錨在違規數 ────────────
  it('★ 健康檢查：宣告表與語料都真的載入了', () => {
    const r = measure(takeCorpus())
    expect(r.segments, '一段語料都沒撈到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    expect(r.nodesWithDeclTable, '沒有任何節點的概念查得到宣告表 → 宣告表沒載入').toBeGreaterThan(1000)
  })

  // ── 注入：分類器（形狀分錯會讓棘輪盯錯東西） ──────────────────────
  it('★ 注入①：三種形狀要分得開', () => {
    expect(classifyProp('cpp:doc_comment', 'param_0_name')).toBe('動態編號')
    expect(classifyProp('cpp:doc_comment', 'param_12_desc')).toBe('動態編號')
    expect(classifyProp('cpp:if', 'isElseIf')).toBe('投影提示')
    expect(classifyProp('cpp:container_push', 'container_kind')).toBe('投影提示')
    expect(classifyProp('cpp:include', 'local')).toBe('漏宣告')
  })

  it('★ 注入②：認不得的屬性名歸最嚴格的那一桶，不得被默許', () => {
    // 沒有這一支，一個「什麼都歸動態編號」的分類器會讓棘輪永遠是 0。
    expect(classifyProp('cpp:whatever', 'someBrandNewProp')).toBe('漏宣告')
  })

  // ── 注入：量測本身 ────────────────────────────────────────────
  it('★ 注入③：產出了宣告裡沒有的屬性必須被報出', () => {
    // ⚠️ **第一版錨在 `cpp:include.local` 這個真實缺陷上**，而同一輪就把它補了宣告
    // ——注入當場爛掉。那是 `build-guardrail` 第 2 步記了七次的形狀，這是第八次：
    // **錨在「缺陷還在不在」上，必然會在成功的那天失效。**
    //
    // 改成錨在**合成輸入**上：直接餵一顆宣告表裡查得到、而屬性名一定不在宣告裡的節點。
    // 合成規則不隨真實世界的修復而失效。
    const fakeNode = {
      conceptId: 'cpp:include',
      properties: { header: 'string', propNeverDeclared: 'x' },
      children: {},
    } as unknown as SemanticNode
    const declare = declTable()
    expect(declare.has('cpp:include'), '宣告表沒載入 → 這支測試什麼都沒測到').toBe(true)
    const undeclared = Object.keys(fakeNode.properties).filter((k) => !declare.get('cpp:include')!.has(k))
    expect(undeclared, '合成的未宣告屬性沒被認出來 → 判定邏輯壞了').toEqual(['propNeverDeclared'])
    expect(classifyProp('cpp:include', 'propNeverDeclared')).toBe('漏宣告')
  })

  it('★ 注入④：宣告齊全的輸入不得被誤報', () => {
    // 基線非零時這一支仍不可省——它釘住的是「不亂報」，而那與「會報」是兩件事。
    const r = measure(['int main(){ int a = 1; return 0; }'])
    const missed = r.hits.filter((h) => h.shape === '漏宣告')
    expect(missed.map((h) => h.key), '一段最單純的程式不該有任何未宣告屬性').toEqual([])
  })

  // ── 棘輪 ────────────────────────────────────────────────────────
  it('漏宣告只准下降；動態編號不進棘輪', () => {
    const r = measure(takeCorpus())
    const byShape = (s: shape): hits[] => r.hits.filter((h) => h.shape === s)
    const missed = byShape('漏宣告')
    const hint = byShape('投影提示')
    const dynamic = byShape('動態編號')
    const times = (hs: hits[]): number => hs.reduce((a, b) => a + b.count, 0)

    printReport('屬性方向的宣告完整性（lift 產出的屬性，宣告裡有嗎）', [
      `語料   ${r.segments} 段｜語義節點 ${r.node}｜其中有宣告表的 ${r.nodesWithDeclTable}`,
      '',
      `  **漏宣告**   ${missed.length} 種／${times(missed)} 次 ← 棘輪盯這一欄`,
      `  投影提示     ${hint.length} 種／${times(hint)} 次   設計決定，見 draft/2026-08-10-if-else的化石`,
      `  動態編號     ${dynamic.length} 種／${times(dynamic)} 次   **宣告不了**（param_N 的 N 是變動的），不進棘輪`,
      '',
      '⚠️ **種**與**次**都記：371 次的 include.local 很可能是一行宣告的事，',
      '   而 1 次的 class_def.base_class 也是一筆。**次數排嚴重性，種數排工作量。**',
      '',
      ...missed.map((h, i) => `  ${i + 1}. ${h.key}（${h.count} 次）`),
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
        corpus: { segments: r.segments, nodesWithDeclTable: r.nodesWithDeclTable },
        missingDecl: missed.length,
        projectionHint: hint.length,
        dynamicNumbering: dynamic.length,
      })
      return
    }

    const base = loadBaseline<Baseline>(GUARD)
    assertRatchet([['漏宣告(種)', missed.length, base.missingDecl]])
  })
})
