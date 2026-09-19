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
 * CI 的 runtime      Node 20      （.github/workflows/deploy.yml）
 * @types/node        25.x         （happy-dom 與 vite 相依帶進來的）
 * ```
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
import { readFileSync } from 'node:fs'
import { listSourceFiles } from '../helpers/guardrail'

/**
 * Node 20 沒有、而這個 repo 用過或差點用到的 API。
 * 🔴 `globSync`／`glob` 是 Node 22；名單之外的**這條護欄看不到**（見檔頭）。
 */
const TOO_NEW: readonly [RegExp, string][] = [
  [/\bglobSync\s*\(/, 'fs.globSync 是 Node 22 才有的——用 tests/helpers/find-files.ts'],
]

interface Hit { file: string; line: number; why: string; text: string }

function scan(text: string, file: string): Hit[] {
  const out: Hit[] = []
  text.split('\n').forEach((l, i) => {
    if (l.trimStart().startsWith('*') || l.trimStart().startsWith('//')) return // 註解裡提到它是合法的
    for (const [re, why] of TOO_NEW) {
      if (re.test(l)) out.push({ file, line: i + 1, why, text: l.trim().slice(0, 90) })
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

  it('🔴 注入：合成一行 `fs.globSync(`，必須被報出來', () => {
    expect(scan("const f = globSync('a/*.json')", '(合成)'), '🔴 護欄漏掉了合成的違規').toHaveLength(1)
  })

  it('★ 注入：註解裡提到它不得被誤報', () => {
    expect(scan(' * ⚠️ 不要用 globSync(…)', '(合成)'), '🔴 認得太多會逼人改註解').toHaveLength(0)
  })
})

describe('第一百二十四條護欄：測試不得用比 CI 那台 Node 新的 API', () => {
  it('🔴 硬性零：本機綠而 CI 炸掉，比兩邊都紅更貴', () => {
    const report = hits.map((h) => `  ${h.file}:${h.line}\n    ${h.text}\n    → ${h.why}`).join('\n')
    expect(hits.map((h) => `${h.file}:${h.line}`), `🔴 CI 跑的是 Node 20：\n${report}`).toEqual([])
  })
})
