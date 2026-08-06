# Feature Specification: 介面層寫死的兩件概念知識

**Feature Branch**: `062-ui-concept-knowledge` ｜ **Created**: 2026-08-06

## 為什麼做這個

中立性剩 4 筆，其中 2 筆的形狀相同：**一件本來該由概念自己說的事，被介面層寫死了。**

| 位置 | 寫死了什麼 | 該由誰說 |
|---|---|---|
| 應用層的自動引入 | 「引入指令這個概念叫 `cpp_include`」 | 語言套件——換一種語言它叫別的名字 |
| 同步控制器的降級 | 「`cpp_string_declare` 降級時要保留型別前綴 `string`」 | 概念自己——而且只認得這一個，多一個同類就要回頭改 |

第二個特別值得看：那行程式碼是 `node.concept === 'cpp_string_declare' ? 'string' : undefined`。
**它只處理一個概念**，而且沒有任何東西提醒下一個同類概念也需要它。

## Requirements

- **FR-001**: 介面層 MUST NOT 認得「哪個概念代表引入」
- **FR-002**: 降級時保留的型別前綴 MUST 由概念自己宣告
- **FR-003**: 宣告 MUST 走既有的推送通道（語言套件推、核心讀）
- **FR-004**: 行為 MUST 完全不變
- **FR-010**: 既有測試全數通過；其餘量測不得上升

## Success Criteria

- **SC-001**: 中立性 **4 → 2**
- **SC-002**: 完備性各數字不變
- **SC-003**: 既有測試全數通過

## Out of Scope

- ❌ **剩下的 2 筆**（積木註冊處的 `cpp_string_at` / `cpp_string_declare`）——那是雙重真相的結構問題，已有專門護欄在看，修法量級不同
