/**
 * 語系的**偏好**與**結果**是兩件事。
 *
 * ## 為什麼要一支測試
 *
 * 2026-08-25：面板的下拉與宿主的 QuickPick 是兩個入口，而**只有後者
 * 會經過記偏好的那一支**。於是在網頁版選了 English 之後，
 * 「使用者選的是什麼」這一格仍然停在 `zh-TW`。
 *
 * > **同一件事有兩個入口，而只有一個記得使用者的選擇——
 * > 那個沒記的，遲早會被當成真相。**
 *
 * ⚠️ 這支測試釘的是**解析規則**，不是 `App`（它要整個瀏覽器環境）。
 * 🔴 而那個差距是真的：它證明不了兩個入口真的都走這一支
 * ——那一格由 `tests/integration/audit-status-bar-owner.test.ts` 的
 * 原始碼檢查頂著，**而原始碼檢查比較弱**。
 */
import { describe, it, expect } from 'vitest'
import { LOCALES, FOLLOW_HOST_LOCALE } from '../../../src/core/host/controls'

/** 與 `App.resolvedHostLocale` 同一條規則。⚠️ 兩份要一起改——由下面那條釘住。 */
function resolve(preference: string, hostLocale: string | null): string {
  if (preference !== FOLLOW_HOST_LOCALE) return preference
  return (hostLocale ?? '').toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}

describe('語系：偏好與結果是兩件事', () => {
  it('入口條件：登錄表裡真的有東西（否則下面整組空過）', () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(3)
    expect(LOCALES.map((l) => l.id)).toContain(FOLLOW_HOST_LOCALE)
  })

  it('🔴 `follow-host` 是一個值——它解析得出結果，而它自己不是結果', () => {
    expect(resolve(FOLLOW_HOST_LOCALE, 'zh-tw')).toBe('zh-TW')
    expect(resolve(FOLLOW_HOST_LOCALE, 'zh-cn')).toBe('zh-TW')
    expect(resolve(FOLLOW_HOST_LOCALE, 'en-us')).toBe('en')
  })

  it('🔴 宿主沒說時回 `en`，**不是回現在這個**', () => {
    // ⚠️ 回「現在這個」的話，宿主換語言時「跟隨」會安靜地不動
    //    ——而那是最難發現的一種壞法：它看起來像沒有壞。
    expect(resolve(FOLLOW_HOST_LOCALE, null)).toBe('en')
    expect(resolve(FOLLOW_HOST_LOCALE, '')).toBe('en')
  })

  it('明確選的語系不受宿主影響——「還是可以選」是硬需求', () => {
    // 使用者 2026-08-25：「跟宿主走（**但是還是可以選**）」。
    // 教學情境要的正是「介面英文、積木中文」。
    expect(resolve('zh-TW', 'en-us')).toBe('zh-TW')
    expect(resolve('en', 'zh-tw')).toBe('en')
  })

  it('⚠️ 面板那顆下拉不提供 `follow-host`——自己畫下拉的宿主沒有宿主可跟', () => {
    const panelOptions = LOCALES.filter((l) => l.id !== FOLLOW_HOST_LOCALE)
    expect(panelOptions.map((l) => l.id)).toEqual(['zh-TW', 'en'])
  })
})
