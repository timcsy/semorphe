/**
 * **第一百二十七條護欄：shell 腳本裡 `$VAR` 後面接全形字，大括號不能省。**
 *
 * ## 它從哪來——同一天踩兩次
 *
 * ```
 * tools/to-gif.sh      "🔴 找不到 $src——先跑 npm run demo:record"
 * tools/build-site.sh  "主線 = $MAIN_REF（$(git rev-parse …)）"
 * ```
 *
 * 那個破折號與全形括號是**多位元組**，而 bash 的變數名比對會把它們吃進去，
 * 於是這一行自己爆成：
 *
 * ```
 * src?: unbound variable
 * MAIN_REF?: unbound variable
 * ```
 *
 * 🔴 **而第一次踩到的時候我寫了墓碑**（就在 `to-gif.sh` 那一行上面），
 * 然後在另一個檔重犯。
 *
 * > **一個寫在【那個檔】裡的墓碑，攔不住你在【另一個檔】重犯同一件事
 * > ——墓碑教的是讀到它的人，而護欄擋的是每一個人。**
 *
 * ## ⚠️ 而它特別壞的地方在「什麼時候才會發現」
 *
 * `to-gif.sh` 那一行只在**找不到檔案**的時候跑——也就是**你最需要那句錯誤訊息
 * 的時候，它自己先壞掉**，而你看到的是一句關於變數的胡言亂語。
 *
 * > **只在錯誤路徑上跑的字串，它的缺陷會等到出事那天才出現——
 * > 而那天你正在忙著看別的東西。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function shellScripts(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    if (e.name.startsWith('.') && e.name !== '.github') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) shellScripts(p, out)
    else if (e.name.endsWith('.sh')) out.push(p)
  }
  return out
}

/** `$VAR` 後面**緊接**一個非 ASCII 字元——bash 會把它當成名字的一部分 */
const RISKY = /\$[A-Za-z_][A-Za-z0-9_]*(?=[^\x00-\x7f])/g

describe('第一百二十七條護欄：shell 的 `$VAR` 後面接全形字要加大括號', () => {
  // ⚠️ 只掃真的存在的目錄——`scripts/` 今天不存在，而
  //    `readdirSync` 對不存在的路徑是**丟例外**，不是回空陣列。
  const files = ['tools', 'scripts', '.github']
    .map((d) => path.join(ROOT, d))
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => shellScripts(d))

  it('★ 入口條件——真的掃到腳本了', () => {
    expect(files.length, '🔴 一支 .sh 都沒掃到 → 下面那條是空過的').toBeGreaterThan(0)
  })

  it('🔴 硬性零：沒有一處 `$VAR` 後面直接接全形字', () => {
    const bad: string[] = []
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(RISKY)) {
          bad.push(`${path.relative(ROOT, f)}:${i + 1}  ${m[0]}${line.slice(m.index! + m[0].length, m.index! + m[0].length + 4)}`)
        }
      })
    }
    expect(bad, '🔴 bash 會把後面那個全形字吃進變數名，這一行會爆成 `名字?: unbound variable`。\n'
      + '🟢 修法：`${VAR}` 而不是 `$VAR`。').toEqual([])
  })

  it('★ 注入：寫一行 `$FOO（…）` → 抓得到', () => {
    const line = 'echo "主線 = $FOO（x）"'
    expect([...line.matchAll(RISKY)].length, '🔴 判準抓不到它 → 上面那條是空過的').toBe(1)
  })

  it('★ 不亂報：`${FOO}（…）` 與 `$FOO bar` 都不算', () => {
    expect([...'echo "${FOO}（x）"'.matchAll(RISKY)].length).toBe(0)
    expect([...'echo "$FOO bar"'.matchAll(RISKY)].length).toBe(0)
  })
})
