/**
 * `cpp:deque_declare` 的 **lift** 路——**一筆資料：「`deque` 這個樣板名屬於我」**
 *
 * 🔴 在此之前這個名字**沒有主人**，於是 `deque<pair<int,int>> q;` 掉進
 * 一般的變數宣告，`type` 裝著一整串 `deque<pair<int,int>>`——那個容器
 * 因此沒有 `elemType`，而 `q[0].first` 說「（不是一個結構）」。
 *
 * ⚠️ 判別邏輯（找 `template_type`、拆樣板引數、抓宣告子）本來就是共用的，
 * 留在共用檔是對的；**要回家的是這個宣告**。
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('deque', 'cpp:deque_declare', 'cpp/deque_declare')
}
