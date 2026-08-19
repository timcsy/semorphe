/**
 * spec 142 · User Story 1：**學生拿不到他的板子上不存在的積木。**
 *
 * ## 為什麼需要它
 *
 * 階段 6.16 的五顆 ESP32 元件（觸摸感應 ＋ LEDC PWM 四件套）都在
 * `topics/arduino.json` 的同一棵層級樹裡，而目標沒有板子這一維
 * ——**用 Uno 的學生拉得到它們，燒錄時才發現編不過**。
 *
 * ⚠️ 而那個錯誤訊息出現在 Arduino IDE，**不在 Semorphe 裡**
 * ——學生無從得知是積木選錯了。
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果 `esp32` 那一支也看不到那五顆，代表過濾寫反了或工具箱根本沒組起來，
 * 不是「Uno 過濾成功」。** 每一條負向斷言前面都有一個正向錨點。
 */
import { describe, it, expect } from 'vitest'
import { loadToolbox } from '../helpers/toolbox'
import type { Target } from '../../src/core/types'
import unoTarget from '../../src/languages/cpp/targets/arduino-uno.json'
import nanoTarget from '../../src/languages/cpp/targets/arduino-nano.json'
import esp32Target from '../../src/languages/cpp/targets/esp32.json'
import cppTarget from '../../src/languages/cpp/targets/cpp.json'
import cTarget from '../../src/languages/cpp/targets/c.json'
import cppCompetitiveTarget from '../../src/languages/cpp/targets/cpp-competitive.json'

/** ESP32 才有的五顆——四件套 PWM ＋ 觸摸 */
const ESP32_ONLY = [
  'cpp_touch_read',
  'cpp_pwm_attach',
  'cpp_pwm_open',
  'cpp_pwm_tie',
  'cpp_pwm_write',
]

function typesFor(target: Target): Set<string> {
  const { snapshot } = loadToolbox([], [], target)
  return new Set(snapshot.categories.flatMap((c) => c.blocks))
}

describe('spec 142 · US1：板子決定工具箱裡有什麼', () => {
  // ── ★ 正向錨點：先證明工具箱真的組起來了 ─────────────────────
  it('★ 錨點：ESP32 拿得到那五顆', () => {
    const t = typesFor(esp32Target as Target)
    expect(t.size, '工具箱是空的 → 下面每一條負向斷言都空過').toBeGreaterThan(50)
    for (const b of ESP32_ONLY) {
      expect(t.has(b), `${b} 在 ESP32 上也拿不到 → 過濾寫反了`).toBe(true)
    }
  })

  it('★ 錨點：Uno 仍然拿得到一般的 Arduino 積木', () => {
    // 🔴 沒有這一條的話，「Uno 拿不到那五顆」也可能是因為
    //    **整個 Arduino 分類消失了**——那是過濾過頭，不是成功。
    const t = typesFor(unoTarget as Target)
    expect(t.has('cpp_pin_mode'), 'Uno 連 pinMode 都沒有 → 過濾過頭').toBe(true)
    expect(t.has('cpp_digital_write')).toBe(true)
  })

  // ── 主張 ──────────────────────────────────────────────
  it('🔴 Uno 拿不到那五顆', () => {
    const t = typesFor(unoTarget as Target)
    const leaked = ESP32_ONLY.filter((b) => t.has(b))
    expect(leaked, `Uno 的工具箱裡有它編不過的積木：${leaked.join('、')}`).toEqual([])
  })

  it('🔴 Nano 拿不到那五顆——**逐顆斷言，不從 Uno 推論**', () => {
    // ⚠️ `experience.md`「一叢違規不一定同一個根因」：共用一個症狀
    //    不代表共用一個根因。Nano 有自己的宣告檔，它可能被寫錯。
    const t = typesFor(nanoTarget as Target)
    for (const b of ESP32_ONLY) {
      expect(t.has(b), `${b} 在 Nano 上拿得到`).toBe(false)
    }
    expect(t.has('cpp_pin_mode'), 'Nano 連 pinMode 都沒有 → 過濾過頭').toBe(true)
  })

  it('🔴 Uno 與 Nano 的可見集合完全相同', () => {
    expect([...typesFor(unoTarget as Target)].sort())
      .toEqual([...typesFor(nanoTarget as Target)].sort())
  })

  // ── 反向：非硬體目標一格都不能變（FR-006）────────────────────
  it('🔴 三個既有的非硬體目標，可見集合與「不過濾」完全相同', () => {
    const unfiltered = [...typesFor({ id: 'x', name: 'x', topic: 't', style: 's' } as Target)].sort()
    for (const t of [cppTarget, cTarget, cppCompetitiveTarget]) {
      expect([...typesFor(t as Target)].sort(),
        `目標 ${(t as Target).id} 因為多了 provides 這一格而少了東西 → 預設值方向寫反了`)
        .toEqual(unfiltered)
    }
  })
})
