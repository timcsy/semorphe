/**
 * **這一趟跑了幾步**——而「兩種寫法差多少」是它唯一的消費者。
 *
 * ## 🔴 它補的是一個【教材已經在教而沒有回饋】的落差
 *
 * `cpp-advanced` 第 1 課逐字：
 *
 * > 題目會告訴你「n ≤ 100000」這種話——而那句話
 * > **直接決定你可以用什麼做法**。
 *
 * 而在此之前，學生寫出 O(n²) 與 O(n log n) 的兩份解答，
 * **畫面上長得一模一樣**：兩個都印出對的答案，兩個都得到一個綠勾。
 *
 * > **一門課如果教「哪一種比較快」，而它的裁判只問「答案對不對」，
 * > 那學生學到的是「兩種都可以」。**
 *
 * ## ⚠️ 「一步」是什麼——而它刻意是【我們真的數得到的那個】
 *
 * ```
 * 一步 ＝ 直譯器走過一顆語義節點一次
 * ```
 *
 * 🔴 那**不等於**教科書的「基本操作次數」：`a[i] + a[j]` 在這裡是
 * 好幾步（陣列取值兩顆、加法一顆），而課本會算成一次。
 *
 * ⚠️ 而選它的理由是**誠實**：它是執行器真的知道的東西，
 * 不是一個我們替它換算出來的近似。課文要說清楚它是什麼。
 *
 * > **一個量給學習者看的數字，寧可它「不是課本的定義」而說得出自己是什麼，
 * > 也不要它「像課本」而沒有人講得出它怎麼算的。**
 *
 * ## 🟢 而比較才是重點，不是絕對值
 *
 * 「3,412 步」對學生沒有意義。**「這一版是上一版的 8 倍」有**。
 * 所以這一支的產出是一個**比**，而不只是一個數。
 */

/**
 * 走過幾步——`getVisitCounts()` 的總和。
 *
 * ⚠️ **不排除任何節點**（骨架也算）：排掉一批就要有人維護那份清單，
 * 而兩種寫法的骨架是同一份，**比出來的倍數不受它影響**。
 */
export function stepsOf(counts: ReadonlyMap<string, number>): number {
  let n = 0
  for (const c of counts.values()) n += c
  return n
}

/** 一次跑完的紀錄。 */
export interface StepRecord {
  /** 哪一題（`<課程 id>#<題目 id>`）——⚠️ 不同題之間不比 */
  readonly key: string
  readonly steps: number
}

/**
 * **與上一次比**——同一題的兩次執行差多少。
 *
 * @returns `undefined` 表示沒得比（第一次跑，或上一次是別題）
 */
export function compareSteps(prev: StepRecord | null, now: StepRecord): number | undefined {
  if (prev === null || prev.key !== now.key) return undefined
  if (prev.steps === 0 || now.steps === 0) return undefined
  return now.steps / prev.steps
}

/**
 * 那個比要怎麼說。
 *
 * ## 🔴 它只在【差得夠多】的時候說話
 *
 * ```
 * < 1.25 倍   不說   ⚠️ 那是同一種做法的雜訊（多一個 if、少一個變數）
 * ≥ 1.25 倍   說     真的換了一種做法
 * ```
 *
 * ⚠️ 而它**說的是任務，不是這個人**：「這一版走了 8 倍的步數」，
 * 不是「你變慢了」。
 * （`draft/課程重新設計` §十一：「它說的是任務、過程，還是**這個人**？
 * 說到人就砍掉。」）
 */
export function describeSteps(now: number, ratio: number | undefined): string | undefined {
  const n = now.toLocaleString('en-US')
  if (ratio === undefined) return `這一趟走了 ${n} 步`
  if (ratio >= 1.25) return `這一趟走了 ${n} 步——是上一次的 ${ratio.toFixed(1)} 倍`
  if (ratio <= 0.8) return `這一趟走了 ${n} 步——只有上一次的 ${(ratio * 100).toFixed(0)}%`
  return `這一趟走了 ${n} 步`
}

/**
 * **與這一關的目標比**——⚠️ 它是一句話，不是一道門。
 *
 * ```
 * 在目標之內   🟢 說一句，而它是這一關少數幾個「你做到了一件不只是對的事」
 * 超過了       說一句，而題目【照樣算通過】
 * ```
 *
 * 🔴 而兩句都說**任務**：「這一趟用了 N 步」，不是「你太慢了」。
 *
 * ⚠️ **超過多少才說**：全部都說。與 `describeSteps` 的「差 25% 內不提」不同
 * ——那一支比的是「上一次」（一個會動的基準），而這一支比的是
 * **一個課程作者訂下來的數字**，它每一次都值得說。
 */
export function describeBudget(steps: number, budget: number): string {
  const n = steps.toLocaleString('en-US')
  const b = budget.toLocaleString('en-US')
  if (steps <= budget) return `🟢 這一趟用了 ${n} 步——在這一關的目標（${b} 步）之內`
  return `這一趟用了 ${n} 步，而這一關的目標是 ${b} 步以內。還有更省的做法`
}
