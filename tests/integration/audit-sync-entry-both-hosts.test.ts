/**
 * **第一百零八條護欄：同步的入口，兩個宿主都要有。**
 *
 * ## 🔴 為什麼需要它
 *
 * 2026-08-25 使用者反問之後留下的更正，逐字：
 *
 * > 🔴 **兩個宿主都要**：機制住 `core/`，兩邊各接一個入口。
 * > ⚠️ 我一度以為「VSCode 真相是文件所以不必做」——**那只在「來源是誰」
 * > 那一格成立**；暫停（別把排版弄掉）與分岔在那側**更常見**
 * > （文件會被 git／別人改）。
 *
 * 而「兩邊各接一個」是一句**沒有機械檢查的規範**——它會在
 * 下一次「先做網頁版，IDE 那側之後再說」的時候安靜地變回一邊。
 *
 * ## ⚠️ 它為什麼特別容易只做一半
 *
 * 網頁版那側**看得見**：打開瀏覽器就在那裡。
 * 而 IDE 那側要建置、安裝、重開一個 IDE 才看得到
 * ——🔴 於是「做了沒」與「看得到沒」在開發的當下是同一件事。
 *
 * > **一個要換一個環境才看得到的東西，在另一個環境裡等於不存在
 * > ——而寫它的人是在那另一個環境裡工作的。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管按下去對不對**——那要真的跑那個宿主（見下面的「它驗不到什麼」）
 * - **不管三態的判定**（`core/sync-coordinator.ts` 有它自己的測試）
 * - **不管入口長什麼樣**：狀態列／命令面板／QuickPick 是同一件事的三個面
 *
 * ## 🔴 它【驗不到】什麼——而那一句要說出來
 *
 * 它讀的是**原始碼**：那幾個入口有沒有被宣告、有沒有被接上。
 * 它**不能**證明「在 Arduino IDE（Theia）裡按下去有反應」
 * ——那個宿主的 Webview 與 VSCode 的差異沒有逐項比對過（`history/080` §五）。
 *
 * > **在 A 環境驗、宣稱 B 環境成立——那正是 `history/076` 那個錯的形狀。**
 *
 * ⚠️ 所以 vision 上那一項的收工條件仍然是「**在 Arduino IDE 裡真的按一次**」，
 * 而這條護欄守的是它的**必要條件**：兩邊的入口都還在。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

const read = (f: string): string => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')

/** 每一個宿主要有的入口——⚠️ 少一列就等於那個宿主沒有被守。 */
const ENTRIES: [host: string, file: string, needle: string, what: string][] = [
  ['網頁版', 'src/ui/app.ts', 'openSyncMenu', '面板上那顆「⇄ 同步」'],
  ['網頁版', 'src/ui/app-shell.ts', 'onOpenSyncMenu', '工具列把它接上去'],
  ['VSCode／Theia', 'src/vscode/manifest.ts', 'semorphe.syncMenu', '命令面板的那一條'],
  ['VSCode／Theia', 'src/vscode/panel.ts', 'SYNC_MENU_COMMAND', '命令 id 的宣告'],
  // 🔴 **註冊那一步在 `extension.ts`，不在 `panel.ts`**——⚠️ 這一列是這條護欄
  //    自己的入口條件擋下來的（我第一版把兩者寫成同一個檔）。
  //    > **一個「宣告」與一個「註冊」在同一個模組裡是巧合，不是規律。**
  ['VSCode／Theia', 'src/vscode/extension.ts', 'registerCommand(SYNC_MENU_COMMAND', '主行程真的註冊它'],
  ['VSCode／Theia', 'src/vscode/panel.ts', 'syncItem', '狀態列常駐那一格'],
]

/** 三態的判定**只有一份**，而它住在核心。 */
const PHASES = ['live', 'paused', 'diverged'] as const

describe('第一百零八條護欄：同步的入口兩個宿主都要有', () => {
  it('★ 入口條件——那幾個檔都讀得到', () => {
    for (const [, f] of ENTRIES) {
      expect(read(f).length, `🔴 讀不到 ${f}——路徑或檔名改了，先修這裡`).toBeGreaterThan(100)
    }
  })

  it('🔴 硬性零：兩個宿主的入口一個都不得少', () => {
    const missing = ENTRIES
      .filter(([, f, needle]) => !read(f).includes(needle))
      .map(([host, f, needle, what]) => `${host}：${f} 少了 \`${needle}\` → ${what}`)
    expect(
      missing,
      '🔴 **同步的入口只剩一邊了。**\n' +
        '   2026-08-25 使用者反問後的更正：「兩個宿主都要——我一度以為\n' +
        '   『VSCode 真相是文件所以不必做』，而那只在「來源是誰」那一格成立；\n' +
        '   暫停與分岔在那側**更常見**（文件會被 git／別人改）。」\n' +
        '   ⚠️ 而它特別容易只做一半：IDE 那側要建置、安裝、重開才看得到\n' +
        '      ——於是「做了沒」與「看得到沒」在開發的當下是同一件事。',
    ).toEqual([])
  })

  /**
   * 🔴 **三態的判定只有一份，而它住在核心。**
   *
   * ⚠️ 兩個宿主各自判一次的話，「現在是暫停還是分岔」會有兩個答案
   * ——而它們**只在同時看得到兩邊的時候**才會被發現不一樣。
   */
  it('🔴 硬性零：三態住在核心，宿主那側不得自己判', () => {
    const core = read('src/core/sync-coordinator.ts')
    for (const p of PHASES) {
      expect(core, `🔴 核心裡找不到 \`${p}\` 這一態`).toContain(`'${p}'`)
    }
    // 宿主那側可以**讀**它，不得自己算出一個 phase
    const hostFiles = ['src/vscode/panel.ts', 'src/ui/app.ts']
    const reimplemented = hostFiles.filter((f) => /type\s+SyncPhase\s*=/.test(read(f)))
    expect(
      reimplemented,
      '🔴 宿主那側自己定義了一份 `SyncPhase`——那是第二個「現在是哪一態」的答案，\n' +
        '   而兩份判定只在**同時看得到兩邊**的時候才會被發現不一樣。',
    ).toEqual([])
  })

  it('★ 注入：少了 IDE 那側的入口 → 報得出是哪一個宿主', () => {
    const fake: typeof ENTRIES = [
      ['網頁版', 'a.ts', 'openSyncMenu', 'x'],
      ['VSCode／Theia', 'b.ts', 'semorphe.syncMenu', 'y'],
    ]
    const src: Record<string, string> = { 'a.ts': 'openSyncMenu()', 'b.ts': '（什麼都沒有）' }
    const missing = fake.filter(([, f, n]) => !src[f].includes(n)).map(([host]) => host)
    expect(missing).toEqual(['VSCode／Theia'])
  })

  it('★ 注入：兩邊都在 → 不得報', () => {
    const src: Record<string, string> = { 'a.ts': 'openSyncMenu()', 'b.ts': "'semorphe.syncMenu'" }
    const fake: typeof ENTRIES = [
      ['網頁版', 'a.ts', 'openSyncMenu', 'x'],
      ['VSCode／Theia', 'b.ts', 'semorphe.syncMenu', 'y'],
    ]
    expect(fake.filter(([, f, n]) => !src[f].includes(n))).toEqual([])
  })
})
