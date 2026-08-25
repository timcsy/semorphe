/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（`vitest.config.ts`）——這個檔碰 DOM，所以顯式加回來。
 */
/**
 * 第六十三條護欄：**投影出去的每一顆，宿主都要接得住**。
 *
 * ## 它守的是什麼
 *
 * `HostProfile.controlSurfaces` 說「這一種控制項由宿主畫」——而那句話
 * 有一個**義務跟著**：那個宿主的 `CodeView` 要交得出對應的能力。
 *
 * ```
 * indicator → host*   ⇒  reportSyncPhase          同步三態
 * picker    → host*   ⇒  reportControls ＋ onControlInvoke
 * action    → host*   ⇒  同上
 * ```
 *
 * 兩端沒對上的話，症狀是：
 *
 * > **面板裡那顆不見了，宿主那顆沒出現，於是它一個顯示處都沒有。**
 * > 而使用者看到的不是「少了一顆按鈕」，是「**壞了**」。
 *
 * 🔴 這條護欄**先於**「控制項離開積木面板」那一刀存在（2026-08-25 上午蓋的，
 * 當時只管狀態列），而那一刀下午就靠它擋住了三次漏接。
 * ⚠️ **護欄先蓋、功能後做**——`build-guardrail` 6.5 的那一條。
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
 * - ❌ **不驗宿主那側真的畫出來了**——那在另一個行程裡，
 *   而 `ship-extension` 記著：「驗得到我送了什麼，驗不到對面怎麼處理」。
 * - ❌ **不驗 QuickPick／標題列按鈕在 Theia 能不能用**——只有人按得到。
 * - ❌ **不驗網頁版的 `HostProfile`**（它 import 編輯器套件，這裡解析不了）
 *   ——那一格改用原始碼檢查，⚠️ **而那比較弱：它讀的是文字，不是行為**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { updateStatusBar } from '../../src/ui/app-shell'
import { vscodeProfile } from '../../src/vscode/vscode-profile'
import { CONTROLS } from '../../src/core/host/controls'
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

// ─── 偵測器：純函式，好讓注入餵得進合成的假違規 ───

/** 沒表態的：宣告了宿主，而沒說控制項投影到哪。 */
function unstated(files: ProfileFile[]): string[] {
  return files
    .filter((f) => !(/\bpicker:\s*'/.test(f.text) && /\baction:\s*'/.test(f.text)
      && /\bindicator:\s*'/.test(f.text) && /\boutput:\s*'/.test(f.text)))
    .map((f) => f.path)
}

/**
 * 宣告投影到宿主、而它的程式碼視圖**交不出對應能力**的。
 *
 * `readImpl` 依類別名取得那份實作的原始碼——⚠️ 抽成參數是為了讓注入
 * 餵合成的來源進來，而不是去真的檔案系統造一個假檔。
 */
function cannotReportPhase(files: ProfileFile[], readImpl: (className: string) => string | null): string[] {
  const offenders: string[] = []
  for (const f of files) {
    // 🔴 **投影到宿主的每一種，都要有對應的能力**——三種投影，三組義務。
    const required = new Set<string>()
    if (/\bindicator:\s*'host/.test(f.text)) required.add('reportSyncPhase(')
    if (/\b(picker|action):\s*'host/.test(f.text)) {
      required.add('reportControls(')
      required.add('onControlInvoke(')
    }
    // 🔴 `output → hostTerminal` 的義務：程式在講話而沒有人聽得到，
    //    比「面板少一格」嚴重得多——**執行會直接沒有出口**。
    if (/\boutput:\s*'host/.test(f.text)) {
      required.add('reportConsole(')
      required.add('onConsoleInput(')
    }
    if (required.size === 0) continue
    const m = f.text.match(/new\s+(\w+)\(container\)/)
    // 🔴 判不出來就算違規（保守——`build-guardrail` 第 5 步）
    const impl = m ? readImpl(m[1]) : null
    for (const cap of required) {
      if (impl === null || !impl.includes(cap)) offenders.push(`${f.path} → ${cap.replace('(', '')}`)
    }
  }
  return offenders
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

describe('第六十三條：投影出去的每一顆，宿主都要接得住', () => {
  it('入口條件：真的掃到宿主宣告了（否則下面整組空過）', () => {
    // ⚠️ 錨在**掃到幾個檔**上——它不會因為違規被修好而變小。
    expect(profileFiles().length, '🔴 一個 HostProfile 都沒掃到＝掃描器壞了')
      .toBeGreaterThanOrEqual(2)
  })

  it('🔴 每一份宿主宣告都要表態——三種投影一個都不得省略', () => {
    expect(unstated(profileFiles()), '🔴 沒表態＝不知道誰要畫').toEqual([])
  })

  it('🔴 加一顆控制項，不得再多一格布林——`HostFeatures` 只准下降', () => {
    // 這是「控制項離開積木面板」那一刀的**第一條驗收**：
    //
    // > **五格布林、再搬四顆就是九格——而它們講的是同一件事：
    // > 這顆控制項在這個宿主投影到哪裡。**
    //
    // ⚠️ 數字 4 是那一刀之後的實測值（原本 5，`statusBar` 收進了
    //    `controlSurfaces`）。🔴 **它是上限，不是缺陷計數**
    //    ——所以它不會在成功的那天變紅（`build-guardrail` 簽名一）。
    expect(Object.keys(vscodeProfile.features).length,
      '🔴 又用布林解決了一顆控制項——那條路會爆炸，登錄表才不會')
      .toBeLessThanOrEqual(4)
    // 正向錨點：而它不是空的（否則這一條可能是「features 整個沒了」而空過）
    expect(Object.keys(vscodeProfile.features).length).toBeGreaterThan(0)
  })

  it('🔴 登錄表裡的每一顆，都要投影得到一個表面', () => {
    const surfaces = vscodeProfile.controlSurfaces
    const homeless = CONTROLS.filter((c) => !surfaces[c.kind])
    expect(homeless.map((c) => c.id), '🔴 這幾顆沒有家——它們會安靜地消失').toEqual([])
    // ⚠️ 而每一顆都要說得出「按下去在宿主的指令面板上叫什麼」
    const nameless = CONTROLS.filter((c) => (c.hostTitle ?? '').trim().length < 2)
    expect(nameless.map((c) => c.id), '🔴 沒有標題的指令，使用者在指令面板上讀不懂').toEqual([])
  })

  it('🔴 硬性零：投影到宿主的每一種，都要交得出對應的能力', () => {
    // 判準：留一個不交的宿主，這條規範就不成立——它的三態**完全沒有顯示處**。
    expect(vscodeProfile.controlSurfaces.indicator, '前置：這一份確實投影到宿主').toBe('hostStatusBar')
    expect(vscodeProfile.controlSurfaces.picker).toBe('hostStatusBar')
    expect(vscodeProfile.controlSurfaces.action).toBe('hostTitleBar')
    const view = vscodeProfile.createCodeView(document.createElement('div'))
    // 🟢 這一格是**行為的**：真的建一個實作出來看它有沒有那些方法。
    expect(typeof view.reportSyncPhase, '🔴 面板不畫、宿主也收不到＝三態消失')
      .toBe('function')
    expect(typeof view.onSyncCommand, '🔴 只能看不能操作的狀態列是死的')
      .toBe('function')
    expect(typeof view.reportControls, '🔴 控制項投影到宿主，而交不出去＝它們消失')
      .toBe('function')
    expect(typeof view.onControlInvoke, '🔴 只能看不能按的控制項是死的')
      .toBe('function')
    expect(typeof view.reportConsole, '🔴 程式在講話而宿主聽不到＝執行沒有出口')
      .toBe('function')
    expect(typeof view.onConsoleInput, '🔴 只能輸出不能輸入的主控台，`cin` 就沒有家')
      .toBe('function')
  })

  it('⚠️ 其餘投影到宿主的用原始碼檢查——比較弱，弱在它讀的是文字不是行為', () => {
    const others = profileFiles().filter((f) => !f.path.endsWith('vscode-profile.ts'))  // 那一份上面**實測**過了
    expect(cannotReportPhase(others, readImplFromDisk), '🔴 投影到宿主，而它的程式碼視圖交不出那些能力').toEqual([])
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

  it('🔴 語系只有一個入口——面板的下拉也要記得「使用者選的是什麼」', () => {
    // ⚠️ 原始碼檢查（比較弱）。它擋的是一個真的洞：兩個入口，
    //    而只有宿主那條經過 `applyLocalePreference`，於是網頁版選了
    //    English 之後 `localePreference` 仍然停在 `zh-TW`。
    const src = fs.readFileSync('src/ui/app.ts', 'utf8')
    expect(src, '🔴 面板那條又繞過偏好了')
      .toContain('onLocaleChange: (locale) => this.applyLocalePreference(locale)')
    // 正向錨點：而那一支真的會記
    const apply = src.match(/private async applyLocalePreference[\s\S]*?\n  \}/)
    expect(apply, '🔴 找不到 applyLocalePreference＝這條護欄的錨爛了').toBeTruthy()
    expect(apply![0]).toContain('this.localePreference = preference')
  })

  it('🔴 診斷有交給宿主——它的家是 Problems，不是面板裡的一塊', () => {
    // > 搬面板只是換了個位置；走管道才拿得到 F8、紅色波浪線、
    // > 以及使用者已經會的每一個快捷鍵。
    const view = vscodeProfile.createCodeView(document.createElement('div'))
    expect(typeof view.onDiagnostics, '🔴 診斷沒有出口＝它只活在面板裡').toBe('function')
    // ⚠️ 而主行程那側要真的接住——原始碼檢查（比較弱，它讀的是文字）
    const src = fs.readFileSync('src/vscode/panel.ts', 'utf8')
    expect(src, '🔴 沒有 DiagnosticCollection＝送過去也沒有人收')
      .toContain('createDiagnosticCollection')
    expect(src, '🔴 面板關了，診斷會留在 Problems 上指著一個不存在的面板')
      .toMatch(/DIAGNOSTICS\.delete/)
  })

  // ─── ★ 注入：證明偵測器認得出違規，而且不亂報 ───

  it('★ 注入①：投影到宿主、而視圖交不出那些能力的，必須被報出', () => {
    const synthetic: ProfileFile[] = [{
      path: 'zz/zz-fake-bad-host.ts',
      text: `export const p: HostProfile = {
 createCodeView(container) { return new ZzFakeView(container) },
 controlSurfaces: { picker: 'hostStatusBar', action: 'hostTitleBar', indicator: 'hostStatusBar', output: 'hostTerminal' },
}`,
    }]
    expect(cannotReportPhase(synthetic, () => 'class ZzFakeView { getCode() { return "" } }'))
      .toEqual(['zz/zz-fake-bad-host.ts → reportSyncPhase', 'zz/zz-fake-bad-host.ts → reportControls', 'zz/zz-fake-bad-host.ts → onControlInvoke', 'zz/zz-fake-bad-host.ts → reportConsole', 'zz/zz-fake-bad-host.ts → onConsoleInput'])
  })

  it('★ 注入②：交得出三態的、以及自己畫狀態列的，都不得被報', () => {
    const canReport: ProfileFile = {
      path: 'zz/zz-fake-good-host.ts',
      text: `export const p: HostProfile = {
 createCodeView(container) { return new ZzFakeView(container) },
 controlSurfaces: { picker: 'hostStatusBar', action: 'hostTitleBar', indicator: 'hostStatusBar', output: 'hostTerminal' },
}`,
    }
    const drawsItself: ProfileFile = {
      path: 'zz/zz-fake-web.ts',
      text: `export const p: HostProfile = {
 createCodeView(container) { return new ZzFakeView(container) },
 controlSurfaces: { picker: 'panelToolbar', action: 'panelToolbar', indicator: 'panelStatusBar', output: 'panelBottom' },
}`,
    }
    expect(cannotReportPhase([canReport, drawsItself], () => 'class ZzFakeView { reportSyncPhase(a, b, c) {} reportControls(s) {} onControlInvoke(cb) {} reportConsole(c) {} onConsoleInput(cb) {} }'))
      .toEqual([])
  })

  it('★ 注入③：找不到那份實作時**算違規**——判不出來不得計入安全', () => {
    const synthetic: ProfileFile[] = [{
      path: 'zz/zz-fake-missing.ts',
      text: `export const p: HostProfile = {
 createCodeView(container) { return new ZzMissing(container) },
 controlSurfaces: { picker: 'hostStatusBar', action: 'hostTitleBar', indicator: 'hostStatusBar', output: 'hostTerminal' },
}`,
    }]
    expect(cannotReportPhase(synthetic, () => null)).toEqual(['zz/zz-fake-missing.ts → reportSyncPhase', 'zz/zz-fake-missing.ts → reportControls', 'zz/zz-fake-missing.ts → onControlInvoke', 'zz/zz-fake-missing.ts → reportConsole', 'zz/zz-fake-missing.ts → onConsoleInput'])
  })

  it('★ 注入④：沒表態的會被報，表了態的不會', () => {
    const silent: ProfileFile = { path: 'zz/zz-fake-silent.ts', text: 'const p: HostProfile = { features: { fileButtons: true } }' }
    const saysTrue: ProfileFile = { path: 'zz/zz-fake-true.ts', text: `const p: HostProfile = { controlSurfaces: { picker: 'panelToolbar', action: 'panelToolbar', indicator: 'panelStatusBar', output: 'panelBottom' } }` }
    const saysFalse: ProfileFile = { path: 'zz/zz-fake-false.ts', text: `const p: HostProfile = { controlSurfaces: { picker: 'hostStatusBar', action: 'hostTitleBar', indicator: 'hostStatusBar', output: 'hostTerminal' } }` }
    expect(unstated([silent, saysTrue, saysFalse])).toEqual(['zz/zz-fake-silent.ts'])
  })
})
