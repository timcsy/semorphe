# 契約一：導出規則

## 誰是消費者

| 消費者 | 讀什麼 | 今天怎麼拿到 |
|---|---|---|
| Blockly registry | 積木型別字串 | 積木宣告的 `blockDef.type` |
| 工具箱 | 積木型別清單 | 同上 |
| 抽取器／渲染器 | 積木型別 → 概念 | 積木宣告的對應 |
| 存檔還原 | 積木型別字串 | 存檔裡的積木狀態 |

## 契約

```
derive(conceptId, form?) -> blockType

  derive('cpp:stack_peek')                              = 'cpp_stack_peek'
  derive('cpp:var_declare', {axis:'role', value:'expression'})
                                                        = 'cpp_var_declare_expr'
  derive('cpp:container_push', {axis:'container_kind', value:'stack'})
                                                        = 'cpp_container_push_stack'
```

**規則只有兩條**：`:` → `_`；非預設形態接 `_` + `form.value`。

⚠️ **`axis` 不進名字。** 理由：7/9 顆多形態積木今天已經在用
「`_` + value」（`_expr`），把 axis 加進去會讓那 7 顆全部要改。
**照抄已驗證的形狀，不要為了對稱而發明。**
代價是：不同 axis 的 value 若撞名就會導出同名——由 I1 的檢查擋住。

## 邊界：這條規則管不到誰

**使用者上傳的自訂積木定義**（`onUploadCustomBlocks`）沒有 conceptId，
導出規則對它不成立。護欄的範圍必須是「**專案宣告的積木**」，
不是「Blockly 執行期認得的積木」——這兩者在執行期是同一個 registry。

> 這一句不寫死的話，護欄會在使用者上傳一顆自訂積木時變紅，
> 而那是**使用者的正常操作**。
