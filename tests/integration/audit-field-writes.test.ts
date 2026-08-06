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
 * 15 個已改成 `setFieldSafely`：**照樣吞，但數起來**。從沉默變成可量測。
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
import { printReport } from '../helpers/guardrail'
import { fieldWriteFailures, resetFieldWriteFailures, setFieldSafely } from '../../src/ui/field-write'
import { listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import fs from 'node:fs'
import path from 'node:path'

/** 還剩幾個「吞掉且不留痕跡」的 catch */
function silentCatches(): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = []
  for (const rel of listSourceFiles('src/ui')) {
    const lines = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').split('\n')
    lines.forEach((l, i) => {
      if (/catch\s*\([^)]*\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/.test(l)) {
        out.push({ file: rel, line: i + 1, text: l.trim().slice(0, 70) })
      }
    })
  }
  return out
}

const silent = silentCatches()

describe('護欄：欄位寫入不再沉默', () => {
  it('產出可讀報表', () => {
    printReport('欄位寫入護欄', [
      '⚠️ **這裡的 0 不代表「使用者不會遇到」，只代表「測試沒跑到」。**',
      '   這些呼叫在積木建立與 mutator 重組的路徑上，主要發生在瀏覽器裡。',
      '   這條護欄的價值不在數字，在於那 15 個地方從此**不再是沉默的**。',
      '',
      `測試期間的欄位寫入失敗：${fieldWriteFailures().length} 次`,
      ``,
      ``,
      `仍然「吞掉且不留痕跡」的 catch：${silent.length} 個`,
      ...silent.map((s) => `  ${s.file}:${s.line}  ${s.text}`),
    ])
    expect(silent.length).toBeGreaterThanOrEqual(0)
  })

  it('★ 注入：寫入不存在的欄位必須被記下來，不是消失', () => {
    resetFieldWriteFailures()
    const fake = {
      type: '__probe__',
      setFieldValue(): void {
        throw new Error('field not found')
      },
    }
    const ok = setFieldSafely(fake, 'NO_SUCH_FIELD', 'x')
    expect(ok, '寫入失敗卻回報成功').toBe(false)
    expect(fieldWriteFailures(), '失敗沒被記下來 → 又變回沉默的了').toHaveLength(1)
    expect(fieldWriteFailures()[0].field).toBe('NO_SUCH_FIELD')
    resetFieldWriteFailures()
  })

  it('★ 注入：寫入成功不得被誤記', () => {
    resetFieldWriteFailures()
    expect(setFieldSafely({ type: 'x', setFieldValue() {} }, 'F', 1)).toBe(true)
    expect(fieldWriteFailures()).toHaveLength(0)
  })

  it('剩下的沉默 catch 只有一個，而且有理由', () => {
    // `unplug()` 在積木已經拔掉時擲錯是正常情形，不是缺陷——與那 15 個不同
    expect(silent.length).toBeLessThanOrEqual(1)
  })
})
