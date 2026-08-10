/**
 * functions 的語言專屬執行路——6 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'

class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}

export { ReturnSignal }

export function registerFunctionsCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:forward_decl', async () => {
    // no-op: forward function declaration
  })

  // ⚠️ **這裡原本有四顆 OOP 概念的空操作**（`struct_at_member`／`struct_at_ptr`／
  // `method_call`／`template_function`），註解寫著「no OOP runtime」。
  //
  // **那句話在 specs/071／072／073 之後就過期了**——那四顆在 `structs.ts` 都有
  // 真實作。它們一直沒出事，是因為 `structs.ts` 載入在後、蓋掉了這裡的空操作
  // ——**靠的是註冊順序，不是設計**。而 `history/018` 記過同一件事咬人的那次：
  // 四個轉型概念有能用的實作，被清單無聲覆蓋，於是 `static_cast<int>(3.9)` 輸出 void。
  //
  // 2026-08-10 刪除。發現它們的是第七條護欄——**而那條護欄自己瞎了四天**
  // （它量的是一個沒載入語言套件的空註冊表）。


  // 註：物件導向那批「已知缺口」的空操作集中在 interpreter.ts 的缺口清單，
  // 那裡有不能直接刪的理由。原本這裡也各註冊一次，兩邊互相覆蓋——行為相同，
  // 但同一個病（勝負靠載入順序）。四個具名轉型的實作在 operators.ts。
  // 見 specs/053-declare-noop-execute/research.md F8。

}
