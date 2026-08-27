/**
 * **第八十二條護欄：手拖的佈局，活得過一次編輯嗎**。
 *
 * ## 它從哪來
 *
 * 路線圖把這件事寫成一個開放問句（`vision.md`「**nodeId 穩不穩定**——不穩就對不回去」）。
 * 2026-08-27 量出答案，而它比「不穩」更硬：
 *
 * ```
 * 瀏覽器實測（改一行不相干的程式碼，再同步一次）
 *   節點      9 → 11
 *   id 相同    0     ← 連【沒有變】的 func_def／program 都換了 id
 * ```
 *
 * `semantic-tree.ts` 的 `generateId()` 是 `node_${++idCounter}_${Date.now()...}`
 * ——計數器與時戳兩個都會變，所以這是**設計上必然**，不是偶然。
 *
 * 🔴 而它不只是「還沒持久化」：面板的 `rebuild()` 會刪掉不在新樹裡的位移，
 * 於是**使用者手拖十顆節點、在程式碼裡打一個字，十顆全部跳回自動排版的位置**。
 *
 * ## 這支先量、後挑——而那是照著一條教訓做的
 *
 * `experience.md:401` 逐字：「**判準本身可以是對的，把它自動化的第一版仍然會量錯。**
 * 靜態判斷要先在已知答案的樣本上驗過再拿來下結論。」
 *
 * 所以 `core/flow/layout-key.ts` **同時匯出三個候選**，這裡在三種真實編輯上量它們。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「掃到的節點數」是 0，代表 parser 或 lifter 沒起來，這份報表不算數
 * > ——不是「三個候選都完美」。**
 *
 * 錨在**掃到幾顆節點**（合成量：語料的大小）。⚠️ 它**不會**因為某個候選變好而變小。
 * 🔴 刻意不錨在「對不回去的筆數」——那正是要推向零的。
 *
 * ## 🔴 而這支的第一版量的是【空氣】——同一輪第二次
 *
 * `lineOf` 讀 `metadata.startLine`，而真正的路徑是 `metadata.sourceRange.startLine`。
 * 於是每一顆都回 `null`、每一顆的鍵都是 `<身分>@?`，八顆節點摺成五個鍵，
 * 而報表印出：
 *
 * ```
 * 結構路徑  83%   程式碼行  100%   ← 🔴 它量的是「有幾個不同的 componentId」
 * ```
 *
 * > **一個把所有輸入都映到同一個鍵的函式，會得到完美的存活率。**
 *
 * ⚠️ 抓到它的不是斷言，是**「5/5 而另外兩欄是 /8」那個不對稱**。
 * 而檔頭上方那句「用抬升順序當代理會讓候選 B 免費贏，所以不那樣做」
 * ——**我寫了那句話，然後用另一種方式讓它免費贏了。**
 *
 * 🟢 機制（散文擋不住）：下面補一條入口條件，**錨在「拿得到行號的節點數」**。
 * 它是合成量（語料裡有幾顆有位置資訊），不會因為某個候選變好而變小。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測面板真的有沒有用那把鑰匙**——那是 `flow-panel` 的事，由 e2e 釘
 * - **不檢測「對不回去時有沒有出聲」**——那是 P6，由單元測試釘
 * - ⚠️ **不檢測跨語言**：語料是 C++。Python 的形狀不同（縮排改動會動更多節點）
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { printReport, assertCorpus, assertRatchet, writeBaseline } from '../helpers/guardrail'
import {
  walkWithPath, keyByPath, keyByLine, keyByContent, sameLineIndexes, matchNodes,
  type KeyedNode,
} from '../../src/core/flow/layout-key'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const GUARD = 'layout-key'

let tp: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tp = new Parser()
  tp.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (src: string): SemanticNode =>
  lifter.lift(tp.parse(src)!.rootNode as never) as unknown as SemanticNode

/**
 * ⚠️ 這裡的「行號」用**節點在來源裡的起始行**，而測試拿不到 `CodeMapping`
 * （那是同步管線給的）。用**抬升順序當代理**會讓候選 B 免費贏，所以不那樣做
 * ——改成從節點自己的位置算，拿不到就是 `null`（而 `null` 算「對不回去」）。
 */
const lineOf = (n: SemanticNode): number | null => {
  const m = (n as unknown as { metadata?: { sourceRange?: { startLine?: number } } }).metadata
  const l = m?.sourceRange?.startLine
  return typeof l === 'number' ? l : null
}

const keysOf = (root: SemanticNode): { path: Set<string>; line: Set<string>; content: Set<string> } => {
  const nodes: KeyedNode[] = walkWithPath(root).map((k) => ({ ...k, line: lineOf(k.node) }))
  const idx = sameLineIndexes(nodes)
  return {
    path: new Set(nodes.map(keyByPath)),
    line: new Set(nodes.map((k, i) => keyByLine(k, idx[i]))),
    content: new Set(nodes.map(keyByContent)),
  }
}

/** 三種真實編輯，各一組「改動前／改動後」。 */
const SAMPLES: { name: string; before: string; after: string }[] = [
  {
    name: '改一個值（最常見的編輯）',
    before: 'int main() {\n  int x = 1;\n  int y = 2;\n  return 0;\n}',
    after: 'int main() {\n  int x = 1;\n  int y = 9;\n  return 0;\n}',
  },
  {
    name: '在後面加一行',
    before: 'int main() {\n  int x = 1;\n  int y = 2;\n  return 0;\n}',
    after: 'int main() {\n  int x = 1;\n  int y = 2;\n  int z = 3;\n  return 0;\n}',
  },
  {
    name: '在中間插一個兄弟',
    before: 'int main() {\n  int x = 1;\n  int y = 2;\n  return 0;\n}',
    after: 'int main() {\n  int x = 1;\n  int w = 7;\n  int y = 2;\n  return 0;\n}',
  },
]

describe('第八十二條護欄：手拖的佈局活得過一次編輯嗎', () => {
  it('🔴 `nodeId` 完全對不回去——這是【前提】，不是可以改善的數字', () => {
    // 這一條把那個開放問句釘死。它**不進棘輪**：`generateId()` 的形狀
    // 決定了它永遠是 0，而那正是「不能用 nodeId 當鑰匙」的證據。
    const a = lift(SAMPLES[0].before)
    const b = lift(SAMPLES[0].after)
    const idsA = new Set(walkWithPath(a).map((k) => k.node.id))
    const shared = walkWithPath(b).filter((k) => idsA.has(k.node.id)).length
    expect(idsA.size, '入口條件：一顆節點都沒抬升出來 → 下面在比空集合').toBeGreaterThan(3)
    expect(
      shared,
      '🔴 nodeId 竟然穩定了 → 那 `generateId()` 被改過，這條護欄的前提要重寫',
    ).toBe(0)
  })

  it('★ 注入：判定函式認得出「配得上」與「配不上」', () => {
    // ⚠️ 第三十五／注入完備性那兩條護欄要的就是這一支：
    // **這支護欄會掃東西、會數數，而沒有人證明過它的偵測器認得出違規。**
    // 偵測器壞掉時它會全綠，而報表上的百分比看起來一樣漂亮。
    //
    // 🔴 餵的是**合成的**節點（`x:` 開頭），不是真實身分——
    // `build-guardrail` §2 簽名三：注入裡出現真實身分，
    // 那個東西被修好的那天這支就爛了。
    const mk = (id: string, c: string, v?: string): SemanticNode =>
      ({ id, componentId: c, properties: v === undefined ? {} : { value: v }, children: {} }) as never
    const wrap = (kids: SemanticNode[]): SemanticNode =>
      ({ id: 'r', componentId: 'x:program', properties: {}, children: { body: kids } }) as never

    const A = walkWithPath(wrap([mk('a', 'x:n', '1')]))
    // ① 一模一樣 → 配得上
    const same = walkWithPath(wrap([mk('a2', 'x:n', '1')]))
    expect(matchNodes(A, same).get('a'), '🔴 一模一樣都配不上 → 偵測器壞了').toBe('a2')
    // ② 完全不同 → 配不上（而**不是**硬湊一個）
    const other = walkWithPath(wrap([mk('z', 'x:other', '9')]))
    expect(
      matchNodes(A, other).get('a'),
      '🔴 配到一顆完全不同的節點上 → 佈局會跑到別人身上',
    ).toBeUndefined()
  })

  it('★ 量三個候選，逐項印出來——**先量後挑**', () => {
    let scanned = 0
    /** 🔴 **拿得到行號的節點數**——候選 B 的入口條件。第一版是 0，而它印出 100%。 */
    let withLine = 0
    const survived: Record<string, number> = { path: 0, line: 0, content: 0, all: 0 }
    const total: Record<string, number> = { path: 0, line: 0, content: 0, all: 0 }
    const rows: string[] = []

    for (const s of SAMPLES) {
      const beforeTree = lift(s.before)
      withLine += walkWithPath(beforeTree).filter((k) => lineOf(k.node) !== null).length
      const A = keysOf(beforeTree)
      const B = keysOf(lift(s.after))
      scanned += A.path.size
      // 候選 D：三把一起用
      const nodesA = walkWithPath(beforeTree).map((k) => ({ ...k, line: lineOf(k.node) }))
      const afterTree = lift(s.after)
      const nodesB = walkWithPath(afterTree).map((k) => ({ ...k, line: lineOf(k.node) }))
      const matched = matchNodes(nodesA, nodesB).size
      survived.all += matched
      total.all += nodesA.length

      const cells: string[] = []
      for (const kind of ['path', 'line', 'content'] as const) {
        const kept = [...A[kind]].filter((k) => B[kind].has(k)).length
        survived[kind] += kept
        total[kind] += A[kind].size
        cells.push(`${kind} ${kept}/${A[kind].size}`)
      }
      cells.push(`三把 ${matched}/${nodesA.length}`)
      rows.push(`${s.name.padEnd(22)} ${cells.join('  ')}`)
    }

    const pct = (k: string): string =>
      total[k] === 0 ? '—' : `${Math.round((survived[k] / total[k]) * 100)}%`

    printReport('第八十二條：佈局鑰匙的三個候選', [
      ...rows,
      '',
      `結構路徑 ${pct('path')}  程式碼行 ${pct('line')}  內容雜湊 ${pct('content')}  🟢 三把一起 ${pct('all')}`,
      `拿得到行號的節點  ${withLine}／${scanned}  ← 候選 B 的入口條件（第一版是 0 而它印 100%）`,
      '⚠️ 這裡量的是「改動前的鑰匙，改動後還找得到嗎」——找不到＝那顆的佈局會掉。',
    ])

    // ★ 入口條件——錨在**掃到幾顆**（合成量），見檔頭的自我否證
    expect(
      scanned,
      '🔴 一顆節點都沒掃到 → parser／lifter 沒起來，這份報表不算數。' +
        '⚠️ 這【不代表】三個候選都完美。',
    ).toBeGreaterThan(10)

    // 🔴 **棘輪盯的是「對不回去的筆數」**（低者為佳），不是存活數——
    //    `assertRatchet` 的方向是 `now > base ＝ 惡化`，而「存活數變小」才是惡化。
    //    存活數在報表上看得到，那是給人讀的；棘輪讀的是它的補集。
    const lost = {
      pathLost: total.path - survived.path,
      lineLost: total.line - survived.line,
      contentLost: total.content - survived.content,
      allLost: total.all - survived.all,
    }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, { totalKeys: total.path, withLine, ...lost })
    }
    // ★ 入口條件（合成量）——兩條，而第二條是第一版翻車補上的
    assertCorpus([['totalKeys', total.path], ['withLine', withLine]], GUARD)
    assertRatchet(
      [['pathLost', lost.pathLost], ['lineLost', lost.lineLost],
       ['contentLost', lost.contentLost], ['allLost', lost.allLost]],
      GUARD,
    )
  })
})
