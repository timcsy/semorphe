/**
 * **探針：課文的用字，與學生在畫面上看到的字，對得上嗎？**（2026-09-07）
 *
 * 使用者：「我發現你似乎沒有先說明註解是什麼就使用註解」＋「還有課文本身的用字」。
 *
 * 🔴 而查證翻出第三件事：`cpp:comment` 的積木上寫的是「**備註**」。
 * 課文若寫「註解」，學生在積木盤上**找不到那顆積木**。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())

/** 每顆元件的中文標籤（`labels/zh-TW.json` 的每一個值）。 */
function labelsOf(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const base = path.join(ROOT, 'src/components')
  for (const lang of fs.readdirSync(base, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue
    for (const d of fs.readdirSync(path.join(base, lang.name), { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const cj = path.join(base, lang.name, d.name, 'component.json')
      const lj = path.join(base, lang.name, d.name, 'labels/zh-TW.json')
      if (!fs.existsSync(cj) || !fs.existsSync(lj)) continue
      const id = (JSON.parse(fs.readFileSync(cj, 'utf8')) as { componentId?: string }).componentId
      if (!id) continue
      // 🔴 **只看積木上的字（`*_MSG*`），不看 tooltip。**
      //    tooltip 是「把滑鼠停在上面才看得到」的說明——它不是學生
      //    在積木盤上**認得那顆積木**的那幾個字。
      //    ⚠️ 第一版把 tooltip 也算進去，於是 66 課全部報「對不上」——
      //    而那不是缺陷，是判準太寬。
      const all = JSON.parse(fs.readFileSync(lj, 'utf8')) as Record<string, string>
      const vals = Object.entries(all)
        .filter(([k]) => /_MSG\d*$/.test(k))
        .map(([, v]) => v)
      out.set(id, vals.filter((v) => typeof v === 'string'))
    }
  }
  return out
}

/** 標籤裡的「詞」——去掉 `%1` 佔位、標點、空白。 */
function wordsOf(label: string): string[] {
  return label
    .replace(/%\d+/g, ' ')
    .split(/[\s，。：；、（）()「」【】…・,.:;!?"'`]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && /[一-鿿]/.test(w))
}

describe('探針：課文的用字對得上積木嗎', () => {
  it('量：這一課教的元件，它在畫面上的名字有沒有出現在課文裡', () => {
    const LABELS = labelsOf()
    console.log(`【掃到】${LABELS.size} 顆元件的中文標籤`)
    const rows: string[] = []
    const base = path.join(ROOT, 'lessons')
    for (const t of fs.readdirSync(base, { withFileTypes: true })) {
      if (!t.isDirectory()) continue
      for (const d of fs.readdirSync(path.join(base, t.name), { withFileTypes: true })) {
        if (!d.isDirectory()) continue
        const j = path.join(base, t.name, d.name, 'lesson.json')
        const m = path.join(base, t.name, d.name, 'lesson.md')
        if (!fs.existsSync(j) || !fs.existsSync(m)) continue
        const comps = (JSON.parse(fs.readFileSync(j, 'utf8')) as { components?: string[] }).components ?? []
        const md = fs.readFileSync(m, 'utf8')
        const miss: string[] = []
        for (const c of comps) {
          const labels = LABELS.get(c) ?? []
          if (labels.length === 0) continue
          // 🟢 只要**任何一個**標籤裡的任何一個詞出現在課文裡，就算對得上
          const hit = labels.some((l) => wordsOf(l).some((w) => md.includes(w)))
          if (!hit) miss.push(`${c}（畫面上：${wordsOf(labels[0] ?? '').join('／') || labels[0]}）`)
        }
        if (miss.length > 0) rows.push(`${t.name}/${d.name}\n    ${miss.join('\n    ')}`)
      }
    }
    console.log(rows.join('\n'))
    console.log(`\n【合計】${rows.length} 課有對不上的`)
    expect(true).toBe(true)
  })
})
