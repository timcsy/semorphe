/**
 * **第四十條護欄：識別字必須是英文**
 *
 * ## 它為什麼存在
 *
 * 2026-08-12 使用者指出「程式碼裡的變數或函式名出現了很多中文，應該用英文才對」。
 * 量出來是 **618 個不同的中文識別字、3918 次出現、223 個檔案**——
 * 不是誰一次寫出來的，是**兩個月裡一點一點長出來的**。
 *
 * > **一個沒有機械檢查的慣例，不會被違反一次，它會被違反到變成慣例。**
 *
 * 清完之後這條護欄接手：**硬性零**，因為「留一個在那裡，這條規範就不成立」
 * ——它不是程度問題（`build-guardrail` 6.8 的第一個問題）。
 * 而第二個問題「修一筆要付多少」在這裡也便宜：改一個識別字是機械操作。
 *
 * ## ⚠️ 它量的是「識別字」，不是「中文」
 *
 * **這些不算違規，而且不該算**：
 *
 * ```ts
 * throw new Error('視圖 id 被登錄兩次')        // 訊息是給人看的
 * type shape = '型別不符' | '缺子節點'          // 型別的**值**是領域詞彙
 * it('★ 反向：沒登錄的視圖收不到', …)           // 測試標題
 * // 一段中文註解                              // 註解
 * ```
 *
 * > **同一個詞在型別的值與物件的鍵上，只有寫法決定它是不是識別字。**
 *
 * 那條分界不是修辭——清理時它咬過一次：`compatible` 的鍵寫成
 * `型別不符: [...]`（identifier 形式），改名工具把它改了，
 * 而 `shape` 那一側的字串沒跟著改，於是查表回 `undefined`。
 * 寫成 `'型別不符': [...]` 就沒事。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測字串、註解、JSX 文字**——見上。
 * - **不檢測命名品質**（`data2`、`tmp` 這種）。它只問語言，不問好壞。
 * - **不檢測 `.json` 的鍵**——雖然它們常常就是 interface 的欄位名。
 *   ⚠️ 那是清理時最貴的一課：**一個型別的欄位名同時是一份磁碟資料的鍵時，
 *   改名有兩個現場**，而只改一邊的症狀是「讀到 undefined」，不是型別錯誤。
 */
import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

const CJK = /[一-鿿]/

/** 這份原始碼裡的中文識別字。**純函式**——注入才餵得進合成輸入。 */
export function cjkIdentifiers(source: string): string[] {
  const src = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true)
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && CJK.test(n.text)) out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(src)
  return out
}

function tsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', 'test-results', 'playwright-report'].includes(e.name)) tsFiles(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

describe('第四十條護欄：識別字必須是英文', () => {
  it('★ 入口條件：掃描真的吃到東西', () => {
    // ⚠️ 錨在**掃到幾個檔／幾個識別字**上——那是掃描的輸入量，
    // 不會因為違規被修好而變小（`build-guardrail` 第 2 步的第三個簽名）。
    const files = [...tsFiles(path.join(REPO_ROOT, 'src')), ...tsFiles(path.join(REPO_ROOT, 'tests'))]
    expect(files.length, '一個 ts 檔都沒掃到 → 量測壞了').toBeGreaterThan(200)

    let identifiers = 0
    for (const f of files.slice(0, 50)) {
      const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)
      const visit = (n: ts.Node): void => {
        if (ts.isIdentifier(n)) identifiers++
        ts.forEachChild(n, visit)
      }
      visit(src)
    }
    expect(identifiers, '一個識別字都沒解析到 → AST 沒吃到內容').toBeGreaterThan(1000)
  })

  it('★ 注入①：中文識別字必須被報出', () => {
    expect(cjkIdentifiers('const 名字 = 1')).toEqual(['名字'])
    expect(cjkIdentifiers('function 做事(參數: string) {}')).toEqual(['做事', '參數'])
    expect(cjkIdentifiers('const o = { 鍵: 1 }')).toEqual(['鍵'])
    expect(cjkIdentifiers('type T = [標籤: string]')).toEqual(['標籤'])
  })

  it('★ 注入②：字串／註解／型別的值裡的中文**不得**被報', () => {
    // 這一條不可省。沒有它，一個「掃到中文就報」的實作也能通過注入①
    // ——而那正是清理時用正則犯過的錯。
    expect(cjkIdentifiers("throw new Error('視圖被登錄兩次')")).toEqual([])
    expect(cjkIdentifiers("type S = '型別不符' | '缺子節點'")).toEqual([])
    expect(cjkIdentifiers("const o = { '鍵': 1 }")).toEqual([])
    expect(cjkIdentifiers('// 一段中文註解\nconst a = 1')).toEqual([])
    expect(cjkIdentifiers("it('★ 反向：沒登錄的收不到', () => {})")).toEqual([])
  })

  it('硬性零：`src/` 與 `tests/` 不得有中文識別字', () => {
    const files = [...tsFiles(path.join(REPO_ROOT, 'src')), ...tsFiles(path.join(REPO_ROOT, 'tests')), ...tsFiles(path.join(REPO_ROOT, 'e2e'))]
    const violations: string[] = []
    for (const f of files) {
      const found = cjkIdentifiers(fs.readFileSync(f, 'utf8'))
      if (found.length > 0) violations.push(`${path.relative(REPO_ROOT, f)}：${[...new Set(found)].join('、')}`)
    }
    expect(
      violations,
      `這些檔案裡有中文識別字（**訊息、註解、型別的值不算**——見檔頭）：\n  ${violations.join('\n  ')}`,
    ).toEqual([])
  })
})
