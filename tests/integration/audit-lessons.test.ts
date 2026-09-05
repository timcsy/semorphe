/**
 * **第八十三條護欄**：一堂課宣告要用的每一顆積木，都要真的存在；
 * 而課文的骨架不得殘缺。
 *
 * ## 它從哪來
 *
 * 2026-08-27 生前四堂 C++ 入門課時，**同一輪之內犯了兩次**：
 *
 * ```
 * ① components 憑印象列 → 漏了 cpp:literal_number（`return 0;` 的那個 0）
 * ② pins.target 寫成 "cpp-beginner" → 那是【主題】的 id，目標叫 "cpp"
 * ```
 *
 * 兩個都是**靜默**的：教案照樣存在、編輯器照樣開得起來，
 * 而學生在課堂上會找不到一顆他需要的積木，或者整份組態根本沒套用。
 *
 * > **一份憑印象列的元件清單，與一份量出來的長得一模一樣
 * > ——直到有人照著它上課。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的課少於 1 堂、或註冊表裡的元件少於 100 顆，
 * > 代表這支根本沒讀到東西，這份報表不算數——不是「教案都合格」。**
 *
 * 兩個錨都是**合成量**：課的數量與註冊表大小。
 * 🔴 **刻意不錨在「懸空引用數」上**——那正是要推向零的
 * （`build-guardrail` 第 2 步的語法簽名一）。
 *
 * ## 硬性零
 *
 * ```
 * 留一筆規範還成立嗎？  ❌ 一顆拿不到的積木就是一堂上不下去的課
 * 修一筆要付多少？      便宜——改一行 JSON
 * 別台機器一樣嗎？      ✅ 純檔案讀取，沒有外部工具
 * ```
 *
 * ## 這支不檢測什麼
 *
 * - 🔴 **不檢測「宣告的元件與課文的程式碼相符」**——那要真的解析一次，
 *   住在 `e2e/lessons.spec.ts`。這支只問「這顆存不存在」。
 * - **不檢測課文寫得好不好**——只檢查骨架的段落在不在。
 * - **不檢測 check.stdout 對不對**——那也是 e2e 的事。
 */
import { describe, it, expect } from 'vitest'
import { printReport } from '../helpers/guardrail'
import { loadToolbox } from '../helpers/toolbox'
import fs from 'node:fs'
import path from 'node:path'
import { findFiles } from '../helpers/find-files'

const ROOT = path.resolve(__dirname, '../..')

/** 課文骨架必須有的段落——少一段，學生就少一個著力點 */
const REQUIRED_HEADINGS = ['## 你會學到三件事', '## 完成的樣子', '## 換你了', '## 如果卡住了']

interface Finding { lesson: string; kind: string; detail: string }

/** 一堂課的宣告 ＋ 課文 */
interface Lesson {
  dir: string
  json: {
    title?: string; estimate?: string; pins?: { target?: string }; components?: string[]
    check?: { stdout?: string; stdin?: string[] }
    tasks?: { id?: string; title?: string; kind?: string; check?: { stdout?: string; stdin?: string[] } }[]
  }
  md: string
  /** `solutions/` 裡有解答的題目 id。⚠️ 只要 id，**不要內容**——見下面那條。 */
  solutions: string[]
}

/** 掃一個 lessons 根目錄——**純函式**，注入餵得進合成目錄 */
export function scanLessons(root: string): Lesson[] {
  const out: Lesson[] = []
  if (!fs.existsSync(root)) return out
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    const trackDir = path.join(root, track.name)
    for (const dir of fs.readdirSync(trackDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const p = path.join(trackDir, dir.name)
      const j = path.join(p, 'lesson.json')
      const m = path.join(p, 'lesson.md')
      if (!fs.existsSync(j)) continue
      out.push({
        dir: `${track.name}/${dir.name}`,
        json: JSON.parse(fs.readFileSync(j, 'utf8')),
        md: fs.existsSync(m) ? fs.readFileSync(m, 'utf8') : '',
        solutions: fs.existsSync(path.join(p, 'solutions'))
          ? fs.readdirSync(path.join(p, 'solutions')).map((x) => x.replace(/\.[^.]+$/, ''))
          : [],
      })
    }
  }
  return out
}

/** 判定——與掃描分開，才注得進合成的課 */
export function judgeLessons(
  lessons: Lesson[],
  knownComponents: ReadonlySet<string>,
  knownTargets: ReadonlySet<string>,
): Finding[] {
  const f: Finding[] = []
  for (const l of lessons) {
    // 🔴 **有裁判的練習題，一定要有一份跑得出那個答案的參考解答**（2026-09-04）。
    //
    //    一份手打的 `check.stdout` 錯一個空格，那一題的裁判就會對每一個
    //    做對的學生說他錯——而**畫面上完全看不出來**。
    //
    // > **一個沒有人跑過的期望輸出，是一個還沒被發現的、會說錯話的裁判。**
    //
    // ⚠️ 這裡只驗**檔案在不在**；「它真的跑得出那個答案」要開瀏覽器
    //    （`e2e/lessons.spec.ts` 的〈參考解答〉那幾支）。兩道各守一半。
    //
    // ⚠️ 第一題不算——它的解答就是課文裡的「完成的樣子」。
    for (const t of (l.json.tasks ?? []).slice(1)) {
      if (!t.check) continue      // 沒有裁判的題目本來就不需要解答
      if (t.id !== undefined && !l.solutions.includes(t.id)) {
        f.push({ lesson: l.dir, kind: '練習題沒有參考解答', detail: t.id })
      }
    }
    // 🔴 **「排回去」那種題一定要有參考解答**——打散的來源就是它。
    //    ⚠️ 少了它的症狀不是報錯：那一題會安靜地變成「自己從空白寫」，
    //    而畫面上與「這一課還沒寫好」一模一樣。
    for (const t of (l.json.tasks ?? [])) {
      if (t.kind !== 'arrange') continue
      if (t.id !== undefined && !l.solutions.includes(t.id)) {
        f.push({ lesson: l.dir, kind: '「排回去」那種題沒有參考解答', detail: t.id })
      }
    }
    // 🔴 **解答不得出現在課文裡**——學生點得到的地方不放答案。
    for (const id of l.solutions) {
      if (l.md.includes(`solutions/${id}`)) {
        f.push({ lesson: l.dir, kind: '課文洩漏參考解答', detail: id })
      }
    }
    for (const c of l.json.components ?? []) {
      if (knownComponents.has(c)) continue
      // 🔴 **兩種不存在要分開報**——訊息不同，修法也不同。
      //    沒有冒號 ＝ 結構節點（`core/non-components.ts`：`param_decl` 之類），
      //    它**存在**，只是不是元件，學生在積木盤上看不到它。
      //    2026-08-27 生第 15 課時真的犯過：量測把 `param_decl` 算進 components。
      f.push({
        lesson: l.dir,
        kind: c.includes(':') ? '懸空元件' : '結構節點不是元件',
        detail: c,
      })
    }
    const t = l.json.pins?.target
    if (t !== undefined && !knownTargets.has(t)) {
      f.push({ lesson: l.dir, kind: '懸空目標', detail: t })
    }
    if ((l.json.components ?? []).length === 0) {
      f.push({ lesson: l.dir, kind: '沒有宣告元件', detail: '(空)' })
    }
    if (l.md === '') { f.push({ lesson: l.dir, kind: '沒有課文', detail: 'lesson.md 不存在' }); continue }
    for (const h of REQUIRED_HEADINGS) {
      if (!l.md.includes(h)) f.push({ lesson: l.dir, kind: '缺段落', detail: h })
    }
    // 「三件事」剛好三件——寫第四件的時候，那多半是下一課
    const three = l.md.split('## 你會學到三件事')[1]?.split('\n##')[0] ?? ''
    const n = (three.match(/^\d+\. /gm) ?? []).length
    if (l.md.includes('## 你會學到三件事') && n !== 3) {
      f.push({ lesson: l.dir, kind: '不是三件事', detail: `數到 ${n} 件` })
    }
    // 「完成的樣子」要有一段真的程式碼——e2e 抽的就是它
    const done = l.md.split('## 完成的樣子')[1]?.split('\n## ')[0] ?? ''
    if (l.md.includes('## 完成的樣子') && !/```[a-z]*\n[\s\S]+?\n```/.test(done)) {
      f.push({ lesson: l.dir, kind: '完成的樣子沒有程式碼', detail: '抽不出 fenced block' })
    }
  }
  return f
}

function knownTargetIds(): Set<string> {
  const ids = new Set<string>()
  // 🔴 **不用 `fs.globSync`**——它在 Node 22 與 24 之間的行為不同，
  //    而症狀是「本機綠、CI 掃到 0」。見 `tests/helpers/find-files.ts`。
  const langs = path.join(ROOT, 'src/languages')
  for (const rel of findFiles(langs, 'targets')) {
    ids.add(JSON.parse(fs.readFileSync(path.join(langs, rel), 'utf8')).id)
  }
  return ids
}

describe('★ 第八十三條：教案宣告的東西都要真的存在', () => {
  const lessons = scanLessons(path.join(ROOT, 'lessons'))
  const { allComponents } = loadToolbox()
  const comps = new Set(allComponents.map((c) => c.componentId))
  const targets = knownTargetIds()
  const findings = judgeLessons(lessons, comps, targets)

  it('入口條件——真的讀到教案與註冊表了', () => {
    // ⚠️ 錨在**合成量**：課的數量與註冊表大小。兩個都不會因為缺陷被修好而變小。
    printReport('教案健檢', [
      `掃到幾堂課       ${lessons.length}`,
      `註冊表元件數     ${comps.size}`,
      `目標數           ${targets.size}`,
      `宣告的元件總數   ${lessons.reduce((a, l) => a + (l.json.components ?? []).length, 0)}`,
      `違規             ${findings.length}`,
      ...findings.map((x) => `  🔴 ${x.lesson} · ${x.kind} · ${x.detail}`),
    ])
    expect(lessons.length, '🔴 一堂課都沒掃到 → 這支沒讀到東西，報表不算數').toBeGreaterThanOrEqual(1)
    expect(comps.size, '🔴 註冊表是空的 → 每一顆元件都會被判成懸空').toBeGreaterThanOrEqual(100)
    expect(targets.size, '🔴 一個目標都沒讀到 → 每個 pin 都會被判成懸空').toBeGreaterThanOrEqual(1)
  })

  it('硬性零——沒有懸空引用，也沒有殘缺的骨架', () => {
    expect(
      findings.map((x) => `${x.lesson} · ${x.kind} · ${x.detail}`),
      '🔴 教案指向不存在的東西，或課文骨架殘缺：',
    ).toEqual([])
  })
})

describe('★ 注入——證明它會報，也證明它不亂報', () => {
  const good: Lesson = {
    dir: '合成/一堂好課',
    json: { title: 'x', pins: { target: 'ㄒ目標' }, components: ['ㄒ:甲'] },
    md: '## 你會學到三件事\n1. a\n2. b\n3. c\n## 完成的樣子\n```cpp\nint main(){}\n```\n## 換你了\n## 如果卡住了\n',
    solutions: [],
  }
  const C = new Set(['ㄒ:甲'])
  const T = new Set(['ㄒ目標'])

  it('★ 注入：正確的輸入 → 不報', () => {
    expect(judgeLessons([good], C, T)).toEqual([])
  })

  it('★ 注入：懸空元件 → 會報', () => {
    const bad = { ...good, json: { ...good.json, components: ['ㄒ:甲', 'ㄒ:不存在'] } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('懸空元件')
  })

  it('★ 注入：結構節點被當成元件 → 會報（2026-08-27 真的犯過：param_decl）', () => {
    const bad = { ...good, json: { ...good.json, components: ['ㄒ:甲', '結構節點'] } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('結構節點不是元件')
  })

  it('★ 注入：懸空目標 → 會報（2026-08-27 真的犯過：寫成主題 id）', () => {
    const bad = { ...good, json: { ...good.json, pins: { target: 'ㄒ主題' } } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('懸空目標')
  })

  it('★ 注入：第四件事 → 會報', () => {
    const bad = { ...good, md: good.md.replace('3. c', '3. c\n4. d') }
    expect(judgeLessons([bad], C, T).map((x) => x.detail)).toContain('數到 4 件')
  })

  it('★ 注入：完成的樣子沒有程式碼 → 會報', () => {
    const bad = { ...good, md: good.md.replace('```cpp\nint main(){}\n```', '之後補') }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('完成的樣子沒有程式碼')
  })

  it('★ 注入：有裁判的練習題而沒有參考解答 → 會報', () => {
    const bad = { ...good, json: { ...good.json, tasks: [
      { id: 'follow', title: '跟著做' },
      { id: 'ex1', title: '練習 1', check: { stdout: 'a\n' } },
    ] } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('練習題沒有參考解答')
  })

  it('★ 注入：沒有裁判的練習題 → 不報（那種題目本來就不需要解答）', () => {
    const ok = { ...good, json: { ...good.json, tasks: [
      { id: 'follow', title: '跟著做' },
      { id: 'ex1', title: '練習：改用 while 寫' },
    ] } }
    expect(judgeLessons([ok], C, T)).toEqual([])
  })

  it('★ 注入：「排回去」那種題沒有參考解答 → 會報（那一題會安靜地變成「自己寫」）', () => {
    const bad = { ...good, json: { ...good.json, tasks: [
      { id: 'follow', title: '跟著做' },
      { id: 'ex1', title: '練習', kind: 'arrange', check: { stdout: 'a\n' } },
    ] } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('「排回去」那種題沒有參考解答')
  })

  it('★ 注入：「排回去」那種題有解答 → 不報', () => {
    const ok = { ...good, solutions: ['ex1'], json: { ...good.json, tasks: [
      { id: 'follow', title: '跟著做' },
      { id: 'ex1', title: '練習', kind: 'arrange', check: { stdout: 'a\n' } },
    ] } }
    expect(judgeLessons([ok], C, T)).toEqual([])
  })

  it('★ 注入：課文提到解答檔 → 會報（學生點得到的地方不放答案）', () => {
    const bad = { ...good, solutions: ['ex1'], md: `${good.md}\n見 solutions/ex1.cpp` }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('課文洩漏參考解答')
  })

  it('★ 注入：缺一個段落 → 會報', () => {
    const bad = { ...good, md: good.md.replace('## 如果卡住了', '') }
    expect(judgeLessons([bad], C, T).map((x) => x.detail)).toContain('## 如果卡住了')
  })
})
