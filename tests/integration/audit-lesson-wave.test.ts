/**
 * **第一百零四條護欄：宣告了看法的課，要是一條語意波。**
 *
 * 🔴 外部證據（`concepts/認知鷹架.md`）：Maton 的 LCT「語意波」——
 * **已被英國 NCCE 列為十條教學原則之一**：
 *
 * > 有效的課會**下沉（unpack）再上浮（repack）**。
 * > **平的語意曲線（一直抽象，或一直具體）教學效果差。**
 *
 * 而 Semorphe 的三種投影天生就是那條軸，所以「這一課建議什麼版面」
 * **有一個可檢查的判準**：這一課有沒有下沉再上浮？
 *
 * ## ⚠️ 這一條【不強迫每一課都宣告】
 *
 * 沒有宣告 `view` 的課不受這一條管——那是「還沒設計」，不是「設計錯了」。
 * 🔴 而**一旦宣告了兩步以上，它就要是一條波**：宣告了一半的曲線
 * （只下沉沒上浮）比不宣告更糟——它把學生拆開之後沒有收回來。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果沒有任何一課宣告了看法，這支什麼都沒驗——不是「每一課都對」。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { waveOf, LESSON_VIEWS, type LessonView } from '../../src/core/semantic-wave'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

interface Case { id: string; views: LessonView[] }

function collect(): Case[] {
  const root = path.join(ROOT, 'lessons')
  const out: Case[] = []
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const f = path.join(root, track.name, dir.name, 'lesson.json')
      if (!fs.existsSync(f)) continue
      const j = JSON.parse(fs.readFileSync(f, 'utf8')) as { tasks?: { view?: string }[] }
      const views = (j.tasks ?? []).map((t) => t.view).filter((v): v is LessonView =>
        typeof v === 'string' && LESSON_VIEWS.includes(v as LessonView))
      out.push({ id: `${track.name}/${dir.name}`, views })
    }
  }
  return out
}

const CASES = collect()
const DECLARED = CASES.filter((c) => c.views.length >= 2)

describe('第一百零四條護欄：課的語意波', () => {
  it('★ 入口條件——真的有課宣告了看法', () => {
    expect(
      DECLARED.length,
      '🔴 沒有任何一課宣告了兩步以上的看法 → 下面那條是空過的',
    ).toBeGreaterThanOrEqual(1)
  })

  it('🔴 宣告了兩步以上的課，必須下沉再上浮', () => {
    const flat = DECLARED
      .map((c) => ({ ...c, wave: waveOf(c.views) }))
      .filter((c) => !c.wave.isWave)
      .map((c) => `${c.id}：${c.views.join(' → ')}（高度 ${c.wave.levels.join(' ')}）` +
        `${c.wave.descends ? '——下沉了而沒有收回來' : '——一路沒有下沉'}`)
    expect(
      flat,
      '🔴 這幾課的語意曲線不是一條波。平的曲線（一直抽象或一直具體）教學效果差，\n' +
        '   而「下沉了沒收回來」是把學生拆開之後丟在那裡。\n' +
        '   判準與出處：`core/semantic-wave.ts` · `concepts/認知鷹架.md`',
    ).toEqual([])
  })

  it('★ 注入：一條平的曲線 → 會報', () => {
    expect(waveOf(['blocks', 'blocks', 'blocks']).isWave).toBe(false)
  })

  it('★ 注入：下沉了沒上浮 → 會報', () => {
    expect(waveOf(['code', 'blocks']).isWave).toBe(false)
  })

  it('★ 注入：一條真的波 → 不報', () => {
    expect(waveOf(['compare', 'blocks', 'code']).isWave).toBe(true)
  })
})
