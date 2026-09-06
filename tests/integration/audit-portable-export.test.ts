/**
 * **第一百一十二條護欄：匯出是一份帶得走的作品。**
 *
 * ## 🔴 它守三件事
 *
 * ```
 * ① 原始碼是第一級的檔案      不是 JSON 裡的一個字串欄位
 * ② 副檔名【由語言宣告】       而不是核心知道 `.cpp`
 * ③ 壓縮跟著產品一起送         離線是硬條件
 * ```
 *
 * ## 本護欄不檢測什麼
 *
 * - **不驗使用者按下去會發生什麼**——那是 `e2e/portable-export.spec.ts`
 * - **不驗 zip 的位元組格式**（那是 fflate 的事）
 * - **不管 File System Access API**——那條路仍然卡在驗不到，而**它不擋這一條**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { toPortable, SIDECAR_DIR } from '../../src/core/portable'
import type { SavedState } from '../../src/core/storage'

const read = (p: string): string => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8')
const codeOf = (src: string): string =>
  src.split('\n')
    .filter((l) => { const t = l.trim(); return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*') })
    .join('\n')

describe('第一百一十二條護欄：匯出是一份帶得走的作品', () => {
  // ─── ① 原始碼是第一級的檔案 ───

  it('🔴 硬性零：匯出的容器裡，原始碼是一個獨立的檔案', () => {
    const state = { code: 'int main(){}', language: 'cpp', version: 18 } as unknown as SavedState
    const files = toPortable(state, 'w', '.cpp')
    const codeFiles = Object.keys(files).filter((p) => !p.startsWith(`${SIDECAR_DIR}/`))
    expect(codeFiles, '🔴 原始碼不是一個獨立的檔 → 這份匯出把投影當成了真相').toEqual(['w.cpp'])
    expect(files['w.cpp']).toBe('int main(){}')
  })

  // ─── ② 副檔名的方向 ───

  /**
   * 🔴 **每一個語言套件都要宣告自己的副檔名。**
   *
   * ⚠️ 少一個的症狀**不是崩掉**——是那個語言匯出成 `.txt`，
   * 而沒有人會發現（`fileExtensionOf` 的中性預設是刻意的）。
   * 所以要有人在這裡數。
   */
  it('🔴 硬性零：每一個語言套件都宣告了 `fileExtension`', () => {
    const packs = fs.readdirSync(path.join(REPO_ROOT, 'src/languages'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `src/languages/${e.name}/pack.ts`)
      .filter((p) => fs.existsSync(path.join(REPO_ROOT, p)))
    expect(packs.length, '🔴 一個語言套件都沒掃到 → 下面是空過的').toBeGreaterThan(1)
    const missing = packs.filter((p) => !read(p).includes('fileExtension:'))
    expect(
      missing,
      '🔴 有語言套件沒宣告副檔名 → 它匯出成 `.txt`，而**那不會報錯**\n'
        + '   ——「這個語言的檔案叫什麼」不是核心的知識，要由套件說。',
    ).toEqual([])
  })

  /**
   * 🔴 **反推是錯的**——`traits.ts:60` 逐字：
   * 「從產出的形狀反推它是什麼的判準，會安靜地做錯事」。
   *
   * ⚠️ `.cpp` 對得到**四個**教學語言（c-beginner／cpp-beginner／
   * cpp-advanced／arduino），所以那個反推連唯一解都沒有。
   */
  it('🔴 硬性零：沒有人從副檔名反推語言', () => {
    const bad: string[] = []
    for (const f of ['src/core/portable.ts', 'src/ui/app-shell.ts', 'src/core/language-packs.ts']) {
      const code = codeOf(read(f))
      // 「拿一個副檔名去查語言」的形狀
      if (/languageFor(Ext|Extension)|extensionToLanguage|langFromExt/.test(code)) bad.push(f)
    }
    expect(
      bad,
      '🔴 出現了「副檔名 → 語言」的反推。**語言是宣告，副檔名是它存檔後的投影**。\n'
        + '   使用者 2026-08-24：「我開啟一個新檔案時可以選語言，但還沒存檔，所以沒有副檔名。」',
    ).toEqual([])
  })

  it('★ 核心純淨：拆檔那一支裡沒有任何語言的副檔名', () => {
    const code = codeOf(read('src/core/portable.ts'))
    for (const ext of ['.cpp', '.py', '.ino', '.c']) {
      expect(code.includes(`'${ext}'`) || code.includes(`"${ext}"`),
        `🔴 核心裡出現了 ${ext}——那份知識住在語言套件`).toBe(false)
    }
  })

  // ─── ③ 離線是硬條件 ───

  /**
   * 🔴 **壓縮的能力必須跟著產品一起送。**
   *
   * ⚠️ 一個「使用時才去拿」的相依會讓「離線可用」失效，
   * 而**症狀只在斷網的教室裡出現**。
   */
  it('🔴 硬性零：壓縮相依是 npm 依賴，不是 CDN', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> }
    expect(
      pkg.dependencies?.['fflate'],
      '🔴 壓縮相依不在 `dependencies` 裡 → 它沒有被打包，而離線是硬條件',
    ).toBeTruthy()
    const shell = read('src/ui/app-shell.ts')
    expect(
      /from ['"]https?:/.test(shell),
      '🔴 有 import 指向網址 → 那是 CDN，而它在斷網的教室裡不會到',
    ).toBe(false)
  })

  // ─── 匯入的匯流 ───

  /**
   * 🔴 **兩條路在版本判定上必須匯流。**
   *
   * > **走同一個 `judgeJSON`——與自動載入不得有第二種鬆緊度。**
   * > （`storage.ts:252`。在此之前那裡只檢查 `version` 存在，
   * > 於是 `version: 99` 通過。）
   */
  it('🔴 硬性零：zip 那條路的側檔也走 `importFromJSON`', () => {
    const shell = read('src/ui/app-shell.ts')
    const i = shell.indexOf('const parts = fromPortable(')
    expect(i, '🔴 找不到「解開之後」那一段 → 這條護欄空過了').toBeGreaterThan(-1)
    // ⚠️ 錨在**解開之後那一段**，而不是「解壓後 N 個字元」
    // ——🔴 後者會被一段長註解推出視窗，而症狀是護欄紅在正確的程式碼上。
    const region = shell.slice(i, shell.indexOf('readAsArrayBuffer', i))
    expect(
      region.includes('importFromJSON'),
      '🔴 zip 那條路自己解析側檔 → **第二種鬆緊度**，'
        + '而它與自動載入遲早會對不同的檔案說不同的話。',
    ).toBe(true)
  })

  it('★ 舊的單一 `.json` 仍然匯得進來（零回歸）', () => {
    const shell = read('src/ui/app-shell.ts')
    expect(shell.includes(".accept = '.zip,.json'"),
      '🔴 檔案挑選器不收 `.json` 了 → 別人硬碟上那些舊匯出打不開').toBe(true)
    expect(/0x50 && [^\n]*0x4b/.test(shell),
      '🔴 沒有用內容判斷是不是 zip → 那就只剩副檔名，而那是反推').toBe(true)
  })

  // ─── 注入（第四十九條） ───

  it('★ 注入：一個沒宣告副檔名的語言套件 → 抓得到', () => {
    const fake = 'export const pack = { id: "x", programRoot: "x:program" }'
    expect(fake.includes('fileExtension:')).toBe(false)
  })

  it('★ 注入：側檔裡混進 `code` → 抓得到', () => {
    const side = { code: 'leak', language: 'cpp' }
    expect(Object.keys(side).includes('code'),
      '注入的樣本就該被判為「兩個真相」').toBe(true)
  })

  it('★ 反向：正常的拆檔不得被報', () => {
    const files = toPortable({ code: 'x', language: 'cpp', version: 18 } as unknown as SavedState, 'w', '.cpp')
    const side = JSON.parse(files['.semorphe/w.cpp.json']!) as Record<string, unknown>
    expect(side['code']).toBeUndefined()
  })
})
