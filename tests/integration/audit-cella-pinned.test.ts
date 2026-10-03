/**
 * **被換掉而沒有人看過**——釘住的那支檢查器，它的判定語義不得悄悄換人。
 *
 * ## 它從哪來（2026-10-03）
 *
 * 姊妹專案把檢查器發上 npm，而他們的發布策略是
 * **每次 main 全綠就自動發一版**（版本號是 `0.1.<UTC 時間>`）。
 *
 * ```
 * 他們  自動發版,版本號只往上
 * 我們  package-lock 釘住 —— 對的,而那也表示我們【永遠停在裝的那一天】
 * ⟹ 「什麼時候該升」沒有觸發條件
 * ```
 *
 * 而「沒有觸發條件」這件事這個庫記過：**一個「做完 X 才退休」的標記，
 * 它的觸發時機落在別人身上。**
 *
 * ## 🔴 而這一條刻意【不】問「有沒有新版」
 *
 * ```
 * ❌ 我釘的 vs npm view latest   要網路 → 網路一抽風就紅
 *                               而一條會假紅的護欄,人很快學會忽略它
 * 🟢 裝起來的 vs 基線裡記的       離線、確定性
 * ```
 *
 * **「有沒有新版」不是風險，「被換掉而沒人看過」才是。**
 * 而後者順手蓋到版本號蓋不到的情形：有人手改 `package-lock`、
 * 或快取拿到不同的 tarball。
 *
 * ⟹ 「有沒有新版」的家是排程或 dependabot，不是測試套件。
 *
 * ## 兩個雜湊，而這裡只盯一個
 *
 * ```
 * checkerHash     建置指紋 —— 只改註解也會變。保守對【判決】是對的,
 *                 對這裡就太吵 ⟹ 只進報表
 * 🟢 semanticsHash  判定語義的指紋 —— 對方跑一組固定語料、只取判決骨架算出來
 *                 （不取錯誤訊息、不取 checkerHash）⟹ 這一條盯它
 * ```
 *
 * 🟢 **而它是量出來的，不是人標的**——所以不會有「忘了標語義變了」那種失敗。
 *
 * ## ⚠️ 它蓋不到什麼（對方自己先說的，而對我們更嚴重）
 *
 * `semanticsHash` 只量得到**那組語料走到**的判定。而我們這邊的重疊可能特別小：
 * 我們的 prelude **刻意自足、不 `import std`**（為了 hermetic），
 * 而他們的語料主要是 playground 的範例。
 *
 * （他們 2026-10-03 補了 6 段自足模式的程式進去——缺口縮小了，沒有消掉。
 * 真正補得起來的只有「拿我們自己的消費面當語料」，而那一條等這一條
 * 第一次紅了才做：**一個機制要先有消費者**。）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, RATCHET_NOTE } from '../helpers/guardrail'

const GUARD = 'cella-pinned'

interface Baseline {
  _meta: { note: string; ratchet: string }
  semanticsHash: string
  /** 只是報表用的，不當判準——它每次重建都變。 */
  seenCheckerHash: string
  seenVersion: string
}

interface pkg { version?: string; cella?: { checkerHash?: string; semanticsHash?: string } }

function installed(): pkg | null {
  const p = path.join(REPO_ROOT, 'node_modules/cella-lang/package.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8')) as pkg
}

/** 這一行是**精確釘選**嗎（不是 `^` / `~` / `*` / 區間）。 */
export const isExactPin = (spec: string | undefined): boolean =>
  spec !== undefined && /^\d+\.\d+\.\d+$/.test(spec)

/** `package.json` 裡寫的那一行——要是**精確**的，不是範圍。 */
function declared(): string | undefined {
  const j = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as
    { devDependencies?: Record<string, string> }
  return j.devDependencies?.['cella-lang']
}

describe('護欄：釘住的檢查器，判定語義不得悄悄換人', () => {
  it('★ 入口條件：套件真的裝起來了，而且它說得出自己的雜湊', () => {
    const p = installed()
    expect(p, '🔴 `node_modules/cella-lang` 不在 —— 下面那個「一樣」是假的').not.toBeNull()
    expect(p!.cella?.semanticsHash, '🔴 套件沒有 cella.semanticsHash —— 那這條護欄沒有東西可比')
      .toMatch(/^[0-9a-f]{8,}$/)
  })

  /**
   * 🔴 **精確釘選，而這【違反本 repo 的慣例】（17 個 `^` 範圍、零個精確），
   * 所以理由要寫在這裡。**
   *
   * 一般的套件用 `^` 是對的：上游遵守 semver，而修補版本我們要自動拿到。
   * 而這一個不同——它**每次 main 全綠就自動發一版**，版本號是 UTC 時間。
   * `^0.1.x` 等於「任何一版都可以」，於是一次 `npm i` 就可能換到沒有人看過的檢查器。
   *
   * > **精確釘選讓「升版」變成一次看得見的編輯。**
   */
  it('★ 注入：範圍必須被擋下，而精確釘選不得被誤報', () => {
    // 🔴 沒有這一支，上面那條「它是精確的」可能只是因為判準永遠為真。
    for (const bad of ['^0.1.202610031519', '~0.1.0', '*', 'latest', '>=0.1.0', undefined]) {
      expect(isExactPin(bad), `🔴 「${String(bad)}」是範圍，而判準放它過了`).toBe(false)
    }
    for (const ok of ['0.1.202610031519', '1.0.0']) {
      expect(isExactPin(ok), `🔴 「${ok}」是精確的，而判準誤報了`).toBe(true)
    }
  })

  it('★ 注入：兩個不同的雜湊必須被判為不同', () => {
    // 判準是一個 `toBe`，而「它會不會退化成永遠相等」要問一次。
    const a = '297ae8b368475761'
    const b = '297ae8b368475762'
    expect(a, '🔴 判準連差一個字元都看不出來').not.toBe(b)
  })

  it('🔴 硬性零：`package.json` 裡要精確釘選，不得是範圍', () => {
    const d = declared()
    expect(d, 'cella-lang 不在 devDependencies 裡').toBeTruthy()
    expect(isExactPin(d), `🔴 cella-lang 寫成「${d}」——那是範圍。\n`
      + '它每次 main 全綠就自動發一版，範圍等於「任何一版都可以」。\n'
      + '🟢 精確釘選讓「升版」變成一次看得見的編輯。').toBe(true)
  })

  it('🔴 硬性零：判定語義的雜湊，要與基線裡記的一樣', () => {
    const p = installed()!
    const now = p.cella!.semanticsHash!
    if (process.env.GENERATE_BASELINE === '1') {
      writeBaseline(GUARD, {
        semanticsHash: now,
        seenCheckerHash: p.cella?.checkerHash ?? '?',
        seenVersion: p.version ?? '?',
      })
    }
    const base = loadBaseline<Baseline>(GUARD)
    printReport('釘住的檢查器', [
      `裝起來的   cella-lang ${p.version}`,
      `semanticsHash  ${now}${now === base.semanticsHash ? '（與基線相同）' : ' 🔴 與基線不同'}`,
      `checkerHash    ${p.cella?.checkerHash}  ⚠️ 只是報表——它每次重建都變,不當判準`,
      '',
      '⚠️ 這一條不問「有沒有新版」（那要網路，而會假紅）。',
      '   它問的是：有沒有人把它換掉，而沒有人看過。',
    ])
    expect(
      now,
      `\n🔴 判定語義的雜湊變了：基線 ${base.semanticsHash} → 現在 ${now}\n`
      + '那表示那支檢查器對同一組語料給了不同的判決——**它不是同一個判準了**。\n'
      + '🟢 要做的不是改基線讓它變綠，是先看那個判決差在哪：\n'
      + '   拿舊版與新版各跑一次【我們自己的】形式核，比對判決。\n'
      + `   （舊版：npm i cella-lang@${base.seenVersion} 到一個暫存目錄）\n`
      + '   看過之後再上調基線，並在旁邊寫下【判決差在哪】。\n'
      + RATCHET_NOTE,
    ).toBe(base.semanticsHash)
  })
})
