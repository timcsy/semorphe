/**
 * **一課宣告了的積木，學生就要拿得到**（2026-09-20，第 206 刀）。
 *
 * ## 🔴 它從哪來
 *
 * 層級樹退場那一刀（205）拿掉了「分支」那一層，而**留著 `主題 ∩ 課` 那個交集**
 * ——天花板換了個名字還在。開瀏覽器量才發現：
 *
 * ```
 * arduino/13-溫濕度  宣告了 cpp:container_iter
 *                    而 arduino 的清單沒有它
 *                    → 學生在那一課拿不到課文要他用的積木，而沒有人出聲
 * ```
 *
 * 交集的理由原本寫著「課宣告了一顆這個目標根本沒有的元件時，它不該憑空出現」。
 * ⚠️ **而那個理由把兩件事混成一件**：
 *
 * ```
 * 課宣告了一顆【不存在】的元件     🔴 是錯的 → 幽靈引用，由下面第二支擋
 * 課宣告了一顆【主題沒列】的元件   🟢 是課的決定 → 而交集把它靜默吃掉了
 * ```
 *
 * > **一個「以防萬一」的交集，擋掉的第一個東西通常是別人刻意放進去的。**
 *
 * ## 判準
 *
 * 這一條**不看主題**——課說了算。它只問兩件事：
 * ① 課宣告的每一顆都**存在**（不是幽靈）
 * ② 而既然存在，工具箱那一層就不得再擋它（由 ① ＋ 「課說了算」的實作保證）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { loadToolbox } from '../helpers/toolbox'

const { allComponents } = loadToolbox()
const known = new Set(allComponents.map((c) => c.componentId))

interface LessonRef { file: string; components: string[] }

function allLessons(): LessonRef[] {
  const root = path.join(REPO_ROOT, 'lessons')
  const out: LessonRef[] = []
  if (!fs.existsSync(root)) return out
  for (const track of fs.readdirSync(root)) {
    const tdir = path.join(root, track)
    if (!fs.statSync(tdir).isDirectory()) continue
    for (const ch of fs.readdirSync(tdir)) {
      const f = path.join(tdir, ch, 'lesson.json')
      if (!fs.existsSync(f)) continue
      const d = JSON.parse(fs.readFileSync(f, 'utf8')) as { components?: string[] }
      out.push({ file: `${track}/${ch}`, components: d.components ?? [] })
    }
  }
  return out
}

const LESSONS = allLessons()

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 入口條件：真的掃到課與元件（否則下面在驗空氣）', () => {
    expect(LESSONS.length, '🔴 一堂課都沒掃到 → 是路徑壞了').toBeGreaterThan(50)
    expect(known.size, '🔴 零顆元件 → 是載入壞了').toBeGreaterThan(150)
    const total = LESSONS.reduce((n, l) => n + l.components.length, 0)
    expect(total, '🔴 每一課的 components 都是空的 → 是解析壞了').toBeGreaterThan(200)
  })

  it('★ 注入一顆幽靈 → **必須被報出**', () => {
    const ghost = ['__不存在的元件__'].filter((c) => !known.has(c))
    expect(ghost, '合成的幽靈沒有被報出 → **檢查壞了，不是課程健康**').toEqual(['__不存在的元件__'])
  })

  it('★ 反向：注入一顆真元件 → **必須不被報出**', () => {
    expect(['cpp:print'].filter((c) => !known.has(c)), '真元件被報成幽靈 → 這條會亂叫').toEqual([])
  })
})

describe('一課宣告了的積木，學生就要拿得到', () => {
  it('🔴 課宣告的每一顆元件都要真的存在', () => {
    const ghosts = LESSONS.flatMap((l) =>
      l.components.filter((c) => !known.has(c)).map((c) => `${l.file} → ${c}`))
    expect(
      ghosts,
      '🔴 課宣告了一顆不存在的元件。\n'
      + '   ⚠️ 「課說了算」之後這一條是【唯一】的防線——在此之前是主題那一份\n'
      + '   順手擋掉的，而它同時也擋掉了課刻意宣告的東西。',
    ).toEqual([])
  })
})
