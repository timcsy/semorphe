/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（`vitest.config.ts`）——這個檔碰 DOM，所以顯式加回來。
 */
/**
 * 第六十三條護欄：**狀態列一定要有人畫**。
 *
 * ## 它守的是什麼
 *
 * `features.statusBar: false` 的意思是「這個宿主自己有一條，面板別畫」
 * ——而那句話有一個**義務跟著**：三態要改由 `CodeView.reportSyncPhase`
 * 交出去。兩端沒對上的話，症狀是：
 *
 * > **面板裡那條不見了，宿主那條沒出現，於是同步三態一個顯示處都沒有。**
 * > 而使用者看到的不是「少了一條狀態列」，是「**同步好像壞了**」。
 *
 * 這正是這一刀的來由（2026-08-25，使用者截圖）：
 * 擴充裡的宿主狀態列在使用者主動去動同步之前**一格都沒有**，
 * 因為開機那條路徑只呼叫了兩個重畫函式的其中一個。
 *
 * ## 🔴 自我否證
 *
 * > **如果「合成輸入」那一段裡，`updateStatusBar` 回傳的字串找不到
 * > `__PROBE_LANG__` 這個記號，代表這支測試根本沒呼叫到被測的函式
 * > ——是工具壞了，不是世界長這樣。**
 *
 * ⚠️ 錨在**合成的記號**上，不是錨在「還有幾個宿主沒對上」——
 * 後者會在這條護欄成功的那天變紅（`build-guardrail` 步驟 2 的簽名一）。
 *
 * ## 本護欄不檢測什麼
 *
 * - ❌ **不驗宿主那條狀態列真的畫出來了**——那在另一個行程裡，
 *   而 `ship-extension` 記著：「驗得到我送了什麼，驗不到對面怎麼處理」。
 * - ❌ **不驗 tooltip 的文字好不好讀**——只驗那些字沒有被丟掉。
 * - ❌ **不驗網頁版的 `HostProfile`**（它 import 編輯器套件，這裡解析不了）
 *   ——那一格改用原始碼檢查，⚠️ **而那比較弱：它讀的是文字，不是行為**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { updateStatusBar } from '../../src/ui/app-shell'
import { vscodeProfile } from '../../src/vscode/vscode-profile'
import type { StylePreset } from '../../src/core/types'

interface ProfileFile { path: string; text: string }

/** 掃出所有宿主宣告檔——⚠️ 用**檔案**當單位，因為 web 那份 import 不進來。 */
function profileFiles(): ProfileFile[] {
  const out: ProfileFile[] = []
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`
      if (e.isDirectory()) { walk(p); continue }
      if (!p.endsWith('.ts') || p.endsWith('.test.ts')) continue
      const text = fs.readFileSync(p, 'utf8')
      if (/:\s*HostProfile\s*=\s*\{/.test(text)) out.push({ path: p, text })
    }
  }
  walk('src')
  return out
}

// ─── 偵測器：純函式，好讓注入餵得進zz-fake-false違規 ───

/** unstated的：宣告了宿主，而沒說誰畫狀態列。 */
function unstated(files: ProfileFile[]): string[] {
  return files.filter((f) => !/\bstatusBar:\s*(true|false)/.test(f.text)).map((f) => f.path)
}

/**
 * 宣告不畫、而它的程式碼視圖**cannotReportPhase**的。
 *
 * `readImpl` 依類別名取得那份實作的原始碼——⚠️ 抽成參數是為了讓注入
 * 餵合成的來源進來，而不是去真的檔案系統造一個假檔。
 */
function cannotReportPhase(files: ProfileFile[], readImpl: (className: string) => string | null): string[] {
  return files
    .filter((f) => /\bstatusBar:\s*false/.test(f.text))
    .filter((f) => {
      const m = f.text.match(/new\s+(\w+)\(container\)/)
      if (!m) return true          // 🔴 判不出來就算違規（保守——`build-guardrail` 第 5 步）
      const impl = readImpl(m[1])
      return impl === null || !impl.includes('reportSyncPhase(')
    })
    .map((f) => f.path)
}

/** 依類別名去 `src/` 找那份實作。⚠️ 找不到回 `null`，**不是回空字串**——兩者要分得出來。 */
function readImplFromDisk(className: string): string | null {
  const kebab = className.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  const all = fs.readdirSync('src', { recursive: true }) as string[]
  const hit = all.find((p) => p.endsWith(`${kebab}.ts`))
  return hit ? fs.readFileSync(`src/${hit}`, 'utf8') : null
}

const SYNTHETIC_STYLE = {
  id: '__probe__',
  name: { 'zh-TW': '__PROBE_STYLE__', en: '__PROBE_STYLE__' },
} as unknown as StylePreset

describe('第六十三條：狀態列一定要有人畫', () => {
  it('入口條件：真的掃到宿主宣告了（否則下面整組空過）', () => {
    // ⚠️ 錨在**掃到幾個檔**上——它不會因為違規被修好而變小。
    expect(profileFiles().length, '🔴 一個 HostProfile 都沒掃到＝掃描器壞了')
      .toBeGreaterThanOrEqual(2)
  })

  it('🔴 每一份宿主宣告都要表態——`statusBar` 不得省略', () => {
    expect(unstated(profileFiles()), '🔴 unstated＝不知道誰要畫').toEqual([])
  })

  it('🔴 硬性零：宣告不畫的宿主，必須把三態交得出去', () => {
    // 判準：留一個不交的宿主，這條規範就不成立——它的三態**完全沒有顯示處**。
    expect(vscodeProfile.features.statusBar, '前置：這一份確實宣告不畫').toBe(false)
    const view = vscodeProfile.createCodeView(document.createElement('div'))
    // 🟢 這一格是**行為的**：真的建一個實作出來看它有沒有那個方法。
    expect(typeof view.reportSyncPhase, '🔴 面板不畫、宿主也收不到＝三態消失')
      .toBe('function')
    expect(typeof view.onSyncCommand, '🔴 只能看不能操作的狀態列是死的')
      .toBe('function')
  })

  it('⚠️ 其餘不畫的宿主用原始碼檢查——比較弱，弱在它讀的是文字不是行為', () => {
    const others = profileFiles().filter((f) => !f.path.endsWith('vscode-profile.ts'))  // 那一份上面**實測**過了
    expect(cannotReportPhase(others, readImplFromDisk), '🔴 宣告不畫，而它的程式碼視圖cannotReportPhase').toEqual([])
  })

  it('🔴 「不畫」不等於「不算」——沒有狀態列時仍然算得出那一行字', () => {
    // ⚠️ 這一條抓的是**提早 return**：一旦有人在 `updateStatusBar` 開頭寫
    //    `if (!statusBar) return`，宿主那條的 tooltip 就永遠是空的。
    expect(document.getElementById('status-bar'), '前置：這個環境裡沒有狀態列').toBeNull()
    const detail = updateStatusBar(SYNTHETIC_STYLE, 'zh-TW', '__PROBE_BS__', '__PROBE_TOPIC__', null,
      '__PROBE_LANG__', { phase: 'paused', source: null })
    // 🔴 自我否證的錨點——**合成的記號**，不隨任何修復失效
    expect(detail, '🔴 找不到合成記號＝根本沒呼叫到被測函式').toContain('__PROBE_LANG__')
    expect(detail).toContain('__PROBE_TOPIC__')
    expect(detail).toContain('__PROBE_BS__')
    // 🔴 三態**不在** detail 裡：宿主狀態列常駐顯示它，tooltip 不該再講一次
    expect(detail, '🔴 三態重複了').not.toContain('已暫停')
  })

  it('🔴 有狀態列時，三態要真的寫進去（網頁版那一側）', () => {
    const footer = document.createElement('footer')
    footer.id = 'status-bar'
    document.body.appendChild(footer)
    try {
      updateStatusBar(SYNTHETIC_STYLE, 'zh-TW', '__PROBE_BS__', '__PROBE_TOPIC__', null,
        '__PROBE_LANG__', { phase: 'diverged', source: null })
      expect(footer.textContent, '🔴 三態沒被畫出來').toContain('兩邊都改了')
      expect(footer.textContent).toContain('__PROBE_LANG__')
    } finally {
      footer.remove()
    }
  })

  it('🔴 面板那條與宿主那條由**同一個函式**寫——不得再分成兩個', () => {
    // ⚠️ 這是這一刀的根因：兩個重畫函式，而開機只走了其中一個。
    //    這一條讀原始碼，⚠️ **而它擋的是「又分回去」，不是行為**。
    const src = fs.readFileSync('src/ui/app.ts', 'utf8')
    const refresh = src.match(/private refreshStatusBar\(\): void \{[\s\S]*?\n  \}/)
    expect(refresh, '🔴 找不到 refreshStatusBar＝這條護欄的錨爛了').toBeTruthy()
    expect(refresh![0], '🔴 重畫狀態列時沒有同時通知宿主').toContain('reportSyncPhase')
  })

  it('🔴 面板關了，宿主狀態列不得繼續宣稱「同步中」', () => {
    // ⚠️ 這一條讀原始碼（比較弱）——那個項目住在主行程，這裡跑不起來。
    //    而它擋的是一個真的缺陷：`syncItem` 建好之後從來沒有人藏它，
    //    關掉面板之後狀態列會指著一個已經不存在的面板。
    const src = fs.readFileSync('src/vscode/panel.ts', 'utf8')
    const dispose = src.match(/\n  dispose\(\): void \{[\s\S]*?\n  \}/)
    expect(dispose, '🔴 找不到 dispose＝這條護欄的錨爛了').toBeTruthy()
    expect(dispose![0], '🔴 關掉面板而狀態列還在說同步中').toContain('hideSyncStatusBar')
  })

  // ─── ★ 注入：證明偵測器認得出違規，而且不亂報 ───

  it('★ 注入①：宣告不畫、而視圖cannotReportPhase的，必須被報出', () => {
    const synthetic: ProfileFile[] = [{
      path: 'zz/zz-fake-bad-host.ts',
      text: 'export const p: HostProfile = {\n createCodeView(container) { return new ZzFakeView(container) },\n features: { statusBar: false },\n}',
    }]
    expect(cannotReportPhase(synthetic, () => 'class ZzFakeView { getCode() { return "" } }'))
      .toEqual(['zz/zz-fake-bad-host.ts'])
  })

  it('★ 注入②：交得出三態的、以及自己畫狀態列的，都不得被報', () => {
    const canReport: ProfileFile = {
      path: 'zz/zz-fake-good-host.ts',
      text: 'export const p: HostProfile = {\n createCodeView(container) { return new ZzFakeView(container) },\n features: { statusBar: false },\n}',
    }
    const drawsItself: ProfileFile = {
      path: 'zz/zz-fake-web.ts',
      text: 'export const p: HostProfile = {\n createCodeView(container) { return new ZzFakeView(container) },\n features: { statusBar: true },\n}',
    }
    expect(cannotReportPhase([canReport, drawsItself], () => 'class ZzFakeView { reportSyncPhase(a, b, c) {} }'))
      .toEqual([])
  })

  it('★ 注入③：找不到那份實作時**算違規**——判不出來不得計入安全', () => {
    const synthetic: ProfileFile[] = [{
      path: 'zz/zz-fake-missing.ts',
      text: 'export const p: HostProfile = {\n createCodeView(container) { return new ZzMissing(container) },\n features: { statusBar: false },\n}',
    }]
    expect(cannotReportPhase(synthetic, () => null)).toEqual(['zz/zz-fake-missing.ts'])
  })

  it('★ 注入④：unstated的會被報，表了態的不會', () => {
    const silent: ProfileFile = { path: 'zz/zz-fake-silent.ts', text: 'const p: HostProfile = { features: { fileButtons: true } }' }
    const saysTrue: ProfileFile = { path: 'zz/zz-fake-true.ts', text: 'const p: HostProfile = { features: { statusBar: true } }' }
    const saysFalse: ProfileFile = { path: 'zz/zz-fake-false.ts', text: 'const p: HostProfile = { features: { statusBar: false } }' }
    expect(unstated([silent, saysTrue, saysFalse])).toEqual(['zz/zz-fake-silent.ts'])
  })
})
