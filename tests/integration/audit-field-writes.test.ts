/**
 * 欄位寫入失敗（第十一條護欄）
 *
 * ## 這條量的是什麼
 *
 * `block-registrar.ts` 原本有 16 個 `try { setFieldValue(...) } catch { /* ignore *\/ }`。
 * 專案記憶點名過它們：
 *
 * > 「正好吞掉『欄位名對不上』這個**已知會發生**的錯誤。」
 *
 * 那正是 `cin >> s` 變成 `cin >> x` 那一族——欄位名對不上時靜靜地退回預設值，
 * 從使用者角度「程式碼就是錯了」，而系統毫無提示。
 *
 * 15 個改成了 `setFieldSafely`（照樣吞，但數起來），而它們 2026-08-26 隨命令式積木一起退場
 *（`block-registrar.ts:45` 🪦）——之後產品直接呼叫 `setFieldValue`，失敗會擲出去，不再沉默。
 *
 * 🔴 **2026-10-31 大掃除量到兩件事**：
 * - `setFieldSafely` 從那天起產品零呼叫，這裡兩支「★ 注入」測的是它**自己**——
 *   一條驗產品不走的路的護欄。helper 與那兩支一起刪。
 * - 掃描的正則只認 `catch (e) { /* ignore *\/ }`，**沒有括號的 `catch { /* ignore *\/ }` 一個都數不到**
 *   ⟹ 報表上的 0 是量不到，不是沒有。修正後量到 1 個（見最後一支）。
 *
 * ## ⚠️ 這條護欄的能力邊界（很重要）
 *
 * **它只數得到測試套件實際跑過的路徑。** 這些呼叫在積木建立與 mutator 重組
 * 的路徑上，而那些主要發生在瀏覽器裡。所以：
 *
 * > **這裡的 0 不代表「使用者不會遇到」，只代表「測試沒跑到」。**
 *
 * 這條護欄的價值不在數字，在於**那 15 個地方從此不再是沉默的**——真的發生時
 * 有地方查得到，而不是什麼痕跡都沒有。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { printReport, listSourceFiles, REPO_ROOT } from '../helpers/guardrail'

/** 「吞掉且不留痕跡」的 catch——有沒有綁定變數都算（`catch (e)`／`catch`）。 */
const SILENT = /catch\s*(?:\([^)]*\))?\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/

function silentCatches(): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = []
  for (const rel of listSourceFiles('src/ui')) {
    const lines = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (SILENT.test(l)) out.push({ file: rel, line: i + 1, text: l.trim().slice(0, 70) })
    })
  }
  return out
}

const silent = silentCatches()

describe('護欄：欄位寫入不再沉默', () => {
  it('產出可讀報表', () => {
    printReport('欄位寫入護欄', [
      `仍然「吞掉且不留痕跡」的 catch：${silent.length} 個`,
      ...silent.map((s) => `  ${s.file}:${s.line}  ${s.text}`),
    ])
    expect(silent.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：兩種寫法都要數得到——量不到的 0 和真的 0 長得一樣', () => {
    expect(SILENT.test('try { f() } catch (e) { /* ignore */ }')).toBe(true)
    expect(SILENT.test('try { f() } catch { /* ignore */ }'), '🔴 沒有括號的 catch 又看不見了').toBe(true)
    expect(SILENT.test('try { f() } catch { /* 舊瀏覽器沒有就算了 */ }'), '有寫理由的不算沉默').toBe(false)
  })

  it('剩下的沉默 catch 只有一個，而且有理由', () => {
    // 那一個是 `ui/app.ts` 在游標移動時取消 Blockly 的選取——沒有選取中的積木時擲錯是正常情形。
    expect(silent.length).toBeLessThanOrEqual(1)
  })
})
