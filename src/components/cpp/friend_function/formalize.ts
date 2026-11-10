/**
 * `cpp:friend_function` 的 **formalize** 路（第 389 刀）——Cella 的 `mbFriend { f, ret, params }`。
 * 參照翻譯（`cella/tools/cfamily/cpp_to_tree.py` 的 `FriendDecl`）靠簽章認函式：參數只送型別，void 回傳送 null；friend 不是成員，沒有存取權。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:friend_function', (n, f) => {
    const p = n.properties ?? {}
    const ret = String(p.return_type ?? 'void') === 'void' ? null : f.type(p.return_type, n)
    const params = (n.slots?.params ?? []).map((q) => f.type(q.properties?.type, q))
    return f.k('mbFriend', { f: String(p.name ?? ''), ret, params })
  })
}
