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
import { printReport, assertRatchet, assertCorpus } from '../helpers/guardrail'
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
  /**
   * `starters/` 裡有**壞掉的起點**的題目 id（`kind: 'debug'`，2026-09-07）。
   *
   * ⚠️ 它與 `solutions` **分開放**：一個同時裝著「該對的」與「該壞的」的
   * 資料夾，會讓任何一條檢查都得先問「這一份是哪一種」——而那個答案不在檔案裡。
   */
  starters?: string[]
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
        starters: fs.existsSync(path.join(p, 'starters'))
          ? fs.readdirSync(path.join(p, 'starters')).map((x) => x.replace(/\.[^.]+$/, ''))
          : [],
      })
    }
  }
  return out
}

/** 判定——與掃描分開，才注得進合成的課 */
/**
 * **課文裡沒有入口的題目**——`lesson.md` 沒有用〈題目名字〉提到它，
 * 於是課文頁上不會長出那顆「到編輯器做這一題」的按鈕。
 *
 * ⚠️ 比對是**逐字**的，與 `tools/build-lessons/render.ts` 的 `withTaskButtons` 相同
 * ——兩邊的判準只要有一點不一樣，就會出現「護欄綠而按鈕長不出來」。
 */
export function orphanTasks(lessons: readonly Lesson[]): string[] {
  const out: string[] = []
  for (const l of lessons) {
    const named = new Set([...l.md.matchAll(/〈([^〉]{1,60})〉/g)].map((m) => m[1]))
    for (const t of l.json.tasks ?? []) {
      if (t.title !== undefined && !named.has(t.title)) out.push(`${l.dir} · ${t.title}`)
    }
  }
  return out
}

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
    // ⚠️ 「跟著做」不算——它的解答就是課文裡的「完成的樣子」。
    //
    // 🔴 **這裡本來寫 `.slice(1)`，而那是【位置】不是【身分】**（2026-09-12）。
    //    66 課的第一題 id 都是 `follow`，所以兩種寫法今天等價
    //    ——而在〈陣列〉那一課前面插進一題「先試試看」的那一刻就不等價了：
    //    `follow` 變成第二題，於是它被要求附一份 `solutions/follow.cpp`，
    //    而那份檔案**只會是〈完成的樣子〉的複本**。
    //
    // > **一條靠「它排第幾」認東西的檢查，
    // > 會在有人往前面插一個東西的那天，要求一份不該存在的檔案。**
    for (const t of (l.json.tasks ?? []).filter((x) => x.id !== 'follow')) {
      if (!t.check) continue      // 沒有裁判的題目本來就不需要解答
      // ⚠️ **除錯題的「解答」是他自己修出來的**——它要的是一份【壞掉的起點】，
      //    而正解就是把那個 bug 修掉。硬要它附一份 `solutions/` 會讓
      //    「那些檔案都跑得過」那條 e2e 去驗一份**沒有人會看的**檔案。
      if (t.kind === 'debug') continue
      if (t.id !== undefined && !l.solutions.includes(t.id)) {
        f.push({ lesson: l.dir, kind: '練習題沒有參考解答', detail: t.id })
      }
    }
    // 🔴 **課文裡的〈題目名字〉要對得上一道真的題目**（2026-09-12）。
    //
    // 那個記號是課文頁上「在編輯器練習」那顆按鈕的來源
    // （`tools/build-lessons/render.ts` 的 `withTaskButtons`）。
    // ⚠️ 對不上的話，產生器**什麼都不做**——那一句留成純文字，
    //    而畫面上與「這一課還沒加按鈕」一模一樣。
    //
    // > **一個打錯的標記如果只是少長出一顆按鈕，
    // > 作者會看著那句話想不通，而沒有任何東西告訴他哪裡錯。**
    //
    // ⚠️ `〈…〉` 這個記號**整個**屬於題目：量過（2026-09-12）66 課裡
    //    它只出現在這一刀自己寫的地方，所以不會誤傷既有的寫法。
    {
      const titles = new Set((l.json.tasks ?? []).map((t) => t.title))
      for (const m of l.md.matchAll(/〈([^〉]{1,60})〉/g)) {
        if (!titles.has(m[1])) f.push({ lesson: l.dir, kind: '題目名字對不上', detail: m[1] })
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
    /**
     * 🔴 **除錯題一定要有壞掉的起點**（2026-09-07）。
     *
     * ⚠️ 少了它的症狀不是報錯：那一題會安靜地變成**一片空白畫布**，
     * 而畫面上與「這一課還沒寫好」一模一樣——與 `arrange` 同一個形狀。
     */
    for (const t of (l.json.tasks ?? [])) {
      if (t.kind !== 'debug') continue
      // ⚠️ `?? []` 不是防禦性寫法，是**合成輸入**的需要：注入測試餵的是
      //    手寫的物件，而要它們每一個都寫 `starters: []` 只會讓注入變難寫。
      if (t.id !== undefined && !(l.starters ?? []).includes(t.id)) {
        f.push({ lesson: l.dir, kind: '除錯題沒有壞掉的起點', detail: t.id })
      }
    }
    /**
     * 🔴 **一個題目不得同時有起點與解答。**
     *
     * > **一個資料夾如果同時裝著「該對的」與「該壞的」，
     * > 那麼任何一條對它的檢查都必須先問「這一份是哪一種」
     * > ——而那個問題的答案不在檔案裡。**
     *
     * ⚠️ 而 `solutions/` 那一批**有一條 e2e 真的去跑它們**——
     * 一份壞掉的程式混進去，那條 e2e 會紅在一個**它應該壞**的東西上。
     */
    for (const id of l.starters ?? []) {
      if (l.solutions.includes(id)) {
        f.push({ lesson: l.dir, kind: '同一題既有起點又有解答', detail: id })
      }
    }
    /** ⚠️ 起點也不得出現在課文裡——那等於把 bug 直接指出來。 */
    for (const id of l.starters ?? []) {
      if (l.md.includes(`starters/${id}`)) {
        f.push({ lesson: l.dir, kind: '課文洩漏除錯題的起點', detail: id })
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

describe('★ 第一百二十三條護欄：每一道題目在課文裡都要有入口', () => {
  /**
   * ## 🔴 課文頁上的題目，讀的人看不見
   *
   * 使用者 2026-09-12：「要不要每個題目都有一個在編輯器練習的按鈕跟著？
   * 這樣大家比較能 follow 到」。
   *
   * ⚠️ 而查證之後它比那句話說的更需要：`tools/build-lessons/` 裡
   * **`tasks` 一次都沒出現過**——整頁只有底下一顆「在編輯器打開這一課」，
   * 而一課有兩到三題。
   *
   * > **一份教材如果它的練習題只存在於另一個畫面裡，
   * > 那些練習題對讀教材的人來說不存在。**
   *
   * ## ⚠️ 它是棘輪，不是硬性零
   *
   * 今天 136 題裡絕大多數沒有被課文提過，而那是**要一課一課寫進去的**。
   * 一條今天就紅 130 幾筆的護欄，明天就會被當成背景雜訊。
   *
   * 🟢 而「對不上的名字」那一條**是硬性零**（在 `judgeLessons` 裡）
   * ——那是錯字，不是待辦。
   */
  const lessons = scanLessons(path.join(ROOT, 'lessons'))

  it('入口條件：真的讀到課了', () => {
    expect(lessons.length, '🔴 一課都沒讀到 → 下面那個數字不算數').toBeGreaterThan(50)
  })

  it('語料：題目總數（它變多，這條護欄的分母就跟著大）', () => {
    const total = lessons.reduce((n, l) => n + (l.json.tasks ?? []).length, 0)
    assertCorpus([['題目總數', total]], 'lesson-task-entry')
  })

  it('棘輪：課文裡沒有入口的題目，只准變少（今天是 0）', () => {
    const orphans = orphanTasks(lessons)
    printReport('課文裡沒有入口的題目', [['沒有入口', orphans.length]])
    assertRatchet([['沒有入口的題目', orphans.length]], 'lesson-task-entry', { detail: orphans })
  })

  it('★ 注入：一課的課文沒提到它的題目 → 會被算進去', () => {
    const bad = [{ dir: '合成/一堂課', json: { tasks: [{ id: 'ex1', title: '練習：某某' }] }, md: '沒有提到它。', solutions: [], starters: [] }]
    expect(orphanTasks(bad as never)).toEqual(['合成/一堂課 · 練習：某某'])
  })

  it('★ 不亂報：提到了就不算——而【部分吻合】不算提到', () => {
    const ok = [{ dir: '合成/甲', json: { tasks: [{ id: 'ex1', title: '練習：某某' }] }, md: '做這一題：〈練習：某某〉', solutions: [], starters: [] }]
    expect(orphanTasks(ok as never)).toEqual([])
    // 🔴 少一個字就不是同一題——`withTaskButtons` 也是**逐字**比對，
    //    兩邊的判準必須一樣，不然護欄綠而按鈕長不出來。
    const typo = [{ dir: '合成/乙', json: { tasks: [{ id: 'ex1', title: '練習：某某' }] }, md: '做這一題：〈練習：某〉', solutions: [], starters: [] }]
    expect(orphanTasks(typo as never)).toEqual(['合成/乙 · 練習：某某'])
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

  // ─── 除錯題（2026-09-07）——🔴 新規則要有自己的健康檢查 ───

  it('★ 注入：除錯題沒有壞掉的起點 → 會報', () => {
    const bad = {
      ...good,
      json: { ...good.json, tasks: [
        { id: 'follow', title: '跟著做' },
        { id: 'fix', title: '修好它', kind: 'debug', check: { stdout: 'a\n' } },
      ] },
    }
    expect(judgeLessons([bad], C, T).map((x) => x.kind))
      .toContain('除錯題沒有壞掉的起點')
  })

  it('★ 注入：有起點的除錯題 → 不報，而且**不得**被要求附參考解答', () => {
    const ok = {
      ...good,
      starters: ['fix'],
      json: { ...good.json, tasks: [
        { id: 'follow', title: '跟著做' },
        { id: 'fix', title: '修好它', kind: 'debug', check: { stdout: 'a\n' } },
      ] },
    }
    const kinds = judgeLessons([ok], C, T).map((x) => x.kind)
    expect(kinds).not.toContain('除錯題沒有壞掉的起點')
    expect(kinds, '🔴 除錯題的「解答」是他自己修出來的').not.toContain('練習題沒有參考解答')
  })

  it('★ 注入：同一題既有起點又有解答 → 會報', () => {
    const bad = { ...good, starters: ['ex1'], solutions: ['ex1'] }
    expect(judgeLessons([bad], C, T).map((x) => x.kind))
      .toContain('同一題既有起點又有解答')
  })

  it('★ 注入：課文洩漏了除錯題的起點 → 會報', () => {
    const bad = { ...good, starters: ['fix'], md: `${good.md}\n看 starters/fix 就知道了` }
    expect(judgeLessons([bad], C, T).map((x) => x.kind))
      .toContain('課文洩漏除錯題的起點')
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

  it('★ 注入：課文寫了一個對不上的〈題目名字〉 → 會報（那是錯字，不是待辦）', () => {
    const bad = {
      ...good,
      json: { ...good.json, tasks: [{ id: 'follow', title: '跟著做' }] },
      md: good.md + '\n題目切到〈跟著坐〉。\n',
    }
    const out = judgeLessons([bad], C, T)
    expect(out.map((x) => x.kind)).toContain('題目名字對不上')
    expect(out.map((x) => x.detail)).toContain('跟著坐')
  })

  it('★ 不亂報：對得上的〈題目名字〉不報，而〈…〉裡的段落名也不報', () => {
    const ok = {
      ...good,
      json: { ...good.json, tasks: [{ id: 'follow', title: '跟著做' }] },
      md: good.md + '\n題目切到〈跟著做〉。\n',
    }
    expect(judgeLessons([ok], C, T).map((x) => x.kind)).not.toContain('題目名字對不上')
  })

  it('★ 不亂報：「跟著做」前面插一題，`follow` 仍然不必附參考解答', () => {
    // 🔴 這一條釘住 2026-09-12 的那個改動：判準是**身分**（`id === 'follow'`），
    //    不是**位置**。舊的 `.slice(1)` 在這個輸入上會報，而它報錯了
    //    ——`follow` 的解答一直都是課文裡的〈完成的樣子〉，
    //    它排第幾與那件事無關。
    const withPre = { ...good, json: { ...good.json, tasks: [
      { id: 'try', title: '先試試看' },
      { id: 'follow', title: '跟著做', check: { stdout: 'a\n' } },
    ] } }
    expect(judgeLessons([withPre], C, T).map((x) => x.kind)).not.toContain('練習題沒有參考解答')
  })

  it('★ 注入：有裁判的練習題而沒有參考解答 → 會報（而它排第幾都一樣）', () => {
    const bad = { ...good, json: { ...good.json, tasks: [
      { id: 'follow', title: '跟著做' },
      { id: 'ex1', title: '練習 1', check: { stdout: 'a\n' } },
    ] } }
    expect(judgeLessons([bad], C, T).map((x) => x.kind)).toContain('練習題沒有參考解答')
    // ⚠️ 同一題往前挪一格，照樣要報——不然「改成身分」會變成「放過第一格以外的漏洞」。
    const moved = { ...good, json: { ...good.json, tasks: [
      { id: 'ex1', title: '練習 1', check: { stdout: 'a\n' } },
      { id: 'follow', title: '跟著做' },
    ] } }
    expect(judgeLessons([moved], C, T).map((x) => x.kind)).toContain('練習題沒有參考解答')
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
