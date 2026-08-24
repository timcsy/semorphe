/** `cpp:try_catch` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftTryCatch', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { parseParamDeclaration, extractBody } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // try_statement: try { } catch (type name) { }
    registry.register('cpp:liftTryCatch', (node, ctx) => {
      const tryBody = extractBody(node.childForFieldName('body') ?? null, ctx)
      const catchClause = node.namedChildren.find(c => c.type === 'catch_clause') ?? null
      let catchType = 'exception&'
      let catchName = 'e'
      let catchBody: SemanticNode[] = []
      if (catchClause) {
        const paramList = catchClause.childForFieldName('parameters')
          ?? catchClause.namedChildren.find(c => c.type === 'parameter_list')
        // 🔴 **`catch (...)` 整顆走誠實降級**（2026-08-24，第五十五條護欄第一次跑抓到的）。
        //    捕獲全部**沒有參數宣告**，於是它掉進下面那兩個預設值，產回去變成
        //    `catch (exception& e)`——**捕獲全部縮成只捕獲一種**。
        //
        //    ```cpp
        //    try { throw 1; } catch (...) { return 1; }   // 原文：接得住
        //    try { throw 1; } catch (exception& e) { … }   // 產出：接不住，程式終止
        //    ```
        //
        // > **一個「看起來合理」的預設值，正是 P6 禁止的那種結構**
        // > （`principles.md`：不確定時標記 raw_code，禁止給出看起來合理的結構）。
        //
        // ⚠️ 想收下它的話要動的是**三路**：這裡、產生器的 `catch (${type} ${name})`、
        //    以及積木上那兩格欄位裝不裝得下 `...`。收一半就是現在這個 bug。
        if (paramList?.text.includes('...')) return null
        if (paramList) {
          const param = paramList.namedChildren.find(c => c.type === 'parameter_declaration')
          if (param) {
            const { type, name } = parseParamDeclaration(param)
            catchType = type
            catchName = name
          }
        }
        const catchBodyNode = catchClause.childForFieldName('body') ?? null
        catchBody = extractBody(catchBodyNode, ctx)
      }
      return createNode('cpp:try_catch', { catch_type: catchType, catch_name: catchName }, {
        try_body: tryBody,
        catch_body: catchBody,
      })
    })
}
