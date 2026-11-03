/**
 * **護欄：產品的入口只登記 Cella**（spec 205 T008，重構 6c-3，2026-11-03）。
 *
 * ## 🔴 它守的是一次「拿掉退路」的決定
 *
 * 6c 之前，學生按「執行」時 Cella 接不了（翻不出、還在載入）就退回 JS 直譯器——它用 JS 近似 C++，
 * 跑出來的可能和真的編譯器不同，而且不會說。T008 拿掉了那一行登記：執行只走 Cella，還沒好時顯示「準備中」，
 * 翻不出時照實說（使用者 2026-11-01 定：四族補完才切，history/323；四族在 Cella 0.1.202611030133 到齊）。
 *
 * > **一個被拿掉的退路，最容易用「先暫時加回來」的形式回來——而它回來的那天測試全綠。**
 *
 * 所以這一支數的是「產品的入口裡，有誰在登記 JS 直譯器」——硬性零。6c-4 刪掉 `providers/js-interpreter/` 之後，
 * 這一支的第二條（那個資料夾還在不在）會紅，那時改成斷言它不存在。
 *
 * ## ⚠️ 自我否證
 * 入口一個都讀不到 ⟹ 這支在驗空氣（★ 入口條件）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
/** 產品的入口與組裝點：網頁版、兩個宿主共用的組裝點、擴充的 webview */
const ENTRIES = ['src/main.ts', 'src/ui/app.ts', ...fs.readdirSync(path.join(ROOT, 'src/vscode/webview')).filter((f) => f.endsWith('.ts')).map((f) => `src/vscode/webview/${f}`)]

/** 偵測器：這一段原始碼有沒有把 JS 直譯器帶進產品的入口 */
export function bringsJsInterpreter(src: string): boolean {
  return /providers\/js-interpreter|jsInterpreterProvider/.test(src)
}

describe('護欄：產品的入口只登記 Cella（spec 205 T008）', () => {
  it('★ 注入：偵測器認得出那兩種寫法，也不會把 Cella 的登記誤認', () => {
    expect(bringsJsInterpreter("import { jsInterpreterProvider } from '../providers/js-interpreter'")).toBe(true)
    expect(bringsJsInterpreter('registerProvider(jsInterpreterProvider)')).toBe(true)
    expect(bringsJsInterpreter("registerProvider(createCellaProvider(() => new Worker(url)), { first: true })")).toBe(false)
  })

  it('★ 入口條件：讀得到入口，而且網頁版與擴充都登記了 Cella', () => {
    const src = ENTRIES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    expect(src.length).toBeGreaterThanOrEqual(3)
    expect(fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8'), '網頁版的入口要登記 Cella').toMatch(/registerProvider\(createCellaProvider/)
    expect(fs.readFileSync(path.join(ROOT, 'src/vscode/webview/cella.ts'), 'utf8'), '擴充的入口要登記 Cella').toMatch(/registerProvider\(createCellaProvider/)
  })

  it('🔴 硬性零：產品的入口不得 import 或登記 JS 直譯器', () => {
    const hits = ENTRIES.filter((f) => bringsJsInterpreter(fs.readFileSync(path.join(ROOT, f), 'utf8')))
    expect(hits, `🔴 JS 直譯器回到了產品的入口：${hits.join('、')}\n   執行只走 Cella（spec 205 T008）——還沒好時顯示「準備中」，翻不出時照實說，沒有退路。`).toEqual([])
  })
})
