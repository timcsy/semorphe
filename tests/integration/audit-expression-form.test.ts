/**
 * 第一百二十六條護欄：**宣告說得出的位置，形態就要做得出來**
 *
 * ## 🔴 它從哪來（2026-09-20，第 210 刀）
 *
 * 瀏覽器驗收貼了一段語料真的會出現的程式：
 *
 * ```cpp
 * while (getline(cin, s)) { … }
 * ```
 *
 * 樹是**對的**（`cpp:loop_while` → `cpp:input_line`），產碼也是對的，
 * **而積木上是一顆灰色的「直接寫運算式：getline(cin, s)」**。
 *
 * 追下去：`cpp:input_line` 的 `component.json` **早就宣告了**
 * `positions: ["statement", "expression"]`（`_positions_why` 逐字：「回傳 istream&」），
 * 而 `forms/blocks.json` 只做了語句那一個 ⟹ 渲染在運算式位置**挑不到形態**
 * ⟹ 退成逃生艙。
 *
 * > **一個宣告說得出、而形態沒做的位置，渲染時不會出聲——它會退成逃生艙。**
 *
 * ⚠️ 而**沒有任何既有的檢查看得到它**：
 *
 * ```
 * 五路完備性        🟢 render 那一路【有檔案】——它不問「有幾個形態」
 * 可拿性            🟢 工具箱裡有那顆積木——它不問「在運算式位置拿不拿得到」
 * 比對護欄          🟢 blockDef 與元件對得上——對得上的是【語句那一個】
 * ```
 *
 * ## 判準
 *
 * 一顆元件的 `positions` 含 `expression`，就要有**至少一個**能放進運算式位置的形態：
 *
 * ```
 * form: { axis: 'role', value: 'expression' }   一個身分多形態（今天的主流做法）
 * renderMapping.expressionCounterpart           舊機制，仍然有效
 * blockDef.output                               直接就是運算式積木
 * ```
 *
 * ## ⚠️ 這是一個棘輪，不是一條硬性零
 *
 * 落地時掃出 **8 顆**，而它們**不是八個「馬上要做」**——每一顆有兩種修法，
 * 而選哪一種要逐顆判斷：
 *
 * ```
 * 補形態    那個位置真的會出現（`while ((x = f()) != 0)` 這種）
 * 改宣告    `positions` 寫寬了，那個位置其實不會出現 → 拿掉 expression
 * ```
 *
 * > **一條新規則落地時先拿它掃一遍現有的資料，而掃出來的是【起點】不是缺陷帳。**
 *
 * 🔴 **而「從今天起不准再多」是硬的**：新加一顆元件時，宣告與形態必須同時到位。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport, loadBaseline, assertRatchet } from '../helpers/guardrail'

const GUARD = 'expression-form'

interface Form {
  form?: { axis?: string; value?: string }
  blockDef?: Record<string, unknown>
  renderMapping?: { expressionCounterpart?: string }
}

/** 這一組形態裡，有沒有一個放得進運算式位置。 */
function hasExpressionForm(forms: readonly Form[]): boolean {
  return forms.some(
    (f) =>
      f.form?.value === 'expression' ||
      f.renderMapping?.expressionCounterpart != null ||
      (f.blockDef != null && 'output' in f.blockDef),
  )
}

interface Row { componentId: string; role: string; formCount: number }

/**
 * 每一顆膠囊的 `component.json`——`src/components/<scope>/<name>/component.json`。
 *
 * ⚠️ **不用 `fs.globSync`**（CI 是 Node 20，第 124 條護欄在擋），
 * 而 `helpers/find-files` 那一支只走兩層，這裡是三層。
 */
function manifestFiles(): string[] {
  const root = path.join(REPO_ROOT, 'src/components')
  const out: string[] = []
  if (!fs.existsSync(root)) return out
  for (const scope of fs.readdirSync(root, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue
    const scopeDir = path.join(root, scope.name)
    for (const name of fs.readdirSync(scopeDir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue
      const f = path.join(scopeDir, name.name, 'component.json')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

function scan(): { declared: Row[]; missing: Row[] } {
  const files = manifestFiles()
  const declared: Row[] = []
  const missing: Row[] = []
  for (const file of files) {
    const decl = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      componentId: string
      role?: string
      positions?: string[]
    }
    if (!decl.positions?.includes('expression')) continue
    const formsFile = path.join(path.dirname(file), 'forms/blocks.json')
    const forms: Form[] = fs.existsSync(formsFile)
      ? (JSON.parse(fs.readFileSync(formsFile, 'utf8')) as Form[])
      : []
    const row: Row = { componentId: decl.componentId, role: decl.role ?? '(未宣告)', formCount: forms.length }
    declared.push(row)
    if (!hasExpressionForm(forms)) missing.push(row)
  }
  return { declared, missing }
}

describe('第一百二十六條護欄：宣告說得出的位置，形態就要做得出來', () => {
  const { declared, missing } = scan()

  it('★ 健康檢查：掃描真的吃到東西', () => {
    // 不可省。`positions` 的鍵名打錯的話，`declared` 是空的而下面那條會空過
    // ——這個專案發生過五列假的通過（`build-guardrail` 第 10 步）。
    expect(declared.length, '沒有任何元件宣告 expression 位置 → 掃描壞了，不是它們都沒宣告').toBeGreaterThan(10)
  })

  it('★ 注入①：一個「宣告了 expression 而沒有運算式形態」的，必須被報出', () => {
    expect(hasExpressionForm([{ blockDef: { type: 'x', previousStatement: null } }])).toBe(false)
  })

  it('★ 注入②：三種做法【每一種】都要被認可，不得只認今天的那一種', () => {
    expect(hasExpressionForm([{ form: { axis: 'role', value: 'expression' } }]), 'form 軸').toBe(true)
    expect(hasExpressionForm([{ renderMapping: { expressionCounterpart: 'x_expr' } }]), '舊機制').toBe(true)
    expect(hasExpressionForm([{ blockDef: { type: 'x', output: 'Expression' } }]), 'output').toBe(true)
  })

  it('🔴 `cpp:input_line` 必須有運算式形態——語料 16 支把讀取當迴圈條件', () => {
    // ⚠️ 指名的一條。上面的棘輪只說「不要更多」，說不出「這一顆修好了沒」
    //    ——而它是這條護欄的**誕生場景**，退回去要立刻紅。
    const row = missing.find((r) => r.componentId === 'cpp:input_line')
    expect(row, 'while (getline(cin, s)) 的積木又變回灰色逃生艙了').toBeUndefined()
  })

  it('棘輪：宣告了而沒做形態的只准下降', () => {
    const base = loadBaseline<{ declared: number; missing: number; details: string[] }>(GUARD)
    printReport('宣告的位置 vs 做出來的形態', [
      `宣告 expression  ${declared.length} 顆`,
      `🔴 沒有運算式形態 ${missing.length} 顆（棘輪）`,
      '⚠️ 每一顆有兩種修法：**補形態**（那個位置真的會出現）或**改宣告**（寫寬了）',
      ...missing.map((r) => `  ${r.componentId}  role=${r.role}  形態數=${r.formCount}`),
    ])
    assertRatchet([["沒有運算式形態的元件", missing.length, base.missing]])
  })
})
