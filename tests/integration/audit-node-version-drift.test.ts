/**
 * 第一百二十四條護欄：**測試不得用比 CI 那台 Node 新的 API**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的 `fs.globSync(` 沒有被報出來，
 * > 代表護欄壞了，不是那 600 多個檔都健康。**
 *
 * ## 它從哪來：同一個 API 咬了這個 repo 兩次
 *
 * ```
 * 2026-08-27   status-bar-language-cell   本機綠、CI 掃到 0       ← cwd 語意在版本間變過
 * 2026-09-19   audit-label-markdown       本機綠、CI 整支炸掉      ← globSync is not a function
 * ```
 *
 * 第二次是**這條護欄的鄰居自己犯的**（`audit-label-markdown` 的第一版）。
 *
 * 🔴 **而第一次之後，這個 repo 已經做過機制**：`tests/helpers/find-files.ts`
 * 的檔頭逐字寫著「**不依賴 `fs.globSync`**」，另外兩個測試檔留著
 * 「**不用 `fs.globSync`**」的註解。
 *
 * > **知識在，而寫新程式的人不會去找它——
 * > 一條只寫在註解裡的規矩，擋得住讀到那個註解的人，擋不住沒讀到的人。**
 *
 * ## 為什麼型別檢查沒擋住（🟠 而這是一個更大的洞）
 *
 * ```
 * CI 的 runtime      Node 20      （.github/workflows/deploy.yml）  ← 2026-10-31 升到 24，見下
 * @types/node        25.x         （happy-dom 與 vite 相依帶進來的）
 * ```
 *
 * 🔁 **2026-10-31（第 396 刀）：CI 升到 Node 24**——Cella 的判決模組是 WasmGC，Node 20 載不起來
 * （`Unknown type code 0x50, enable with --experimental-wasm-gc`，本機 24 綠、CI 紅），而 Node 20 已於 2026-04 停止維護。
 * 同一刀把這條護欄改成**讀 workflow 實際釘的版本**：名單每一筆標「從哪一版開始有」，只擋比 CI 新的。
 * 在此之前版本寫死在這支的說明裡——升版那一刻它就說錯了，而沒有東西會紅。
 *
 * `npx tsc --noEmit` 因此對**任何 Node 21+ 的 API** 放行。
 * 🟠 真正的修法是讓型別描述「我們真的要跑的那台」——把 `@types/node` 釘到 ^20。
 * **為什麼不是現在**：那會蓋掉 vite／happy-dom 相依進來的版本，是一個有連鎖風險的
 * 相依變更，不該在一刀的尾巴做。
 * 🔴 **何時該修**：下一次碰相依或 CI 設定的時候——而**在那之前這條護欄是唯一的防線**，
 * 所以它只認得下面這張名單，名單之外的新 API 仍然會漏掉。
 *
 * ## 判準：硬性零，而名單刻意很短
 *
 * ⚠️ **只列「這個 repo 真的被咬過、或明確擋在 Node 20 之外」的**。
 * 一條列滿了所有新 API 的護欄會在每次 Node 升級時變成雜訊，而那種護欄會被關掉。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { listSourceFiles } from '../helpers/guardrail'

/**
 * 這個 repo 用過或差點用到、而**不是每一版 Node 都有**的 API，各標從哪一個主版號開始有。
 * 🔴 名單之外的**這條護欄看不到**（見檔頭）。
 */
const TOO_NEW: readonly [RegExp, string, number][] = [
  [/\bglobSync\s*\(/, 'fs.globSync 是 Node 22 才有的——用 tests/helpers/find-files.ts', 22],
]

/** CI 實際跑的 Node 主版號：所有 workflow 的 `node-version` 裡最小的那個（最舊的那台說了算）。 */
function ciNodeMajor(): number {
  const dir = '.github/workflows'
  const versions = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => [...readFileSync(`${dir}/${f}`, 'utf-8').matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => Number(m[1])))
  return Math.min(...versions)
}
const CI_NODE = ciNodeMajor()

interface Hit { file: string; line: number; why: string; text: string }

function scan(text: string, file: string, ciMajor = CI_NODE): Hit[] {
  const out: Hit[] = []
  text.split('\n').forEach((l, i) => {
    if (l.trimStart().startsWith('*') || l.trimStart().startsWith('//')) return // 註解裡提到它是合法的
    for (const [re, why, since] of TOO_NEW) {
      if (since > ciMajor && re.test(l)) out.push({ file, line: i + 1, why, text: l.trim().slice(0, 90) })
    }
  })
  return out
}

/**
 * ⚠️ **排掉這條護欄自己**——它的注入測試裡逐字寫著那個 API 名，
 * 而那正是它該有的樣子。一條會報自己的護欄，第一個被改掉的就是它的自證。
 */
const SELF = 'audit-node-version-drift'
const FILES = [...listSourceFiles('tests'), ...listSourceFiles('src'), ...listSourceFiles('tools')]
  .filter((f) => !f.includes(SELF))
const hits = FILES.flatMap((f) => scan(readFileSync(f, 'utf-8'), f))

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 入口條件——檔案真的掃進來了', () => {
    expect(FILES.length, '🔴 一個檔都沒掃到 ⟹ 下面在驗空氣').toBeGreaterThan(400)
  })

  it('★ 入口條件——讀得到 CI 的 Node 版本', () => {
    expect(CI_NODE, '🔴 workflow 裡讀不到 node-version ⟹ 版本是 Infinity，下面什麼都不擋').toBeGreaterThanOrEqual(18)
    expect(Number.isFinite(CI_NODE)).toBe(true)
  })

  it('🔴 注入：CI 是 Node 20 時，合成一行 `fs.globSync(` 必須被報出來；CI 是 Node 22 以上時不報', () => {
    expect(scan("const f = globSync('a/*.json')", '(合成)', 20), '🔴 護欄漏掉了合成的違規').toHaveLength(1)
    expect(scan("const f = globSync('a/*.json')", '(合成)', 24), '🔴 CI 已經有的 API 被誤報').toHaveLength(0)
  })

  it('★ 注入：註解裡提到它不得被誤報', () => {
    expect(scan(' * ⚠️ 不要用 globSync(…)', '(合成)'), '🔴 認得太多會逼人改註解').toHaveLength(0)
  })
})

describe('第一百二十四條護欄：測試不得用比 CI 那台 Node 新的 API', () => {
  it('🔴 硬性零：本機綠而 CI 炸掉，比兩邊都紅更貴', () => {
    const report = hits.map((h) => `  ${h.file}:${h.line}\n    ${h.text}\n    → ${h.why}`).join('\n')
    expect(hits.map((h) => `${h.file}:${h.line}`), `🔴 CI 跑的是 Node ${CI_NODE}：\n${report}`).toEqual([])
  })
})
