/**
 * **第四十一條護欄：同一個積木型別不得被定義兩次**
 *
 * ## 它從哪來
 *
 * 2026-08-14，使用者打開「陣列與列表」只看到**一顆積木**（該有 27 顆）。
 * 根因是 `block-registrar.ts` 裡：
 *
 * ```
 * :604    Blockly.Blocks['cpp_array_declare'] = { … }   ← 新加的（動態插槽）
 * :1690   Blockly.Blocks['cpp_array_declare'] = { … }   ← 既有的，**後定義的贏**
 * ```
 *
 * 新定義**從來沒有生效過**，而舊的那個引用了一個已經變成空字串的常數
 * → `appendValueInput('')` 拋錯 → **Blockly 把它吞在 flyout 的 inflater 裡**，
 * 症狀只剩「後面的積木都不見了」，console 完全乾淨。
 *
 * > **同一個鍵被賦值兩次，第二次是靜默的覆蓋。**
 *
 * ⚠️ 那兩行隔了 **1086 行**——用眼睛是看不到的，而**四十條護欄沒有一條在看它**：
 * 雙重真相護欄比的是「JSON 宣告 vs 命令式註冊」，看不到「命令式 vs 命令式」。
 *
 * ## 自我否證聲明（`build-guardrail` 第 2 步，寫在量測之前）
 *
 * > **如果「掃到的賦值總數」低於 30，代表掃描器沒讀到那個檔（或正則壞了），
 * > 這條護欄不算數——不是「重複消失了」。**
 *
 * ⚠️ 錨在**賦值總數**（合成量）上，不錨在重複筆數：重複筆數正是這條要推向零的東西。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測 JSON 與命令式之間的重複**——那是第三十四條（`audit-dual-truth`）
 * - **不檢測積木定義對不對**——只檢測「同一個鍵有沒有被賦值兩次」
 * - **不檢測跨檔的重複**——今天命令式註冊只有一個檔；有第二個時這裡要擴
 *
 * ## 硬性零，不是棘輪（第 6.8 步的兩個問題）
 *
 * | 問題 | 答案 |
 * |---|---|
 * | 留一筆在那裡，規範還成立嗎 | ❌ **不成立**——一筆重複就是一次靜默覆蓋，而「靜默」正是它的傷害 |
 * | 修一筆要付多少 | 便宜——刪掉被覆蓋的那一個，行為不變（它本來就沒生效） |
 *
 * ⚠️ **而第一次跑是綠的**（那一筆在 `040eb01` 修掉了）。按 6.5 那是個警訊，
 * 所以它靠**注入**證明自己會紅，不靠第一次的紅。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

/** 命令式註冊積木的檔案。今天只有一個——有第二個時這裡要加。 */
const SOURCES = ['src/ui/block-registrar.ts']

/** `Blockly.Blocks['x'] = ` 的賦值 */
const ASSIGN = /Blockly\.Blocks\['([a-z0-9_]+)'\]\s*=/g

interface hit {
  type: string
  file: string
  line: number
}

/** 掃一段原始碼裡的所有賦值。**吃字串而不是檔案**，注入才餵得進來。 */
function scan(source: string, file: string): hit[] {
  const out: hit[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(ASSIGN)) out.push({ type: m[1], file, line: i + 1 })
  }
  return out
}

function scanAll(): hit[] {
  return SOURCES.flatMap((f) => scan(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), f))
}

/** 同一個型別被賦值兩次以上的，連同每一次的位置 */
function duplicates(hits: hit[]): { type: string; at: string[] }[] {
  const byType = new Map<string, hit[]>()
  for (const h of hits) {
    const arr = byType.get(h.type)
    if (arr) arr.push(h)
    else byType.set(h.type, [h])
  }
  return [...byType.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([type, v]) => ({ type, at: v.map((h) => `${h.file}:${h.line}`) }))
}

describe('第四十一條護欄：同一個積木型別不得被定義兩次', () => {
  it('★ 入口條件：真的讀到那個檔了（錨在賦值總數，不錨在重複筆數）', () => {
    const hits = scanAll()
    expect(
      hits.length,
      '掃到的賦值太少 → 掃描器沒讀到檔案或正則壞了，這條護欄不算數（見檔頭的自我否證）',
    ).toBeGreaterThan(30)
  })

  it('★ 注入：同一個鍵被賦值兩次 → **必須被報出來，而且指得出兩個位置**', () => {
    const synthetic = [
      "Blockly.Blocks['zz_synthetic_one'] = { init() {} }",
      "Blockly.Blocks['zz_synthetic_two'] = { init() {} }",
      '// …隔很遠…',
      "Blockly.Blocks['zz_synthetic_one'] = { init() {} }",
    ].join('\n')
    const dups = duplicates(scan(synthetic, 'synthetic.ts'))
    expect(dups.map((d) => d.type), '重複的鍵沒被抓到').toEqual(['zz_synthetic_one'])
    // ⚠️ **釘住理由，不只釘結果**（第 8 步）：報出來還要指得出是哪兩行，
    // 否則在 2296 行的檔案裡「有重複」這個結論沒有用。
    expect(dups[0].at, '報出來了卻說不出在哪兩行').toEqual(['synthetic.ts:1', 'synthetic.ts:4'])
  })

  it('★ 注入（反向）：每個鍵各一次 → **不得亂報**', () => {
    const synthetic = [
      "Blockly.Blocks['zz_a'] = { init() {} }",
      "Blockly.Blocks['zz_b'] = { init() {} }",
      "Blockly.Blocks['zz_c'] = { init() {} }",
    ].join('\n')
    expect(duplicates(scan(synthetic, 'synthetic.ts')), '沒有重複卻報了').toEqual([])
  })

  it('★ 硬性零：真實程式碼裡不得有任何積木型別被定義兩次', () => {
    const dups = duplicates(scanAll())
    expect(
      dups.map((d) => `${d.type}  ←  ${d.at.join('  與  ')}`),
      '同一個積木型別被賦值兩次——**後定義的贏，而前面那個從來沒有生效過**。\n' +
        '⚠️ 症狀不會出現在那顆積木上：Blockly 把 init 的錯誤吞在 flyout 的 inflater 裡，\n' +
        '看到的是「那個分類後面的積木都不見了」，而 console 是乾淨的。\n' +
        '處置：刪掉被覆蓋的那一個（它本來就沒生效，刪掉行為不變）。',
    ).toEqual([])
  })
})
