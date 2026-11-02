/**
 * `cpp:typedef` 的 **formalize** 路——`typedef long long ll;` 與 `#define ll long long` 對型別是同一件事：別名在 `type()` 展開成原本的型別，
 * 所以它本身不產生任何項目（同 `cpp:define`，spec 197）。學生的程式常見 `typedef long long ll;`、`typedef pair<int,int> pii;`。
 * ⚠️ 原本的型別要認得——認不得的在用到的地方照實標 unknown（`type()` 那一格）。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.definesMacro('cpp:typedef', (n) => ({ name: String(n.properties?.alias ?? ''), value: String(n.properties?.orig_type ?? '') }))
  r.item('cpp:typedef', () => [])
  r.stmt('cpp:typedef', () => [])
}
