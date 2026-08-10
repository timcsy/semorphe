/**
 * `<cmath>` 的產生路——**空的，而且是顯式的空**。
 *
 * 三顆概念（`math_pow` / `math_unary` / `math_binary`）都已膠囊化，
 * 產生器隨各自的膠囊搬走了。這個模組現在只剩「`<cmath>` 這個標頭存在」
 * 這件事本身——它仍然是工具箱分類與 `requires` 的錨點。
 *
 * ⚠️ 保留這個空函式而不是刪掉模組，是為了讓「這個標頭沒有東西」與
 * 「這個標頭忘了註冊」分得出來——`StdModule` 的同一條紀律。
 */
import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'

export function registerGenerators(_g: Map<string, NodeGenerator>, _style: StylePreset): void {}
