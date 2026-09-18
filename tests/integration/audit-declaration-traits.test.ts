/**
 * **第一百二十一條護欄：一個宣告要答得出「我放得進 for 的第一格嗎」**
 *
 * ## 🔴 它從哪來（2026-09-18，同一個病的**第三次**）
 *
 * `canBeForLoopPart(componentId)` 是 for 迴圈三格的白名單，而它的預設是保守的：
 * **沒宣告 ＝ 不行**。那個預設本身是對的（見 `node-traits.ts`）——
 * 錯的是**沒有人在加一顆宣告式元件時被問到這一題**。
 *
 * ```
 * 2026-09-06 之前   cpp:var_declare            🟢 宣告了
 * 2026-09-17        cpp:var_declare_auto       🔴 沒宣告 → for (auto it = v.begin(); …) 整段掉進 raw code
 * 2026-09-18        cpp:pointer_declare        🔴 沒宣告 → for (int* p = begin(a); …) 整段掉進 raw code
 *                   ——而那一天量出來，**27 顆宣告式元件裡有 25 顆沒宣告**
 * ```
 *
 * 每一次的症狀都一樣，而且都很難讀：錯誤訊息指著**那一整段初始化子**
 * （`UNRECOGNIZED_CODE: int* p = begin(a)`），沒有指著少掉的那個宣告。
 * 學生會以為是 `begin()` 不支援。
 *
 * > **同一族的元件，一顆宣告了某個性質而其餘沒有——
 * > 那個差別不會有人發現，直到有人寫出只有前者能表達的程式。**
 *
 * ## 判準
 *
 * 「我放得進 for 的第一格」在 C++ 裡是一個**文法事實**，不是風格偏好：
 * `for (T x = …; …; …)` 對任何宣告都成立。所以這條護欄是**硬性零**，不是棘輪
 * ——一顆宣告式元件不宣告它，就是漏了。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「宣告式元件」數是 0，代表掃描器壞了，不是世界長這樣。**
 *
 * 所以下面第一支是**正向錨點**：先證明量得到東西，負向斷言才有意義。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判定那個值該是 true 還是 false**——它問的是「有沒有答」。
 *   而今天答案全是 true，因為那是文法事實；哪一天有一顆真的不行，
 *   它要在自己的 `_traits_why` 裡寫出理由，並且進下面那張豁免表。
 * - **不看 for 的第二、三格**——那兩格收的是運算式，不是宣告。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

interface Manifest {
  componentId: string
  traits?: Record<string, unknown>
  role?: string
}

/**
 * **這顆元件是一個宣告嗎。**
 *
 * ⚠️ 判準刻意用**三個來源的聯集**，而不是只看名字：
 * 名字結尾（`*_declare`）· 自己宣告的 `declarator` 性質 · `var_declare*` 前綴。
 * 只看名字的話 `cpp:var_declare_sequence`（結構化繫結）會漏掉。
 */
function isDeclaration(dir: string, m: Manifest): boolean {
  return dir.endsWith('_declare')
    || (m.traits ?? {}).declarator === true
    || dir.startsWith('var_declare')
}

/**
 * **刻意不宣告的**——今天是空的。
 * 一顆進這張表要在自己的 `_traits_why` 裡寫出「為什麼 C++ 的文法在這裡不成立」。
 */
const EXEMPT = new Set<string>()

function scan(): { all: Manifest[]; decls: { id: string; dir: string; ok: boolean }[] } {
  const roots = ['src/components/cpp', 'src/components/python', 'src/components/hw']
  const all: Manifest[] = []
  const decls: { id: string; dir: string; ok: boolean }[] = []
  for (const r of roots) {
    const abs = path.join(REPO_ROOT, r)
    if (!fs.existsSync(abs)) continue
    for (const dir of fs.readdirSync(abs)) {
      const f = path.join(abs, dir, 'component.json')
      // ⚠️ `src/components/README.md` 不是一個膠囊——2026-09-18 它弄紅過另一條護欄
      if (!fs.existsSync(f) || !fs.statSync(path.join(abs, dir)).isDirectory()) continue
      const m = JSON.parse(fs.readFileSync(f, 'utf-8')) as Manifest
      all.push(m)
      if (!isDeclaration(dir, m)) continue
      decls.push({ id: m.componentId, dir, ok: (m.traits ?? {}).forLoopPart === true })
    }
  }
  return { all, decls }
}

describe('第一百二十一條護欄：宣告式元件要答得出「我放得進 for 的第一格嗎」', () => {
  const { all, decls } = scan()

  it('★ 健康檢查：膠囊真的被掃到了（否則下面在驗空氣）', () => {
    expect(all.length, '🔴 一個膠囊都沒掃到 → 掃描器壞了').toBeGreaterThan(100)
    expect(decls.length, '🔴 一顆宣告式元件都沒認出來 → 判準壞了').toBeGreaterThan(20)
  })

  it('★ 正向錨點：那顆最一般的變數宣告本來就宣告了它', () => {
    const base = decls.find((d) => d.id === 'cpp:var_declare')
    expect(base, '🔴 找不到 `cpp:var_declare` → 判準壞了').toBeDefined()
    expect(base!.ok).toBe(true)
  })

  it('🔴 硬性零：每一顆宣告式元件都要宣告 `forLoopPart`', () => {
    const missing = decls.filter((d) => !d.ok && !EXEMPT.has(d.id))
    expect(missing.map((d) => d.id),
      '🔴 沒宣告的宣告式元件——它的症狀是 `for (T x = …; …)` **整段**掉進 raw code，'
      + '而錯誤訊息指著那一整段，沒有指著少掉的宣告。'
      + '\n   ⚠️ 真的不行的話請寫進 `EXEMPT` 並在 `_traits_why` 裡寫出理由。')
      .toEqual([])
  })

  /**
   * ★ **注入：把一顆合成的違規餵進判定函式**（第四十九條要求的）。
   *
   * > **一條會掃東西、會數數，而沒有人證明過它的偵測器認得出違規的護欄，
   * > 在偵測器壞掉的那一天是全綠的。**
   */
  it('★ 注入①：一顆沒宣告的宣告式元件必須被認出來', () => {
    const fake = { componentId: 'cpp:fake_declare', traits: {} }
    expect(isDeclaration('fake_declare', fake)).toBe(true)
    expect((fake.traits as Record<string, unknown>).forLoopPart === true).toBe(false)
  })

  it('★ 注入②：不是宣告的東西不得被算進母體（否則這條會逼人改不該改的）', () => {
    expect(isDeclaration('arithmetic', { componentId: 'cpp:arithmetic' })).toBe(false)
    expect(isDeclaration('print', { componentId: 'cpp:print', traits: { precedence: 1 } })).toBe(false)
    // 🔴 而**自己宣告了 `declarator`** 的要算進來——判準刻意不只看名字
    expect(isDeclaration('pointer_declare', { componentId: 'x', traits: { declarator: true } })).toBe(true)
  })

  it('★ 報表：這條護欄涵蓋到多少顆', () => {
    console.log(`  宣告式元件 ${decls.length} 顆｜宣告了 ${decls.filter((d) => d.ok).length} 顆`
      + `｜刻意豁免 ${EXEMPT.size} 顆`)
    expect(decls.filter((d) => d.ok).length).toBe(decls.length - EXEMPT.size)
  })
})
