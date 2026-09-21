/**
 * 第一百二十七條護欄：**每一個形態都要有顏色，而同一顆元件的形態要同色**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 一班學生上完 C++ 入門前幾課，老師整批回饋（`episodes/2026-09-21-一班學生上完前幾課.md`）。
 * 追第 8 課那個 bug 時打開「運算」那一格，看到的是：
 *
 * ```
 * ▭ 加 1 (++) ▾ 後置 ▾        🟢 綠
 * 把 ▭ 加上 (+=) ▾ ▭          🟢 綠
 * ++ ▾ 後置 ▾                 🔴 黑
 * 把  += ▾                     🔴 黑
 * ```
 *
 * 後兩顆是同族的**運算式形態**，而它們的 `blockDef` **沒有 `colour`**
 * ——Blockly 對沒有顏色的積木就畫成黑色。
 *
 * 全庫掃過：**只有那兩顆**（`cpp_increment_expression`／
 * `cpp_var_assign_compound_expression`），而它們剛好都在學生那一課要用的那一格裡。
 *
 * > **一個形態少了顏色不會丟錯——它會被畫成黑色，
 * > 而黑色在這個工具裡不是任何一族的顏色。**
 *
 * ⚠️ 而 `component-generate` 的檔頭**早就寫過**這條規矩
 *（「顏色：照同族的既有元件抄，不要自己挑」，2026-08-21 使用者回報過一次
 *  「顏色與 C++ 那邊不一致」）——**規矩在，而沒有機構在守**。
 *
 * ## 判準（兩條，都是硬性零）
 *
 * ```
 * ① 每一個形態的 blockDef 都要有 colour
 * ② 同一顆元件的所有形態【同色】——它們是同一個東西的不同位置，不是不同的東西
 * ```
 *
 * ⚠️ **②不是美感問題**：學生靠顏色認「這是同一種東西」，而語句版與運算式版
 * 本來就是同一顆元件。兩個顏色等於在同一個身分上製造一條假的分界。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測「顏色對不對」**——`cpp:print` 該是藍的還是綠的，那是分類的視覺編碼，
 *   由 `category-colors` 與人決定。這一條只問「有沒有」與「同不同」。
 * - **不檢測跨元件的一致**——那是 `audit-category-colour` 的事。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

interface Form { blockDef?: { type?: string; colour?: unknown }; componentId?: string; form?: { value?: string } }
interface Row { componentId: string; blockType: string; form: string; colour: string | null }

/** 每一顆膠囊的 `forms/blocks.json`——⚠️ 不用 `fs.globSync`（CI 是 Node 20）。 */
function formFiles(): string[] {
  const root = path.join(REPO_ROOT, 'src/components')
  const out: string[] = []
  if (!fs.existsSync(root)) return out
  for (const scope of fs.readdirSync(root, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue
    for (const name of fs.readdirSync(path.join(root, scope.name), { withFileTypes: true })) {
      if (!name.isDirectory()) continue
      const f = path.join(root, scope.name, name.name, 'forms/blocks.json')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

function scan(): { all: Row[]; noColour: Row[]; mixed: { componentId: string; colours: string[] }[] } {
  const all: Row[] = []
  for (const file of formFiles()) {
    for (const f of JSON.parse(fs.readFileSync(file, 'utf8')) as Form[]) {
      const bd = f.blockDef ?? {}
      all.push({
        componentId: f.componentId ?? '(沒有身分)',
        blockType: bd.type ?? '(沒有型別)',
        form: f.form?.value ?? '(預設)',
        colour: 'colour' in bd ? String(bd.colour) : null,
      })
    }
  }
  const byComponent = new Map<string, Set<string>>()
  for (const r of all) {
    if (r.colour == null) continue
    if (!byComponent.has(r.componentId)) byComponent.set(r.componentId, new Set())
    byComponent.get(r.componentId)!.add(r.colour)
  }
  return {
    all,
    noColour: all.filter((r) => r.colour == null),
    mixed: [...byComponent.entries()]
      .filter(([, cs]) => cs.size > 1)
      .map(([componentId, cs]) => ({ componentId, colours: [...cs] })),
  }
}

describe('第一百二十七條護欄：每一個形態都要有顏色，而同一顆元件的形態要同色', () => {
  const { all, noColour, mixed } = scan()

  it('★ 健康檢查：掃描真的吃到東西', () => {
    // 不可省。路徑寫錯的話 `all` 是空的，而下面兩條硬性零會【空過】
    // ——這個專案發生過五列假的通過（`build-guardrail` 第 10 步）。
    expect(all.length, '一個形態都沒掃到 → 掃描壞了，不是它們都沒問題').toBeGreaterThan(300)
  })

  it('🔴 硬性零：每一個形態都有顏色', () => {
    printReport('形態的顏色', [
      `形態總數      ${all.length}`,
      `🔴 沒有顏色   ${noColour.length}  ← 硬性零（Blockly 會畫成黑色）`,
      `🔴 同元件不同色 ${mixed.length}  ← 硬性零`,
      ...noColour.map((r) => `  ${r.blockType}（${r.componentId}，form=${r.form}）`),
    ])
    // ⚠️ **硬性零不是棘輪**（`build-guardrail` 第 6.8 步）：
    //    「留一筆還成立嗎」→ 不成立，一顆黑積木在畫面上就是壞的。
    //    「修法貴不貴」→ 一行 JSON，抄同族那一顆。
    expect(
      noColour.map((r) => r.blockType),
      '沒有 colour 的形態會被 Blockly 畫成黑色——抄同族那一顆的顏色',
    ).toEqual([])
  })

  it('🔴 硬性零：同一顆元件的所有形態同色', () => {
    expect(
      mixed.map((m) => `${m.componentId}: ${m.colours.join(' vs ')}`),
      '同一個身分的兩個位置用了兩種顏色——學生靠顏色認「這是同一種東西」',
    ).toEqual([])
  })

  it('★ 注入：一顆缺顏色的形態必須被認出來', () => {
    const fake: Form[] = [{ componentId: 'x:y', blockDef: { type: 'x_y' } }]
    expect(fake.filter((f) => !('colour' in (f.blockDef ?? {}))).length, '認不出來 → 上面兩條是空過的').toBe(1)
  })
})
