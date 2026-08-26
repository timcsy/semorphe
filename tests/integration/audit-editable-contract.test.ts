/**
 * **第七十九條護欄**：宣告「我可以當真相來源」的視圖，必須**交得出那棵樹**。
 *
 * ## 它從哪來
 *
 * `core/view-host.ts` 有一個能力旗標 `editable: boolean`
 * ——「這個視圖可以當真相來源」。而它**有九個消費者**：同步協調器、
 * 「以此為準」的 QuickPick、狀態列、VSCode 主行程……
 * 第六十二條護欄還在盯著「同步的入口不得硬編視圖的名字」。
 *
 * 🔴 **而「當真相來源要提供什麼」從來不是契約**：在此之前
 * `extractSemanticTree()` 只是 `blockly-panel` 這個類別的方法。
 *
 * > **一個能力旗標宣告了「這個視圖可以當真相來源」，
 * > 而那個能力本身沒有被寫下來——那個旗標在替一個不存在的契約背書。**
 *
 * ⚠️ 它比一般的「宣告了沒人接上」更隱蔽，因為**旗標那一半做得很好**
 * ——九個消費者、一條護欄在守。壞的是另一半。
 *
 * ## ⚠️ 這條【不是】「組裝點不准叫面板的名字」
 *
 * 第一版是那樣寫的，而它**寫過頭了**：`app.ts` 那三處還一起用
 * `getBlockMappings()`／`staleReason`——它們是**積木→程式碼**那一條特定的路，
 * 而 `app.ts` 是**組裝點**，組裝點本來就認得具體的東西（`history/167`）。
 *
 * > **一條護欄如果禁止的是「組裝點做它份內的事」，它擋的不是缺陷，是分工。**
 *
 * 路線圖那條驗收的原話是「`EditableView` **契約長出來**」，不是「不准叫名字」。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「掃到的視圖宣告數」是 0，代表這支沒有讀到任何視圖，
 * > 這份報表不算數——不是「契約都實作了」。**
 *
 * 錨在**掃到幾個 ViewHost 實作**（合成量）：補一個實作不會讓它變小。
 * 🔴 **刻意不錨在「還有幾個沒實作」**——那正是要推向零的。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測那棵樹對不對**——那是來回轉換那一族護欄的地盤。
 * - **不檢測「有幾個可編輯視圖」**：今天只有積木一個實作，
 *   ⚠️ **而立契約時只有一個實作是正常的**——第二個實作（流程面板）
 *   是**驗收**，不是前提。
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'
import zhTW from '../../src/i18n/zh-TW/blocks.json'

interface ViewDecl {
  file: string
  viewId: string
  editable: boolean
  hasExtract: boolean
}

/** 從一個檔案裡讀出「它宣告了一個什麼樣的視圖」。不是視圖就回 `null`。 */
export function readViewDecl(file: string, src: string): ViewDecl | null {
  if (!/implements\s+ViewHost/.test(src)) return null
  const id = /readonly\s+viewId\s*=\s*'([^']+)'/.exec(src)
  return {
    file,
    viewId: id?.[1] ?? '(沒宣告 viewId)',
    editable: /\beditable:\s*true\b/.test(src),
    hasExtract: /\breadSource\s*\(/.test(src),
  }
}

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...tsFiles(p))
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

const views: ViewDecl[] = tsFiles(path.join(REPO_ROOT, 'src'))
  .map((f) => readViewDecl(path.relative(REPO_ROOT, f), fs.readFileSync(f, 'utf8')))
  .filter((v): v is ViewDecl => v !== null)

describe('第七十九條護欄：可編輯的視圖要交得出那棵樹', () => {
  it('★ 入口條件：掃到了視圖宣告', () => {
    expect(views.length, '一個 ViewHost 實作都沒掃到 → 下面的 0 是假的').toBeGreaterThanOrEqual(4)
  })

  it('★ 注入①：宣告可編輯而沒有那個方法 → 要被認出來', () => {
    const d = readViewDecl('x.ts', `
      class X implements ViewHost {
        readonly viewId = 'x'
        readonly capabilities = { editable: true }
      }`)
    expect(d).not.toBeNull()
    expect(d!.editable).toBe(true)
    expect(d!.hasExtract).toBe(false)
  })

  it('★ 注入②：不是視圖的檔案、以及唯讀的視圖，都不得被算進來', () => {
    // 這一條不可省。沒有它，一個「看到 editable 就報」的實作也能通過注入①。
    expect(readViewDecl('y.ts', 'export const editable = true'), '不是 ViewHost').toBeNull()
    const ro = readViewDecl('z.ts', `
      class Z implements ViewHost {
        readonly viewId = 'z'
        readonly capabilities = { editable: false }
      }`)
    expect(ro!.editable, '唯讀的視圖不必實作').toBe(false)
  })

  it('🔴 硬性零：可編輯的視圖必須有一個【給人看的名字】', () => {
    // 🔴 2026-08-26 開瀏覽器抓到：流程面板一變成可編輯，
    //    同步選單就出現「**以此為準：flow**」——`flow` 是原始 viewId。
    //
    //    機制本來就是對的（`SYNC_SOURCE_<VIEWID>`），**缺的是那個鍵**，
    //    而退路正好是 viewId 本身。
    //
    // > **一個「查不到就用鍵本身」的退路，會在有人新增一個鍵的那天把代號推上畫面。**
    //
    // ⚠️ 這一條是 `principles.md:126`（使用者看得到的所有文字都是介面）
    //    在**同步選單**上的投影——與第七十八條在流程視圖上的那一條同一個原則。
    const table = zhTW as unknown as Record<string, string>
    const missing = views
      .filter((v) => v.editable)
      .map((v) => `SYNC_SOURCE_${v.viewId.replace(/-/g, '_').toUpperCase()}`)
      .filter((k) => !table[k])
    expect(
      missing,
      '這些可編輯視圖在同步選單上會顯示**原始的 viewId**：\n  ' + missing.join('\n  '),
    ).toEqual([])
  })

  it('硬性零：宣告 `editable: true` 的視圖必須實作 `readSource`', () => {
    const bad = views.filter((v) => v.editable && !v.hasExtract).map((v) => `${v.viewId}（${v.file}）`)
    printReport('第七十九條：可編輯視圖的契約', [
      `掃到視圖宣告    ${views.length}`,
      `其中可編輯      ${views.filter((v) => v.editable).length}`,
      `缺那個方法      ${bad.length}（硬性零）`,
      ...bad.map((b) => `  🔴 ${b}`),
    ])
    expect(
      bad,
      '🔴 這些視圖宣告了「我可以當真相來源」，而**交不出那棵樹**。\n' +
        '那個旗標有九個消費者——它在替一個不存在的能力背書。',
    ).toEqual([])
  })
})
