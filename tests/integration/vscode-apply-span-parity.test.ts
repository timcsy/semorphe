/**
 * 🔴 **宿主套用範圍編輯的語義，必須與積木側算鏡像的語義【是同一個函式】。**
 *
 * ## 病歷（2026-08-18，Arduino IDE，連續四張截圖）
 *
 * ```cpp
 * }Serial.println();      ← 兩行被接成一行
 * ```
 *
 * `panel.ts` 曾經自己把「行範圍」翻譯成 `vscode.Range`：
 *
 * ```ts
 * new vscode.Range(new vscode.Position(span.startLine, 0), doc.lineAt(lineCount - 1).range.end)
 * ```
 *
 * ⚠️ 在檔尾追加時 `span.startLine === lineCount`，而 `Position(lineCount, 0)`
 * **是一個不存在的位置**——VSCode 把它夾到檔尾，於是新文字接在最後一行
 * **後面**而不是**下面**。
 *
 * 🔴 而它會**自我延續**：檔案一旦沒了結尾換行，之後每一次追加都再合併一次。
 *
 * > **兩邊各自把同一份規格翻譯一次，就會有兩份規格；
 * > 而它們的分歧只在資料被寫壞的時候才看得見。**
 *
 * ## ⚠️ 這支測試守得住什麼、守不住什麼
 *
 * 🟢 守得住：模型本身（`rewriteSpan` → `applySpan`）在**檔尾沒有換行**時仍然可逆。
 * 🔴 守不住：`panel.ts` 有沒有真的用它——那由下面那條**靜態**檢查頂著。
 *    ⚠️ 而真正的執行語義要在 VSCode 裡才驗得到，這一點不假裝。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rewriteSpan, applySpan } from '../../src/core/projection/rewrite-span'

/** 走一趟：算出範圍 → 套用 → 應該等於目標。 */
function roundTrip(before: string, after: string): string {
  const span = rewriteSpan(before, after)
  return span === null ? before : applySpan(before, span)
}

describe('範圍編輯的語義只有一份', () => {
  it('🔴 正向錨點：一般的行內修改可逆（不然下面每一條都空過）', () => {
    const before = 'void setup() {\n}\nvoid loop() {\n}\n'
    const after = 'void setup() {\n  int x;\n}\nvoid loop() {\n}\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('🔴 檔尾沒有換行時，在後面追加一行——這就是 `}Serial.println();` 的形狀', () => {
    const before = 'void loop() {\n}'          // ⚠️ 結尾【沒有】換行
    const after = 'void loop() {\n}\nSerial.println();'
    expect(roundTrip(before, after), '🔴 追加時把兩行接成一行了').toBe(after)
  })

  it('檔尾有換行時追加', () => {
    const before = 'void loop() {\n}\n'
    const after = 'void loop() {\n}\nSerial.println();\n'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('⚠️ 自我延續的那一步：已經合併過的檔案再追加一次', () => {
    const before = 'void loop() {\n}Serial.println();'
    const after = 'void loop() {\n}\nSerial.println();\nSerial.println();'
    expect(roundTrip(before, after)).toBe(after)
  })

  it('整份被換掉', () => {
    expect(roundTrip('a\nb\n', 'x\ny\nz\n')).toBe('x\ny\nz\n')
  })

  it('刪到只剩一行、而且沒有結尾換行', () => {
    expect(roundTrip('a\nb\nc\n', 'a')).toBe('a')
  })

  it('空檔案 → 有內容', () => {
    expect(roundTrip('', 'int x;\n')).toBe('int x;\n')
  })

  it('🔴 靜態：`panel.ts` 不得自己把行範圍翻譯成 Position', () => {
    // ⚠️ 去掉註解再掃——檔案裡刻意留了那段錯誤翻譯當反例。
    const src = readFileSync('src/vscode/panel.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    expect(src, '🔴 又自己翻譯一次行範圍了——用 applySpan')
      .not.toMatch(/new vscode\.Position\(\s*span\./)
    expect(src, '🔴 宿主必須用與積木側同一個 applySpan').toContain('applySpan(before, span)')
  })
})
