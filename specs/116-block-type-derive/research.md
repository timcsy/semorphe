# Phase 0：研究——規格的四個未知，實測之後三個變了

**日期**：2026-08-11 ｜ **規格**：[spec.md](spec.md)

規格自己標了一條「實作要先驗的假設」。驗完之後**它是錯的**，
而順著同一條線又量到三件規格沒寫的事。四項全部列在下面。

---

## 研究一：存檔管道有幾個？——**三個，但只有兩個需要遷移**

**Decision**：一次性轉換掛在既有的版本升級鏈上即可覆蓋兩個管道；
第三個管道**不在本規格範圍**，但必須在護欄裡明確排除。

**Rationale**（實測）：

| 管道 | 進入點 | 走不走版本升級 |
|---|---|---|
| localStorage 載入 | `src/core/storage.ts:129` `judgeJSON` → `upgrade` | ✅ 走 |
| 匯入 JSON 檔 | `src/core/storage.ts:194` `importFromJSON` → 同一組 `judgeJSON`／`upgrade` | ✅ 走 |
| **上傳自訂積木定義** | `src/ui/app.ts:232` `onUploadCustomBlocks` → `Blockly.common.defineBlocksWithJsonArray` | ❌ **完全不走** |

前兩個共用同一個升級入口——**這是好消息**：一個轉換點覆蓋兩個管道，
不需要在兩處各寫一份（那會漂移）。

第三個是**使用者自己上傳的積木定義**，它的 `type` 由使用者決定，
專案無從導出。它今天唯一的驗證是「有沒有 `type` 欄位」
（`src/ui/app-shell.ts:679`）。

> **所以護欄的範圍必須是「專案宣告的積木」，不是「Blockly 認得的積木」。**
> 這兩者在執行期是同一個 registry，而**只有前者能被導出規則約束**。

**規格要修正的一句**：Assumptions 寫「只有 localStorage 與匯出檔兩個存檔管道」
——存檔管道確實是兩個，但**積木型別的入口是三個**。差別重要，因為 FR-001
（「每一顆積木的型別必須從身分導出」）若不劃界，會把使用者的自訂積木也算進去。

**Alternatives considered**：
- 「連自訂積木也強制導出」→ ❌ 那等於禁止自訂積木；而自訂積木沒有 conceptId，
  導出規則對它不成立。

---

## 研究二：多形態怎麼導出？——**9 顆，而慣例已經存在，只是沒有被宣告**

**Decision**：導出名 = `conceptId` 的 `:` 換成 `_`；**非預設形態再加 `_` + form.value**。

**Rationale**（實測 9 顆全部列出）：

| 身分 | 今天的積木型別 | `form` |
|---|---|---|
| `cpp:var_declare` | `u_var_declare`／`c_var_declare_expr` | –／`role=expression` |
| `cpp:func_call` | `u_func_call`／`u_func_call_expr` | –／`role=expression` |
| `cpp:input` | `u_input`／`u_input_expr` | –／`role=expression` |
| `cpp:increment` | `c_increment`／`c_increment_expr` | –／`role=expression` |
| `cpp:var_assign_compound` | `c_compound_assign`／`c_compound_assign_expr` | –／`role=expression` |
| `cpp:method_call` | `cpp_method_call`／`cpp_method_call_expr` | –／`role=expression` |
| `cpp:input_formatted` | `c_scanf`／`c_scanf_expr` | –／`role=expression` |
| `cpp:container_push` | `c_container_push`／`c_stack_push`／`c_queue_push` | –／`container_kind=stack`／`queue` |
| `cpp:container_pop` | `c_container_pop`／`c_stack_pop`／`c_queue_pop` | –／`container_kind=queue`／`stack` |

~~**7 顆已經在用 `_` + value 的後綴慣例**（`_expr`）——導出規則不是新發明，
是把一條已經跑了很久的慣例宣告出來。~~

### ⚠️ 訂正（2026-08-11，護欄第一次跑當場否證）

**那句話是錯的，而它是本份研究唯一一個「照抄」的理由。**

```
form.value = 'expression'   而積木型別的後綴是  _expr     ← 縮寫，不是 value
form.value = 'stack'        而積木型別是  c_stack_push    ← value 塞在主體裡
```

11 個非中性形態裡**一個都沒有**在用「`_` ＋ form.value」。
我看到 `_expr` 就以為它是 `_` ＋ value，**而 value 是 `expression`**。

> **「照抄已驗證的形狀」這個理由本身沒有被驗證過。**
> 而它差一點就成為一個設計決定的唯一依據。

**規則不變**（`_` ＋ form.value），理由換成真的那個：

- 加 `axis` 會讓名字裡出現**兩份分類資訊**——`cpp_var_declare_role_expression`
  裡的 `role` 讀不出任何東西，`expression` 已經說完了
- **縮寫表（`expression` → `expr`）是第三份會漂移的命名**，正是本規格要消滅的
  東西。所以不縮寫

**代價**：11 個非中性形態**全部要改名**（`u_input_expr` → `cpp_input_expression`），
而不是原本以為的「7 顆保留、4 顆改」。它們本來就在 153 筆裡，所以總數不變。

**⚠️ 撞名風險**：兩個形態的 `form.value` 若相同就會導出同名。
實測 9 顆的 value 只有三種（`expression`／`stack`／`queue`），
同一顆身分內不重複。**但那是今天的事實，不是保證**——所以要一條檢查釘住它
（規格的 FR-010）。

**Alternatives considered**：
- 後綴用 `axis_value`（`cpp_var_declare_role_expression`）→ ❌ 名字裡兩份分類資訊，
  而 `role` 讀不出任何東西（~~原本寫「會把 7 顆已經對的變成要改」——**那是錯的**，
  見上面的訂正：一顆都沒有已經對~~）。
- 後綴用縮寫（`expression` → `expr`，保留今天的 7 顆）→ ❌ **縮寫表是第三份會漂移的
  命名**，正是本規格要消滅的東西。
- 不加後綴、讓多形態共用一個型別 → ❌ Blockly 的 registry 以 type 為鍵，
  共用就只剩一顆積木。

---

## 研究三：⚠️ **拿形狀當判斷——第七種形狀活在工具箱裡，這次改名會打破它**

**Decision**：`src/ui/toolbox-builder.ts:100-101` 必須從**前綴判斷**改成
**問概念宣告的 `layer` 欄位**，而且要與改名**同一批**做。

**Rationale**：

```ts
// src/ui/toolbox-builder.ts:100-101
const universalIo = ioTypes.filter(t => t.startsWith('u_'))
const langIo = ioTypes.filter(t => !t.startsWith('u_'))
```

改名之後**沒有任何型別以 `u_` 開頭** → `universalIo` 恆為空、`langIo` 是全部
→ `iostream`／`printf` 的排序偏好**靜靜地失效**。

⚠️ **而這一行上方的註解記著它已經害過一次**：

> 「這裡原本寫 `filter(t => t.startsWith('c_'))`，於是 `cpp_getline`、
> `cpp_ifstream_declare`、`cpp_ofstream_declare` 三顆**兩邊都不屬於**，
> 被這個排序函式**靜靜地丟掉**……那不是『忘了加進清單』，
> 是**宣告是對的，而呈現層把它吃掉了**。」

這正是 `experience.md` 第七種形狀（**拿形狀當判斷**）與那條教訓：

> **命名慣例不是契約。** 要判斷「這顆概念是不是 X」，就宣告一個 X 標註，
> 不要看名字長什麼樣。

**替換的影響面已量**：

```
u_ 前綴的積木              27
其概念 layer=universal 的  31
u_ ⊄ 差集                   0   ← 每一顆 u_ 的概念都真的是 universal
layer=universal 但沒 u_ 前綴 4   c_comment_block / c_comment_doc /
                                c_comment_line / c_var_declare_expr
```

那 4 顆裡**沒有一顆是 IO 類**，而這個 filter 只作用在 IO 類上
→ **實際行為改變預期為 0**，但仍要用測試釘住，不能用推理代替。

**Alternatives considered**：
- 保留 `u_` 前綴不改 → ❌ 那等於保留雙重命名，本規格就沒有意義了。
- 改名後在 toolbox 硬編一份 universal 清單 → ❌ 那是第三份會漂移的命名。

---

## 研究四：積木型別以幾種非字面形狀出現？

**Decision**：改名腳本**不能只掃字串字面**；已確認的非字面形狀有三種，
每一種各有處置。

**Rationale**（照 `experience.md` 的七種形狀逐一掃）：

| 形狀 | 實測 | 處置 |
|---|---|---|
| 裸的物件鍵 | **155 處** | 主要工作量所在 |
| 正則裡的形狀 | 0（只剩一則註解在講歷史） | — |
| **模板字串** | **1 處**：`std/cctype/generators.ts:8` `` g.set(`cpp_${func}`) `` | 必須手改，掃描器看不到 |
| 型別聯集 | 0 | — |
| 測試標題 `[BLOCKED:…]` | 0 | — |
| JSON 的值位置 | 需在實作時逐檔確認 | — |
| **拿形狀當判斷** | **1 處**：`toolbox-builder.ts:100-101` | 見研究三 |

⚠️ **模板字串那一處剛在上一輪付過代價**：兩顆概念的產生器從未存在，
而 35 條護欄全部看不見（`history/047`）。這次它出現在**積木型別**上，
而且是 `Map.set` 的鍵——改名腳本掃不到，**必須手工列進檢查清單**。

**Alternatives considered**：
- 「先數有幾處再說」→ ❌ 教訓明確反對：**先問「有幾種不以字串字面出現的方式」，
  不是先問「有幾處」**。

---

## 研究五：`type` 這個欄位名長在幾個型別上？——最高風險的緩解

**Decision**：**分兩段推**（規格 FR-011）。先只改已膠囊化那 10 顆裡不符的 5 顆，
驗證整條管線，再推其餘。

**Rationale**：上一次「同一個欄位名長在三個型別上」的改名**回退了 121 個檔**。
這次 `type` 至少長在：

- Blockly 的 block（`Blockly.Blocks['u_if']`）
- `blockDef.type`（專案的積木宣告）
- Blockly 積木定義 JSON 內部的 `args` 也有 `type`（`input_value`／`field_dropdown`…）
  ——`src/languages/cpp/block-input-names.ts:40` 就在讀這個 `a.type`

第三項最危險：**它與積木型別完全無關，但字面一模一樣**。
任何「把 `type` 欄位的值改掉」的腳本都會誤傷它，而**型別檢查看不到**
（兩邊都是 `string`）。

→ 所以改名的目標必須寫成「**`blockDef.type` 這個特定位置**」，
不是「所有叫 `type` 的欄位」。

---

## 對規格的修正建議（三處）

| 規格原文 | 實測 | 建議 |
|---|---|---|
| Assumptions：「只有 localStorage 與匯出檔兩個存檔管道」 | 存檔管道是 2 個 ✅，但**積木型別入口是 3 個** | 補一句：護欄範圍限定「專案宣告的積木」 |
| FR-010「同一顆身分若有多個積木形態，MUST 有明確且可檢查的區分方式」 | ⚠️ **慣例不存在**——11 個非中性形態**一個都沒有**在用 `_` + form.value（`_expr` 是縮寫） | 規則仍是 `_` + value，但理由不是「照抄」而是「不要縮寫表」；11 顆全部要改名 |
| 明確不做：「`u_`/`c_`/`cpp_` 與 `layer` 差 2 顆」 | 今天差 **4** 顆，而且 `u_ ⊂ layer=universal` | 差集不處理仍然對，但 **`toolbox-builder` 必須跟著改**，那不是「不做」 |
