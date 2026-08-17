/**
 * 單步執行 —— **而它的目的是【高亮】，不是跑程式**。
 *
 * ## 使用者定調（2026-08-17，逐字）
 *
 * > 「**執行一般就是使用者自己從 IDE 執行，而我們自己做的用意
 * > 更多是為了結合積木的高亮過程**」
 *
 * ```
 * 使用者要看輸出   → 他自己在 IDE 裡編譯／燒錄，那才準
 * 我們的直譯器     → 為了【看見程式在積木上走過去】
 * ```
 *
 * 🟢 於是**保真度不是重點，可視化才是**：直譯器跑 Arduino 程式看得到的
 * 效果有限（虛擬硬體往後推），**而那不影響它的用途**——
 * 高亮要的是「走到哪一顆」，不是「馬達真的轉了」。
 *
 * ## 🔴 原生編輯器只是【第三個視圖】
 *
 * `core/view-host.ts:94` 逐字：
 *
 * > 唯一真實是「執行到哪個節點」；積木高亮一顆積木、程式碼捲到一行、
 * > 2D 接線圖讓一顆元件發光——**那是三個投影，不是三個命令**。
 *
 * 所以這裡**只發一個 `nodeId`**，積木那一側自己去亮、
 * 程式碼那一側由主行程去亮。⚠️ **不要為程式碼側另外發明一個訊息。**
 */
import { SemanticInterpreter } from '../../interpreter/interpreter'
import type { SemanticNode } from '../../core/types'

export type RunState = 'idle' | 'paused' | 'running'

export interface Runner {
  /** 走一步（停在下一個節點）。 */
  step(): Promise<void>
  /** 停止並清除高亮。 */
  stop(): void
  readonly state: RunState
  readonly steps: number
}

export interface RunnerHooks {
  /** 執行走到某個節點——🔴 **唯一真實**，兩個視圖各自投影它。 */
  atNode(nodeId: string | null): void
  output(text: string): void
  stateChanged(state: RunState): void
}

/**
 * ⚠️ 這個 runner **一次只跑一次**：再按單步會沿用同一個執行序列。
 * 🔴 而它**沒有**「連續執行」——本輪只做單步，因為目的是看見。
 */
export function createRunner(tree: SemanticNode, hooks: RunnerHooks): Runner {
  let state: RunState = 'idle'
  let steps = 0
  /** 直譯器在等我們放行——⚠️ 而**放行的方式是解掉這個 Promise**，不是計時。 */
  let release: (() => void) | null = null
  let started = false

  const setState = (s: RunState): void => { state = s; hooks.stateChanged(s) }

  const interp = new SemanticInterpreter({ maxSteps: 1_000_000 })
  interp.setOutputCallback((text: string) => hooks.output(text))
  interp.setRecordSteps(true)
  interp.setStepRecordCallback(async (step: { nodeId?: string | null }) => {
    steps++
    hooks.atNode(step.nodeId ?? null)
    setState('paused')
    // 🔴 停在這裡等使用者按下一步——**而等待是被 Promise 解掉，不是被時間解掉**。
    await new Promise<void>((resolve) => { release = resolve })
  })

  return {
    get state() { return state },
    get steps() { return steps },
    async step(): Promise<void> {
      if (!started) {
        started = true
        setState('running')
        // ⚠️ 不 await：直譯器會在第一個節點停下來等我們。
        void interp
          .execute(tree as never)
          .then(() => { hooks.atNode(null); setState('idle') })
          .catch((e: unknown) => {
            hooks.output(`\n🔴 ${e instanceof Error ? e.message : String(e)}\n`)
            hooks.atNode(null)
            setState('idle')
          })
        return
      }
      const r = release
      release = null
      r?.()
    },
    stop(): void {
      release?.()
      release = null
      hooks.atNode(null)
      setState('idle')
    },
  }
}
