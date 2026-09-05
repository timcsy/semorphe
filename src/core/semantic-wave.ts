/**
 * **語意波**——一課的版面序列要**下沉再上浮**。
 *
 * ## 🔴 它從哪來（外部證據）
 *
 * Maton 的 LCT「語意波」，**已被英國 NCCE 列為十條教學原則之一**：
 *
 * > 有效的課會**下沉（unpack）再上浮（repack）**：把抽象概念拆到具體，再收回抽象。
 * > **平的語意曲線（一直抽象，或一直具體）教學效果差。**
 *
 * 證據與出處：`concepts/認知鷹架.md`〈三條外部證據〉。
 *
 * ## 🟢 而 Semorphe 的三種投影天生就是那條軸
 *
 * ```
 * 程式碼      抽象、語意密度高      ← 一句話裝很多意思
 * 積木        中間                 結構看得見
 * 流程／執行   具體                 它在跑什麼看得見
 * ```
 *
 * 所以「這一課建議什麼版面」不是排版偏好，是**教學設計**——
 * 而它有一個**可檢查**的判準：**這一課有沒有下沉再上浮？**
 *
 * ## ⚠️ 而它只是【建議】，永遠不是閘門
 *
 * 學習者控制的整合分析：**「sequence control is the only type that
 * generally does not harm」**——系統給預設是對的，鎖住不是。
 *
 * > **版面只能是【建議】，不能是【閘門】——而那不是我們客氣，是研究說的。**
 *
 * 這個模組因此**只算判準**，一行 UI 都不碰。
 */

/** 一課的某一步建議看哪一邊。⚠️ 詞彙是封閉的——多一個值要先想清楚它在軸上的位置。 */
export type LessonView = 'code' | 'blocks' | 'flow' | 'compare' | 'three'

export const LESSON_VIEWS: readonly LessonView[] = ['code', 'blocks', 'flow', 'compare', 'three']

/**
 * 這個看法在**語意軸**上有多抽象（大 ＝ 抽象）。
 *
 * ⚠️ `compare` 與 `three` 同分是刻意的：它們**同時**給抽象與具體，
 * 那是波的「中間」——而不是另一個高度。
 */
export function abstraction(view: LessonView): number {
  switch (view) {
    case 'code': return 3
    case 'compare': return 2
    case 'three': return 2
    case 'blocks': return 1
    case 'flow': return 0
  }
}

/** 一課的語意曲線長什麼樣。 */
export interface WaveShape {
  /** 有沒有下沉過（往具體走一步以上） */
  readonly descends: boolean
  /** 下沉之後有沒有再上浮 */
  readonly ascends: boolean
  /** 🟢 兩個都有 ＝ 一條波 */
  readonly isWave: boolean
  /** 高度序列——⚠️ 護欄紅的時候要印得出來，不然沒有人知道它為什麼不是波 */
  readonly levels: readonly number[]
}

/**
 * 判一串看法是不是一條波。
 *
 * 🔴 **順序有意義**：先上浮再下沉**不算**——那是「先講抽象的再示範」，
 * 而語意波要的是**先拆開、再收回**。
 *
 * ⚠️ 少於兩步一律不是波（一步的課沒有曲線可言，而那**不是錯**
 * ——它只是還沒有這個宣告）。
 */
export function waveOf(views: readonly LessonView[]): WaveShape {
  const levels = views.map(abstraction)
  let descends = false
  let ascends = false
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] < levels[i - 1]) descends = true
    // ⚠️ **上浮只在下沉【之後】才算**——先上再下不是波
    else if (levels[i] > levels[i - 1] && descends) ascends = true
  }
  return { descends, ascends, isWave: descends && ascends, levels }
}
