/**
 * **護欄：history 與 spec 的編號不得重複**（2026-11-05）
 *
 * 平行的 worktree 各自取「下一個號」——兩條分支都拿到 343，各自都是綠的，合起來就是兩份 343。
 * Cella 撞過一次（spec／history 同號），改用腳本發號；semorphe 選擇用護欄擋：
 * 腳本要靠每次記得呼叫，忘了不會出聲；這一支在合併後的長測試與 CI 上一定跑到——撞了就紅，改號的成本是一個檔名。
 * 出處：semorphe-main 轉 Cella 的經驗（cella-main 轉使用者原話「我覺得可以試試腳本」），這裡的做法是工人自己判斷的。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

/** 一個目錄裡，前綴編號相同的檔名 */
export function duplicates(names: readonly string[]): string[][] {
  const by = new Map<string, string[]>()
  for (const n of names) {
    const m = /^(\d+)-/.exec(n)
    if (!m) continue
    by.set(m[1], [...(by.get(m[1]) ?? []), n])
  }
  return [...by.values()].filter((xs) => xs.length > 1)
}

const history = readdirSync(path.join(ROOT, 'knowledge/history')).filter((n) => n.endsWith('.md'))
const specs = readdirSync(path.join(ROOT, 'specs'))

describe('護欄：history 與 spec 的編號不得重複', () => {
  it('入口條件：兩個目錄都讀得到（合成量）', () => {
    expect(history.length).toBeGreaterThan(300)
    expect(specs.length).toBeGreaterThan(150)
  })
  it('🔴 硬性零：history 沒有兩份同號', () => {
    expect(duplicates(history), '兩條分支各自拿了同一個號——後合進來的那一份改成下一個空號').toEqual([])
  })
  it('🔴 硬性零：specs 沒有兩個同號', () => {
    expect(duplicates(specs), '兩條分支各自拿了同一個號——後合進來的那一份改成下一個空號').toEqual([])
  })
  it('★ 注入：同號一定抓得到、不同號不得亂報', () => {
    expect(duplicates(['343-a.md', '343-b.md', '344-c.md'])).toEqual([['343-a.md', '343-b.md']])
    expect(duplicates(['343-a.md', '344-b.md', 'README.md'])).toEqual([])
  })
})
