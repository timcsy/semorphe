import type { Target } from './types'

/**
 * **目標的登錄表**——照 `TopicRegistry` 的形狀，不發明新擺法。
 *
 * ⚠️ **注入而不是 import**：中立性護欄禁「核心 import `languages/…`」
 * （`audit-neutrality.test.ts:104`：「P9 的原文是『拔掉 C++ 之後，核心
 * **無 `languages/cpp/` import**』」）。資料由語言套件在載入時 `register`。
 */
export class TargetRegistry {
  private targets = new Map<string, Target>()

  register(target: Target): void {
    if (this.targets.has(target.id)) {
      throw new Error(`Duplicate target ID: ${target.id}`)
    }
    this.targets.set(target.id, target)
  }

  get(id: string): Target | undefined {
    return this.targets.get(id)
  }

  all(): Target[] {
    return [...this.targets.values()]
  }

  /** 測試用：清空。 */
  reset(): void {
    this.targets.clear()
  }
}

export const targetRegistry = new TargetRegistry()
