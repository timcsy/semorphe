/**
 * **課文「跟著做」那幾個步驟裡的程式碼片段**——唯一的抽取點。
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 授課老師轉述兩個學生：
 *
 * > 兩個學生要圖，我想應該是要連**跟著做的過程中拉積木的圖**也要給，
 * > 不是只有完成品。
 *
 * 而課文頁今天**只有完成品**：一課一張對照圖，坐在〈完成的樣子〉底下。
 *
 * ## 🔴 為什麼抽取點只准有一個
 *
 * 這個 repo 付過這筆學費至少三次（`lessonDocHref` 的檔頭 · `record-blockmaps`
 * 與 `e2e/lessons.spec.ts` 共用抽取點 · 第 213 刀那條 `lesson.md` 連結）：
 *
 * > **兩邊分開住的話，它們遲早會不一樣——而症狀不是報錯，是安靜的不一致。**
 *
 * 所以**產生器（`record-step-blockmaps`）· 課文頁（`render.ts`）·
 * 護欄**三邊都 import 這一支。
 *
 * ## 判準：哪一段算「一個步驟」
 *
 * ```
 * 小節標題是 `一、` `二、` …   ⟹ 它是「跟著做」的步驟
 * 那個小節裡的每一個程式碼圍籬  ⟹ 一段片段
 * ```
 *
 * ⚠️ **刻意不含**〈完成的樣子〉（那是既有那張圖的地盤）、〈開始之前〉、
 * 〈換你了〉、〈做一個〉（那些是題目，不是跟著做的步驟）。
 */
import fs from 'node:fs'
import path from 'node:path'

/** 步驟小節的標題長這樣：`## 三、把印出拉出來`。 */
const STEP_HEADING = /^#{2,3}\s+[一二三四五六七八九十]+、/

/**
 * 🔴 **只有這幾種語言標記會被畫成積木。**
 *
 * ⚠️ 課文的步驟裡有 127 段是**輸出文字**（沒有語言標記或標 `text`）
 * ——把它們餵進 lift 會得到一團垃圾。
 */
export const RENDERABLE_LANGS = new Set(['cpp', 'c', 'arduino', 'ino', 'python', 'py'])

/**
 * 一段片段的**身分**——而它是**宣告的**，不是從標題推的。
 *
 * ```
 * ```cpp          （預設）跟著做的一步 —— 它會累積到〈完成的樣子〉
 * ```cpp demo     試一下 —— 打了看結果,不留在程式裡
 * ```cpp counter  反例 —— 課文叫學生【不要】這樣寫
 * ```
 *
 * 🔴 **為什麼要宣告**（2026-09-29，使用者帶學生上課時發現）：
 * 判斷「這一節是不是跟著做的步驟」今天靠 `STEP_HEADING`——**標題有沒有編號**。
 * 於是第 6 課的 §三（五種運算）與 §四（開根號）被當成步驟，
 * 而學生照著頁面打完，手上是 `sqrt`——而那一課的裁判要的是「分數是 100」。
 *
 * > **編號回答不了「這一節是跟著做還是講解」。**
 *
 * ⚠️ 而「改用『那一節有沒有說照著打』」是**量過之後否決的**：
 * 269 個編號小節裡只有 35 個說了，換過去會刪掉 **86%** 的圖。
 *
 * > **一條只認得一種變體的規則，它漏掉的是那些沒有用那個字的。**
 */
export type StepKind = 'step' | 'demo' | 'counter'

export interface StepFragment {
  /** `cpp-beginner/08-組合技` */
  lesson: string
  /** 同一課裡的序號，從 0 起算——**它就是檔名的一部分**。 */
  index: number
  /** 小節標題，例如 `三、把印出拉出來`（給報表看的，不進判準）。 */
  section: string
  lang: string
  /** 宣告的身分。圍籬上沒寫就是 `step`。 */
  kind: StepKind
  code: string
}

/** 一課的 `lesson.md` 裡，步驟小節的程式碼片段。 */
export function stepFragmentsOf(md: string, lesson: string): StepFragment[] {
  const out: StepFragment[] = []
  let section: string | null = null
  let open = false
  let lang = ''
  let kind: StepKind = 'step'
  let buf: string[] = []
  for (const line of md.split('\n')) {
    if (!open && /^#{2,3}\s/.test(line)) {
      section = STEP_HEADING.test(line) ? line.replace(/^#+\s+/, '').trim() : null
    }
    if (line.startsWith('```')) {
      if (!open) {
        // 🔴 **資訊字串要【拆】**：第一個詞是語言，其餘是旗標。
        //    ⚠️ 這裡原本是 `lang = line.slice(3).trim()` ＋ `RENDERABLE_LANGS.has(lang)`
        //    的完全比對——寫 ```cpp demo 會讓 lang 變成 `cpp demo`，於是那一段
        //    **靜默消失**，而 `index: out.length` 會讓它後面每一張圖的檔名位移。
        //
        // > **一個用完全比對讀「語言」的解析器，容不下任何第二個詞
        // > ——而它失敗的方式是安靜地少一個東西。**
        const info = line.slice(3).trim().split(/\s+/)
        open = true
        lang = info[0] ?? ''
        kind = info.includes('counter') ? 'counter' : info.includes('demo') ? 'demo' : 'step'
        buf = []
      }
      else {
        open = false
        if (section !== null && buf.length > 0 && RENDERABLE_LANGS.has(lang)) {
          out.push({ lesson, index: out.length, section, lang, kind, code: buf.join('\n') })
        }
      }
      continue
    }
    if (open) buf.push(line)
  }
  return out
}

/** 掃整個 `lessons/`。`root` 是 repo 根。 */
export function allStepFragments(root: string): StepFragment[] {
  const base = path.join(root, 'lessons')
  const out: StepFragment[] = []
  if (!fs.existsSync(base)) return out
  for (const track of fs.readdirSync(base, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(base, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const md = path.join(base, track.name, dir.name, 'lesson.md')
      if (!fs.existsSync(md)) continue
      out.push(...stepFragmentsOf(fs.readFileSync(md, 'utf8'), `${track.name}/${dir.name}`))
    }
  }
  return out
}

/** 一段片段的檔名（`assets/blockmaps/steps/` 底下）。 */
export function stepMapFile(f: Pick<StepFragment, 'lesson' | 'index'>): string {
  return `${f.lesson.replace('/', '__')}__step${f.index}.json`
}
