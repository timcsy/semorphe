/**
 * **第六十條護欄：相依的方向。**
 *
 * ## 這條為什麼是「模組化」的實質
 *
 * 2026-08-24 出貨 `dist-sdk` 那一刀的結論逐字（`history/149`）：
 *
 * > **擋住模組化的是相依的方向，不是資料夾的名字。**
 *
 * 那天真正擋路的是一條邊——`languages/<lang>/pack.ts` → `ui/dynamic-dropdown-field`
 * → `blockly` → `jsdom`，於是**載入一個語言 ＝ 載入整個 Blockly**。
 * 而它是在一個 Node 專案跑起來才現形的，**花了一天**。
 *
 * > **一條護欄如果能在那條邊產生的當下就抓到它，那一天就不用付。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測 npm 相依**（`import * as Blockly from 'blockly'`）——只看 `src/` 內部的邊。
 *   語言套件 import Blockly 是**上面那條邊的症狀**，而根因是它 import 了 `ui/`。
 * - **不檢測「這個檔該住哪」**——那是判斷。這裡只問「它 import 的方向對不對」。
 * - **不區分型別與值**：`import type` 一樣算。**要把一層剪下來出貨時，
 *   一個型別相依與一個值相依一樣會斷。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果這支護欄在「`languages/` 真的 import 了 `ui/`」的情況下還報零，
 * > 代表它的路徑解析壞了——那是工具壞了，不是世界乾淨。**
 *
 * 判斷依據是 `★ 合成注入`那幾支（餵合成的檔案路徑與 import 字串），
 * **不是**真實那個數字。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { printReport, assertRatchet, assertCorpus, REPO_ROOT } from '../helpers/guardrail'

/** 誰不准 import 誰。**空集合＝那一層可以 import 任何東西**（沒有這種層） */
const FORBIDDEN: Record<string, ReadonlySet<string>> = {
  core: new Set(['ui', 'languages', 'components', 'vscode']),
  interpreter: new Set(['ui', 'vscode']),
  languages: new Set(['ui', 'vscode']),
  components: new Set(['ui', 'vscode']),
  ui: new Set(['languages', 'vscode']),
}

/**
 * **組裝點的具名豁免**——它知道自己裝了哪些語言，那是它的工作。
 *
 * ⚠️ 而豁免要**附上數字**（`neutrality` 基線那條的同一個紀律）：
 * 一句「它是組裝點所以沒關係」而不印數字，等於一個沒有上限的洞。
 */
const COMPOSITION_ROOT = 'src/ui/app.ts'

export function layerOf(file: string): string | null {
  const parts = file.split('/')
  return parts[0] === 'src' && parts.length > 1 ? parts[1] : null
}

/** 判定一條邊。**純函式**，所以注入餵得進合成輸入 */
export function violates(file: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const from = layerOf(file)
  if (!from || !FORBIDDEN[from]) return null
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))
  const to = layerOf(resolved)
  if (!to || to === from) return null
  return FORBIDDEN[from].has(to) ? `${from} → ${to}` : null
}

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(rel)
    }
  }
  walk('src')
  return out
}

interface Edge { file: string; spec: string; kind: string }

function scan(): { edges: Edge[]; exempt: Edge[]; files: number } {
  const edges: Edge[] = []
  const exempt: Edge[] = []
  const files = sourceFiles()
  for (const f of files) {
    const src = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')
    for (const m of src.matchAll(/from '([^']+)'/g)) {
      const kind = violates(f, m[1])
      if (!kind) continue
      ;(f === COMPOSITION_ROOT ? exempt : edges).push({ file: f, spec: m[1], kind })
    }
  }
  return { edges, exempt, files: files.length }
}

/** `languages/` 與 `components/` 的 scope 集合——不一致就是改名的觸發（見 draft §五） */
function scopes(dir: string): string[] {
  return fs
    .readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

const result = scan()

describe('護欄：相依的方向（第六十條）', () => {
  it('★ 合成注入：語言套件 import 視圖層【必須】被抓到', () => {
    expect(
      violates('src/languages/zzz/pack.ts', '../../ui/some-field'),
      '這正是 2026-08-24 花了一天才在 Node 裡現形的那條邊',
    ).toBe('languages → ui')
  })

  it('★ 合成注入：核心 import 語言【必須】被抓到', () => {
    expect(violates('src/core/x.ts', '../languages/cpp/y')).toBe('core → languages')
  })

  it('★ 合成注入：正確的方向不得亂報', () => {
    expect(violates('src/ui/panels/p.ts', '../../core/view-host'), '視圖 import 核心是對的').toBeNull()
    expect(violates('src/languages/cpp/pack.ts', '../../core/messages'), '語言 import 核心是對的').toBeNull()
    expect(violates('src/core/a.ts', './b'), '同層互相 import 不管').toBeNull()
    expect(violates('src/ui/x.ts', 'blockly'), 'npm 相依不在這條護欄的範圍').toBeNull()
  })

  it('★ 入口條件：真的掃到檔案了（不是掃到空目錄）', () => {
    // ⚠️ 錨在**輸入量**上：檔案數只會隨著專案長大，不會因為違規被修好而變小
    expect(result.files, '一個檔都沒掃到 → 下面那個零是假的').toBeGreaterThan(300)
  })

  it('🔴 硬性零：核心不得 import 視圖——**P9 的不變式逐字是這一條**', () => {
    // 「Core 不 import View。View 間零 import。跨層通訊只走 Bus。」（principles.md:176）
    const coreToUi = result.edges.filter((e) => e.kind === 'core → ui')
    expect(coreToUi.map((e) => `${e.file} → ${e.spec}`), '留一筆，「核心可獨立出貨」那句話就是假的').toEqual([])
  })

  it('棘輪：其餘的跨層相依只准下降', () => {
    printReport('相依的方向（第六十條）', [
      `掃描 ${result.files} 個檔`,
      '',
      `違規：${result.edges.length} 筆`,
      ...result.edges.map((e) => `  ${e.kind.padEnd(22)} ${e.file}  →  ${e.spec}`),
      '',
      `組裝點的具名豁免（${COMPOSITION_ROOT}）：${result.exempt.length} 筆`,
      '  ⚠️ 豁免附上數字——「它是組裝點所以沒關係」而不印數字，等於一個沒有上限的洞。',
    ])
    assertCorpus([['掃描檔數', result.files]], 'layering')
    assertRatchet(
      [['跨層相依', result.edges.length], ['組裝點豁免', result.exempt.length]],
      'layering',
      { detail: result.edges.map((e) => `${e.kind}｜${e.file} → ${e.spec}`) },
    )
  })

  it('🔔 觸發器：`languages/` 與 `components/` 的 scope 一旦不對稱，就是改名的時候', () => {
    const l = scopes('src/languages')
    const c = scopes('src/components')
    // 🔴 這一條**今天是綠的**，而它存在的理由是「等一陣子」需要一個會自己響的鬧鐘
    //    （`draft/2026-08-12-目錄結構對硬體的適配` §五：
    //     「元件套件管理——連十二輪標熟而未升格。**F 完成了，那個理由失效了，
    //      而項目還在原地。**」）
    //    硬體進來的那天 `components/` 會多一個 `arduino/` 而 `languages/` 不會
    //    ——**因為硬體不是語言**，那時 `languages/` 這個名字才真的變成謊。
    expect(
      c,
      `languages/=[${l}] 而 components/=[${c}]——不對稱出現了。\n` +
        '這是 `draft/2026-08-12-目錄結構對硬體的適配` §二 說的那一刻：\n' +
        '「`languages/` 這個名字，硬體一進來就變成謊」。回去重讀那一份，那是改名的觸發。',
    ).toEqual(l)
  })
})
