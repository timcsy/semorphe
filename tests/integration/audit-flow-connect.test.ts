/**
 * **第八十條護欄**：在流程視圖上拉的線，**只有一種是真的**——父子關係。
 *
 * ## 它從哪來
 *
 * `draft/語義樹只有樹沒有邊 §六` 逐字：
 *
 * > **接線圖是那個閘門**：它一進來就必須回答 A／B，**而不是繞過去**
 * > （繞過去的方法很誘人：把接線存進 `metadata`。
 * >  那會讓邊變成一個沒有型別的角落）
 *
 * 語義樹**只有樹，沒有邊**。所以流程視圖上的線只有一種是真的：
 * 「**讓這一顆變成那一格的子節點**」。其餘的——兄弟連兄弟、連到自己的祖先、
 * 連到一個沒有宣告的位置——**不是「還沒支援」，是【表達不出來】**。
 *
 * > **一個表達不出來的東西，誠實的處置是說出來，不是找個角落塞進去。**
 *
 * ## ⚠️ 這條為什麼要在「拉線」那個功能【之前】
 *
 * 先做拉線的話，「這條線存哪」會在寫 UI 的時候被順手決定，
 * **而最順手的地方就是 `metadata`**。
 * → 規則先立、護欄先蓋，(c) 拉線只能照著它做。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果注入那幾支一支都沒紅過，代表判定函式沒被呼叫到，
 * > 這份綠燈不算數——不是「規則成立」。**
 *
 * 錨在**這支自己造的合成樹的節點數**上（合成量）：它不隨任何修復變小。
 * 🔴 **刻意不錨在「還有幾處塞 metadata」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 UI**（拉線的手勢、游標、預覽線）——那是 (c) 的事。
 * - **不檢測「拒絕的訊息好不好」**——只檢測它**說得出一個理由**，
 *   而且那個理由**不是內部詞彙**。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { tryConnect, refusalKeyOf } from '../../src/core/flow/connect'
import { REPO_ROOT, printReport } from '../helpers/guardrail'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
import type { SemanticNode } from '../../src/core/types'

beforeAll(() => registerCppLanguage())

/**
 * 這一行在把**接線**塞進 `metadata` 嗎。
 *
 * ⚠️ `metadata` 本來就有正當的用途（`sourceRange`／`degradationCause`）
 * ——判準是**那個鍵長得像一條邊**，不是「有沒有碰 metadata」。
 */
export function smugglesEdge(line: string): boolean {
  if (/^\s*(\*|\/\/)/.test(line)) return false
  return (
    // ⚠️ `?.` 之後**直接**接屬性名（`metadata?.connections`），中間沒有第二個點。
    //    第一版寫成 `(\?\.)?\s*\.` ——那要求了一個多餘的點，於是漏掉那個寫法。
    /metadata\s*(\?)?\.\s*(wires?|edges?|links?|connections?)\b/.test(line) ||
    /metadata\s*(\?\.)?\s*\[\s*['"](wires?|edges?|links?|connections?)['"]/.test(line)
  )
}

/** 一棵合成的樹：`main` 裡有一個宣告與一個迴圈。 */
const tree = (): SemanticNode =>
  ({
    id: 'root', componentId: 'cpp:program', properties: {},
    children: {
      body: [{
        id: 'F', componentId: 'cpp:func_def', properties: { name: 'main' },
        children: {
          body: [
            { id: 'D', componentId: 'cpp:var_declare', properties: { name: 'x' },
              children: { initializer: [{ id: 'N', componentId: 'cpp:literal_number', properties: { value: '0' }, children: {} }] } },
            { id: 'L', componentId: 'cpp:loop_count', properties: {}, children: {} },
          ],
        },
      }],
    },
  }) as unknown as SemanticNode

describe('第八十條護欄：流程視圖上的線只有父子關係', () => {
  it('★ 入口條件：合成樹真的建起來了', () => {
    let n = 0
    const walk = (x: SemanticNode): void => { n++; for (const b of Object.values(x.children ?? {})) for (const c of b ?? []) walk(c) }
    walk(tree())
    expect(n, '合成樹是空的 → 下面的判定在對空氣').toBeGreaterThanOrEqual(5)
  })

  it('🔴 合法：把一個運算式接到一個宣告過的資料位置', () => {
    const v = tryConnect(tree(), 'N', 'D', 'initializer')
    expect(v.ok, '這一條【應該】接得起來——不然拉線這個功能沒有意義').toBe(true)
  })

  it('🔴 拒絕：那一格不是這顆宣告過的位置', () => {
    const v = tryConnect(tree(), 'N', 'D', 'no_such_thing')
    expect(v).toEqual({ ok: false, reason: 'no-such-slot' })
  })

  it('🔴 拒絕：會接成一個環（接到自己的子孫、或自己）', () => {
    expect(tryConnect(tree(), 'D', 'N', 'value')).toEqual({ ok: false, reason: 'would-cycle' })
    expect(tryConnect(tree(), 'D', 'D', 'initializer')).toEqual({ ok: false, reason: 'would-cycle' })
  })

  it('🔴 拒絕：那一格宣告要【某一種身分】，而來的不是那一種', () => {
    // 🔴 2026-08-26 開瀏覽器抓到：把一個數字接進 `cpp:func_def` 的 `params`
    //    （宣告 `params: "param_decl"`）**接得上**，產出 `int main(int)`。
    //    在此之前只判「語句 vs 運算式」。
    //    > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
    const v = tryConnect(tree(), 'N', 'F', 'params')
    expect(v).toEqual({ ok: false, reason: 'wrong-kind' })
  })

  it('🔴 拒絕：那一格要的是語句，而來的是運算式', () => {
    const v = tryConnect(tree(), 'N', 'L', 'body')
    expect(v).toEqual({ ok: false, reason: 'wrong-kind' })
  })

  it('🔴 每一個拒絕的理由都要有一句【人看得懂的話】', () => {
    // ⚠️ 畫面上不得出現 `not-parent-child` 這種字——與第七十八條同一個原則
    //    （`principles.md:126`：使用者看得到的所有文字都是介面）。
    const reasons = ['no-such-slot', 'would-cycle', 'not-parent-child', 'wrong-kind'] as const
    const table = zhTW as unknown as Record<string, string>
    const missing = reasons.map(refusalKeyOf).filter((k) => !table[k])
    expect(missing, `這些拒絕理由沒有文案，畫面上會出現代號：\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('★ 注入：判定「塞進 metadata」的那個偵測器認得出違規', () => {
    // 🔴 第四十九條護欄抓到的：這一支會掃東西、會數數，
    //    而**沒有人證明過它的偵測器認得出違規**——偵測器壞掉時它會全綠。
    expect(smugglesEdge("      node.metadata.wires = [...]"), '直接塞').toBe(true)
    expect(smugglesEdge("  n.metadata['edges'] = e"), '用字串鍵塞').toBe(true)
    expect(smugglesEdge("    const w = node.metadata?.connections"), '讀回來也算——有人寫進去了').toBe(true)
  })

  it('★ 注入②：不是那件事的都不得被報', () => {
    // 這一條不可省。沒有它，一個「看到 metadata 就報」的實作也能通過注入①
    // ——而 `metadata` 本來就有正當的用途（`sourceRange`／`degradationCause`）。
    expect(smugglesEdge('    const cause = n.metadata?.degradationCause'), '正當的用途').toBe(false)
    expect(smugglesEdge(' * 繞過去的方法很誘人：把接線存進 `metadata`'), '註解').toBe(false)
    expect(smugglesEdge('    // node.metadata.wires = x'), '被註解掉的').toBe(false)
  })

  it('🔴 硬性零：接線不得被塞進 `metadata`', () => {
    // 🔴 這是那份 draft 明文點名的「繞過去的方法」，而它**很誘人**：
    //    `metadata` 是自由欄位，塞進去今天就會動。
    //    > 那會讓邊變成一個沒有型別的角落。
    const scan = (dir: string): string[] => {
      const out: string[] = []
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) out.push(...scan(p))
        else if (e.name.endsWith('.ts')) out.push(p)
      }
      return out
    }
    const bad: string[] = []
    for (const f of scan(path.join(REPO_ROOT, 'src/ui/panels'))) {
      const src = fs.readFileSync(f, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (smugglesEdge(line)) bad.push(`${path.relative(REPO_ROOT, f)}:${i + 1}  ${line.trim().slice(0, 70)}`)
      })
    }
    printReport('第八十條：流程視圖的接線', [
      `拒絕理由      4 種，都有文案`,
      `塞進 metadata ${bad.length}（硬性零）`,
      ...bad.map((b) => `  🔴 ${b}`),
    ])
    expect(
      bad,
      '🔴 有人把接線塞進 `metadata`——**那會讓邊變成一個沒有型別的角落**。\n' +
        '語義樹只有樹沒有邊；接線圖進來時必須回答 A／B，而不是繞過去。',
    ).toEqual([])
  })
})
