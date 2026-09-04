/**
 * **哪幾題過了**——而它只留在這一台電腦上。
 *
 * ## 🔴 為什麼它是獨立的一格，不是塞進 `SavedState`
 *
 * ```
 * SavedState   「我的作品」——匯出得出去、匯入得回來、換一台電腦要跟著走
 * 這裡         「我學到哪」——換一台電腦【不該】跟著走，而且清得掉
 * ```
 *
 * 匯出一份作品給同學，不該把「你第 3 題還沒過」一起送出去。
 *
 * ## ⚠️ 它是三個消費者的第一個，而形狀要先窄
 *
 * `draft/2026-09-04-課程重新設計與回饋的粒度` 說有三件事要同一層地基：
 *
 * ```
 * 執行事件   執行覆蓋 · 迴圈次數      ← 已經做了，而它不需要存
 * 編輯來源   拆輪子的指標 · 就地提示   ← 還沒做
 * 題目通過   進度 · 下一題            ← 這裡
 * ```
 *
 * 🔴 **先只做第三個**。把三件事一次抽象成「學習訊號」會長出一個
 * 「什麼都裝得下」的介面，而那是假的父概念（沒有剪枝力）。
 *
 * ## 🔴 而它必須清得掉
 *
 * 一台電腦換一班學生用，是這個工具**最可能的部署方式**（電腦教室）。
 * 一個清不掉的進度會讓第二班看到第一班的勾。
 */

const KEY = 'semorphe-progress'

/** `<課程 id>` → 過了的題目 id。 */
type Passed = Record<string, string[]>

/**
 * ⚠️ **讀壞掉的資料回空，不要丟錯**——這裡與 `SavedState` 不同：
 * 存檔壞掉是「你的作品可能沒了」，值得吵；進度壞掉只是少了幾個勾。
 */
function read(): Passed {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return {}
    const o: unknown = JSON.parse(raw)
    if (o === null || typeof o !== 'object') return {}
    const out: Passed = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
    }
    return out
  } catch {
    return {}
  }
}

function write(p: Passed): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // 無痕視窗、配額滿了——⚠️ 進度存不下來不該讓執行整個失敗
  }
}

export function markTaskPassed(lessonId: string, taskId: string): void {
  const p = read()
  const mine = p[lessonId] ?? []
  if (mine.includes(taskId)) return
  p[lessonId] = [...mine, taskId]
  write(p)
}

export function isTaskPassed(lessonId: string, taskId: string): boolean {
  return (read()[lessonId] ?? []).includes(taskId)
}

export function passedTasks(lessonId: string): readonly string[] {
  return read()[lessonId] ?? []
}

/** 這一課過了幾題／共幾題——選單上那一行「2/3」。 */
export function passedCount(lessonId: string, taskIds: readonly string[]): number {
  const done = new Set(passedTasks(lessonId))
  return taskIds.filter((id) => done.has(id)).length
}

/** 🔴 換一班學生。⚠️ 入口要明顯——藏起來的清除鍵等於沒有。 */
export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 同上
  }
}
