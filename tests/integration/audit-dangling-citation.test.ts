/**
 * **第九十四條護欄**：被當成既定引用的具名概念，必須真的存在。
 *
 * ## 它從哪來
 *
 * `knowie-judge` §3 明文要求這個檢查：
 *
 * > 「一個被當成既定的**具名**判準／教訓／概念（"see X"、"echoes X"、
 * >  "the X principle"），而沒有任何檔案或標題定義它 ……
 * >  一個被依賴而從來沒有被捕捉的名字，正是『一次生動的討論被誤認成
 * >  一份已經存過的東西』那種失敗」（原文為英文，此處轉述）
 *
 * ⚠️ **這一段刻意不逐字引用原文**：原文用的是那個已經退場的英文字，而
 * spec 159 那條護欄（該字族整族退場）是**硬性零**——它連註解裡的字面都算。
 * **一條硬性零不會因為「這是別人的原文」而豁免**，而那是對的：
 * 豁免一次，下一次就有理由豁免第二次。
 *
 * 🔴 **而這一段【自己】犯了一次**：第一版寫「原文用的是 `xxxx` 這個字」
 * ——把那個字寫出來了，護欄當場再紅一次。
 *
 * > **一段解釋某個字樣為什麼危險的文字，本身就含有那個字樣。**
 *
 * ⚠️ 這是**同一天內第二次**：`audit-guardrail-count.test.ts` 的檔頭
 * 為了說明「注入樣本不能寫成字面」，而把樣本寫成了字面。
 * **兩次都是在寫「不要寫 X」的時候寫了 X。**
 *
 * 🔴 **而 2026-08-31 那一輪判官【跳過了它】**——我掃了 `[](路徑)` 形式的死連結，
 * 沒掃 `[[名稱]]` 形式的具名引用。那個漏掉是在一次無關的討論裡偶然發現的。
 *
 * 於是它剛好回答了 knowie 自己那條判準：
 *
 * > 「Keep or cut？→ If cut, could an AI quietly skip it and no one notice?」
 *
 * **會，我就是那個 AI。** 所以它該機械化。
 *
 * ⚠️ 而漏掉時抓到的那一筆是真的：`skills/component-rename/SKILL.md` 引用
 * `[[feedback_fix_bugs_not_document]]`——那個名字住在**AI 的私有記憶**裡，
 * 對這個 repo 不可見。
 *
 * > **一個 skill 引用了一個只有它自己看得到的東西，
 * > 讀它的下一個人（或下一個模型）會以為那是庫裡的東西。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的 markdown 檔少於 100 個，代表路徑錯了或庫是空的，
 * > 這份結果不算數——不是「引用都健康」。**
 *
 * 錨在**掃到幾個檔**（合成量）。它不會因為懸空引用被修好而變小。
 * 🔴 **刻意不錨在「懸空數」**——那正是要推向零的。
 *
 * ## 判準：一個名字算不算「存在」
 *
 * ```
 * ① 有一個檔的檔名是它          （去掉 YYYY-MM-DD- 與 NNN- 前綴之後也算）
 * ② 有一個 skills/ 目錄叫它      （skill 的檔案都叫 SKILL.md，目錄名才是名字）
 * ③ 有一個標題包含它
 * ```
 *
 * ⚠️ ②那一條是實測補的：第一版只收 `.md` 檔名，於是 `[[build-guardrail]]`
 * 那一族**全部被誤報**。**一個把 19 個健康引用報成壞的檢查，會被關掉。**
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測 `[](路徑)` 形式**——那是另一個掃描（判官 §3 的第一項）
 * - **不檢測名字指得對不對**（`[[投影]]` 指到那個檔而內容不符）
 * - ⚠️ **不檢測 `history/` 裡對已刪除概念的引用**：那是**病歷**，
 *   記的是「當時有這個東西」——與判官對 history 的一貫態度一致
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'knowledge')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

/** 這個庫裡「存在的名字」有哪些 */
function knownNames(files: string[]): { names: Set<string>; headings: string[] } {
  const names = new Set<string>()
  for (const f of files) {
    const stem = path.basename(f, '.md')
    names.add(stem)
    names.add(stem.replace(/^\d{4}-\d{2}-\d{2}-/, ''))
    names.add(stem.replace(/^\d+-/, ''))
  }
  // ⚠️ skill 的檔案都叫 SKILL.md——目錄名才是它的名字
  const skills = path.join(ROOT, 'skills')
  if (fs.existsSync(skills)) {
    for (const e of fs.readdirSync(skills, { withFileTypes: true })) {
      if (e.isDirectory()) names.add(e.name)
    }
  }
  const headings: string[] = []
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/^#{1,4}\s+(.+)$/gm)) {
      headings.push(m[1].trim().replace(/[*`]/g, ''))
    }
  }
  return { names, headings }
}

/**
 * 一段文字裡的具名引用。
 *
 * ⚠️ **要濾掉程式碼**：`[['x','x']]`、`[[0, 9]]`、`[[名稱, 現值]]` 都是巢狀陣列
 * 字面，不是引用。判準是「含引號、數字或逗號」——保守，寧可漏報也不誤報，
 * 因為**一個會誤報的檢查會被關掉**。
 */
export function citationsIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\[\[([^\][]+)\]\]/g)) {
    const n = m[1].trim()
    if (n.length < 2) continue
    if (/['"0-9,]/.test(n)) continue
    out.push(n)
  }
  return out
}

export function isKnown(name: string, names: Set<string>, headings: string[]): boolean {
  if (names.has(name)) return true
  if (headings.some((h) => h.includes(name))) return true
  for (const n of names) if (n.includes(name)) return true
  return false
}

describe('第九十四條護欄：具名引用不得懸空', () => {
  const files = walk(ROOT)
  const { names, headings } = knownNames(files)

  it('★ 入口條件——真的掃到知識庫了', () => {
    // 錨在**掃到幾個檔**（合成量），見檔頭的自我否證
    expect(
      files.length,
      `🔴 只掃到 ${files.length} 個 markdown → 路徑錯了或庫是空的，這份報表不算數。` +
        '⚠️ 這【不】代表引用都健康。',
    ).toBeGreaterThan(100)
    expect(names.size, '🔴 一個名字都沒收集到').toBeGreaterThan(50)
  })

  it('★ 注入：認得出引用，也不會把程式碼裡的巢狀陣列當成引用', () => {
    // ⚠️ 合成輸入，不是真實檔案——真實檔案會被修好，而合成規則不會
    expect(citationsIn('見 [[某個概念]] 與 [[另一個概念]]')).toEqual(['某個概念', '另一個概念'])
    expect(citationsIn("const a = [['x','x']]; const b = [[0, 9]]"), '🔴 把程式碼當成引用了').toEqual([])
    expect(citationsIn('[[名稱, 現值]]'), '🔴 含逗號的是陣列字面，不是引用').toEqual([])
  })

  it('★ 注入：判定「存在」的三條路各自成立，而不存在的要被判為不存在', () => {
    const n = new Set(['投影', 'build-guardrail'])
    const h = ['一個沒有機械檢查的數字，會在每一份文件裡各自漂']
    expect(isKnown('投影', n, h), '🔴 檔名那一條沒認出來').toBe(true)
    expect(isKnown('build-guardrail', n, h), '🔴 skill 目錄那一條沒認出來').toBe(true)
    expect(isKnown('一個沒有機械檢查的數字', n, h), '🔴 標題那一條沒認出來').toBe(true)
    expect(isKnown('這個名字不存在', n, h), '🔴 不存在的被判成存在了').toBe(false)
  })

  it('硬性零：知識庫裡不得有懸空的具名引用', () => {
    const dangling: string[] = []
    for (const f of files) {
      const rel = path.relative(process.cwd(), f)
      for (const n of citationsIn(fs.readFileSync(f, 'utf8'))) {
        if (!isKnown(n, names, headings)) dangling.push(`${rel} → [[${n}]]`)
      }
    }
    expect(
      dangling,
      '\n🔴 這些名字被當成既定的東西引用，而庫裡沒有它：\n  ' + dangling.join('\n  ') +
        '\n⚠️ 那正是「一次生動的討論被誤認成一份已經存過的東西」——' +
        '要嘛把它捕捉起來，要嘛改指一個真的存在的東西。\n',
    ).toEqual([])
  })
})
