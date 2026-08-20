/**
 * Python 的 lift transform——`lift-pattern.json` 的 `transform` 以名字引用它們。
 *
 * ⚠️ **剝註解不自己寫規則，問 `commentSyntax()`**：
 * 「Python 的註解用 `#`」那句話已經宣告在 `comment-syntax.ts` 了，
 * 在這裡再寫一次就是第二份真相——而兩份會漂移。
 */
import { commentSyntax } from '../../core/comment-syntax'

export function registerPythonTransforms(
  registry: { register(name: string, fn: (text: string) => string): void },
): void {
  registry.register('python:stripComment', (text) => commentSyntax().strip(text))
}
