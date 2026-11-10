/**
 * `cpp:friend_class` 的 **formalize** 路（第 389 刀）——Cella 的 `mbFriendClass { name }`。
 * 參照翻譯（`cella/tools/cfamily/cpp_to_tree.py` 的 `FriendDecl`）只取名字，class 與 struct 不分；friend 不是成員，沒有存取權。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:friend_class', (n, f) => f.k('mbFriendClass', { name: String(n.properties?.name ?? '') }))
}
