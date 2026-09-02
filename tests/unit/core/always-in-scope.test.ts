/**
 * 🔴 **不是概念的東西，不受「這一課教什麼」管。**
 *
 * ## 病歷（2026-09-02，Arduino IDE）
 *
 * 使用者在 Arduino 專題第一課看到 sketch 樣板那兩行註解變成暗的積木：
 * 「理論上這邊註解不應該是淡的呀」「還是一樣啊」。
 *
 * 三層各一個缺陷，而它們疊在一起：
 *
 * ```
 * ① 超出範圍用 <g> 的 opacity        → 連子樹一起暗（註解坐在 setup 裡面）
 * ② 註解本來就被判成「超出範圍」      → 因為課程的清單裡沒有它
 * ③ 鷹架的淡用 opacity              → 裡面的東西背景是透的，看起來也灰
 * ```
 *
 * 這一支守的是 ②：**註解不是一個概念**，它是使用者（或樣板）寫在旁邊的話。
 * 把它打暗等於對學生說「這一行你不該碰」，而那句話是假的。
 *
 * > **「這一課的範圍」管的是概念。
 * > 一個不是概念的東西落在那張表外面，不代表它不該在這裡。**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { isAlwaysInScope } from '../../../src/core/component/traits'

describe('永遠在範圍內的那幾顆', () => {
  it('★ 入口條件：這個判定認得出「有宣告」與「沒宣告」', () => {
    expect(isAlwaysInScope('cpp:comment'), '註解沒有宣告 alwaysInScope').toBe(true)
    expect(isAlwaysInScope('cpp:loop_for'), '迴圈是概念，它不該永遠在範圍內').toBe(false)
  })

  it('🔴 每一個語言的註解都要宣告——漏一個，那個語言的學生就會看到暗的註解', () => {
    const missing = ['cpp', 'python'].filter((lang) => {
      const f = resolve(__dirname, '../../..', `src/components/${lang}/comment/component.json`)
      if (!existsSync(f)) return false
      return JSON.parse(readFileSync(f, 'utf8')).traits?.alwaysInScope !== true
    })
    expect(missing, `這些語言的註解會被課程的範圍打暗：\n  ${missing.join('\n  ')}`).toEqual([])
  })

  it('⚠️ 而它是一份【短名單】——每多一顆都要說得出「它為什麼不是概念」', () => {
    // 🔴 這一條擋的是**擴散**：`alwaysInScope` 很好用，而它一旦被拿來
    //    「讓這顆別再變暗」，課程的範圍就會慢慢失去意義。
    const dirs = ['cpp', 'python'].flatMap((lang) => {
      const base = resolve(__dirname, '../../..', `src/components/${lang}`)
      return readdirSync(base).map((d) => `${lang}/${d}`)
    })
    const declared = dirs.filter((d) => {
      const f = resolve(__dirname, '../../..', `src/components/${d}/component.json`)
      return existsSync(f) && JSON.parse(readFileSync(f, 'utf8')).traits?.alwaysInScope === true
    })
    expect(declared.sort(), `多出來的那幾顆要先說服人：\n  ${declared.join('\n  ')}`)
      .toEqual(['cpp/comment', 'python/comment'])
  })
})
