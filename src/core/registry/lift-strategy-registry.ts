import { componentLiftStrategyRegistrars } from '../component/paths'
import type { AstNode, LiftContext } from '../lift/types'
import type { SemanticNode } from '../types'

export type LiftStrategyFn = (node: AstNode, ctx: LiftContext) => SemanticNode | null

export class LiftStrategyRegistry {
  private strategies = new Map<string, LiftStrategyFn>()

  /**
   * 🔴 **膠囊的具名辨識策略自己長進來**（2026-08-26）。
   *
   * ## 它從哪來
   *
   * `componentLiftStrategyRegistrars()` glob 的是
   * `/src/components/*\/*\/lift-strategy.ts`——**所有語言的膠囊**。
   * 而在此之前它的唯一呼叫點在 `languages/cpp/lifters/index.ts` 裡：
   *
   * > **一個語言中立的登記掛在 C++ 的名字底下。**
   *
   * 於是一個**只用 Python** 的宿主拿不到它，而
   * `examples/bring-your-own-view/src/main.ts` 只好自己補一行
   * ——它的註解逐字：「少了這一步，`if` 會安靜地降級成 `unresolved`，
   * **而程式不會報錯**」。
   *
   * ## 為什麼是建構子，而不是「請呼叫端記得呼叫」
   *
   * 路線圖那一項的標題是「**組裝要收成一個入口，或者漏了要能出聲**」。
   * 而「請記得呼叫」兩者都不是——它把責任留給每一個消費者，
   * 而漏掉的症狀是**降級不是錯誤**。
   *
   * > **一份每個組裝點都要記得做的登記，就是一個還沒收起來的入口。**
   *
   * ⚠️ 語言**自己的**策略（`registerCppLiftStrategies`）仍然由語言套件註冊
   * ——那本來就該掛在它的名字底下。這裡收的只有**膠囊**那一批。
   */
  constructor() {
    for (const reg of componentLiftStrategyRegistrars()) {
      (reg as (r: LiftStrategyRegistry) => void)(this)
    }
  }

  register(name: string, fn: LiftStrategyFn): void {
    this.strategies.set(name, fn)
  }

  get(name: string): LiftStrategyFn | null {
    return this.strategies.get(name) ?? null
  }

  has(name: string): boolean {
    return this.strategies.has(name)
  }
}
