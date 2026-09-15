/**
 * **第一百三十一條護欄：一節放了程式碼，就要有一句話叫他做什麼。**
 *
 * ## 它從哪來——整班回饋裡出現 5 次（2026-09-15）
 *
 * ```
 * 「好難 太難 根本看不懂在幹嘛」
 * 「有些地方會看不懂他要我做甚麼，但問了之後我就懂了」
 * 「我覺得最難的是我看不懂要幹嘛」
 * 「第二課 他的敘述沒有很清楚整個完全看不懂」
 * ```
 *
 * 實測第 2 課「四種基本型別」那一節：它放了四行程式碼，然後直接講型別
 * ——**從頭到尾沒有一句話說「照著打」**。學生看著那段碼，不知道那是
 * 要他打的、還是給他看的。
 *
 * > **一段程式碼放在課文裡，有兩種可能的意思（照著做／看一眼就好），
 * > 而它自己說不出是哪一種——那個歧義由讀者付。**
 *
 * ## ⚠️ 判準是一份【動詞表】，而它是啟發式的
 *
 * 「有沒有叫他做事」推導不出來，只能看有沒有祈使句。所以這一條：
 *
 * ```
 * 🟢 有動作動詞      打上／拖進來／按執行／改成／加上／選「…」…
 * 🟢 明說不用做      「不用打」「看一眼就好」——那也是一個清楚的指示
 * 🔴 兩者都沒有      那一節的程式碼意義不明
 * ```
 *
 * ⚠️ **它會漏報**（用了表上沒有的動詞），而**不太會誤報**
 * ——一節真的有祈使句而表上一個字都沒中，很少見。
 * 漏報讓數字偏低，而棘輪只要求它往下走，所以偏低是安全的那一側。
 *
 * > **一個啟發式的判準，要說得出它偏向哪一邊——
 * > 而它該偏向「少報」，不是「多報」。**
 *
 * ## 這一條不檢測什麼
 *
 * - **不檢測那句話好不好**——「打上這四行」與「照著下面做」對它一樣。
 * - **不檢測順序**（動作句在程式碼前面還是後面）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { loadBaseline, assertRatchet } from '../helpers/guardrail'

const ROOT = path.resolve(__dirname, '../..')

/**
 * 「這一段你要做什麼」說得出口的那些字。
 *
 * ⚠️ 後兩個（`不用打`／`看一眼就好`）是**反向**的指示——它們一樣清楚，
 * 所以一樣算數。少了它們，純參考的那幾節會被逼著加一句假的動作。
 */
const FENCE = '\x60'.repeat(3)

const ACTION = /打上|打這|把它打|拖進來|拖到|拖一|按一下|按「|按執行|改成|換成|加上|加一|選「|點一下|點那|試試看把|自己打|不用打|看一眼就好/

export interface Finding { lesson: string; section: string }

/** 這一課裡，哪幾個「有程式碼而沒說要做什麼」的小節。 */
export function sectionsWithoutAction(md: string, lesson = ''): Finding[] {
  const out: Finding[] = []
  for (const [, title, body] of `\n${md}`.matchAll(/\n(## [一二三四五六七八九][^\n]*)\n([\s\S]*?)(?=\n## |$)/g)) {
    // 🪦 **不寫字面的三連反引號**——一行奇數個反引號會讓整個檔的配對錯開一位，
    //    而錯開的配對會生出橫跨數十行的假「程式碼片段」，被第三十一／七十二條
    //    當成 C++ 語料吃進去（今天第三次踩到）。
    if (!body.includes(FENCE)) continue
    if (ACTION.test(body)) continue
    out.push({ lesson, section: title.trim() })
  }
  return out
}

function lessonFiles(): string[] {
  const out: string[] = []
  const lessons = path.join(ROOT, 'lessons')
  for (const track of fs.readdirSync(lessons)) {
    const td = path.join(lessons, track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const l of fs.readdirSync(td)) {
      const f = path.join(td, l, 'lesson.md')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

describe('第一百三十一條護欄：一節放了程式碼就要說得出要做什麼', () => {
  const files = lessonFiles()

  it('★ 入口條件：真的掃到課文了', () => {
    expect(files.length, '🔴 一課都沒掃到 → 下面在驗空集合').toBeGreaterThan(50)
  })

  it('★ 棘輪：說不出要做什麼的小節，只准變少', () => {
    const bad = files.flatMap((f) =>
      sectionsWithoutAction(fs.readFileSync(f, 'utf8'),
        `${path.basename(path.dirname(path.dirname(f)))}/${path.basename(path.dirname(f))}`))
    assertRatchet([['說不出要做什麼的小節', bad.length]], 'lesson-tells-what-to-do')
  })

  it('★ 注入①：放了程式碼而沒有動作句 → 要被報出來', () => {
    const md = ['## 一、測試', '', '這是一段解釋。', '', FENCE + 'cpp', 'int x = 1;', FENCE].join('\n')
    expect(sectionsWithoutAction(md).length, '🔴 沒被報 → 偵測器壞了').toBe(1)
  })

  it('★ 注入②：有動作句 → 不得被報', () => {
    const md = ['## 一、測試', '', '照著打上這一行：', '', FENCE + 'cpp', 'int x = 1;', FENCE].join('\n')
    expect(sectionsWithoutAction(md), '🔴 有祈使句還被報 → 會逼人寫廢話').toEqual([])
  })

  it('★ 注入③：明說「不用打」也算數——那是另一種清楚的指示', () => {
    const md = ['## 一、測試', '', '⚠️ 這幾行不用打，看一眼就好。', '', FENCE + 'cpp', 'int x = 1;', FENCE].join('\n')
    expect(sectionsWithoutAction(md), '🔴 純參考的那幾節會被逼著加一句假的動作').toEqual([])
  })

  it('★ 沒有程式碼的小節不在範圍', () => {
    expect(sectionsWithoutAction('## 一、測試\n\n純文字，沒有程式碼。')).toEqual([])
  })

  it('★ 基線裡真的有這一項（少一項＝棘輪沒跑而測試是綠的）', () => {
    const base = loadBaseline<Record<string, number>>('lesson-tells-what-to-do')
    expect(typeof base['說不出要做什麼的小節']).toBe('number')
  })
})
