# 概念探索：C++ — std::queue::back()

## 摘要
- 語言：C++
- 目標：`std::queue::back()` — 讀取佇列尾端元素
- 發現概念總數：1
- 通用概念：0、語言特定概念：1
- 建議歸屬的 Topic 層級樹節點：L3a（STL 容器操作）：1 個

## 概念目錄

### L3a: STL 容器操作 — 進階（第三層）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_queue_back` | `q.back()` | 讀取佇列尾端（最後加入）的元素 | OBJ（佇列名稱） | lang-library | 語言特定 | `raw_code` | lift 端不實作（與 vector back 衝突） |

**降級路徑說明**：
- D1：`cpp_queue_back` 專屬積木
- D3：`cpp_raw_expression`（無通用對應）

## 概念詳情

### cpp_queue_back

| 欄位 | 內容 |
|------|------|
| **語法** | `q.back()` |
| **語義意義** | 回傳佇列中最後一個被加入（尾端）的元素，不移除它 |
| **參數** | `obj`：佇列變數名稱 |
| **回傳型別** | 佇列的元素型別（T&） |
| **標頭檔** | `<queue>` |
| **常見模式** | 在 BFS 中查看最後入列但未處理的元素 |
| **先備知識** | `cpp_queue_declare`、`cpp_container_push`、`cpp_queue_front` |
| **錯誤模式** | 在空佇列上呼叫 back()（未定義行為）；與 front() 混淆 |

### Lift 方向限制

`back()` 方法在 C++ STL 中同時存在於 `std::vector`、`std::deque`、`std::queue` 等容器。Semorphe 的 lifter 統一將 `XXX.back()` 模式映射到 `cpp_vector_back`，因此：

- **block → code（generate）**：需實作 → 產生 `q.back()`
- **code → blocks（lift）**：維持現狀，`q.back()` 會 lift 成 `cpp_vector_back`

這是可接受的取捨，因為教育場景中 `back()` 主要以積木方式輸入，從 code→blocks 的 lift 路徑使用率較低。

## 對映關係

| 現有概念 | 說明 |
|----------|------|
| `cpp_queue_front` | `q.front()`，讀前端；`cpp_queue_back` 鏡像此概念讀後端 |
| `cpp_vector_back` | `v.back()`，lift 衝突來源；blockDef 形式完全相同 |
| `cpp_stack_top` | `s.top()`，讀堆疊頂端；對 queue 尾端的語義類比 |

## 四路完備性

| 路徑 | 狀態 | 說明 |
|------|------|------|
| lift | ⚠️ 部分 | 不實作（接受 code→blocks 降級至 `cpp_vector_back`） |
| render | ✅ 需實作 | blockDef 以 `OBJ` 欄位 + message key |
| extract | ✅ 自動 | PatternExtractor 從 blockDef 自動推導 |
| generate | ✅ 需實作 | `generators.ts` 輸出 `${obj}.back()` |
| execute | ✅ 需實作 | interpreter executor 回傳 `arr.value[arr.value.length - 1]`（尾端） |

## 實作順序

1. `src/languages/cpp/std/queue/concepts.json` — 新增 `cpp_queue_back` 概念定義
2. `src/languages/cpp/std/queue/blocks.json` — 新增 blockDef 和 codeTemplate
3. `src/languages/cpp/std/queue/generators.ts` — 新增 generate 函式
4. `src/interpreter/executors/containers.ts` — 新增 executor（回傳尾端元素）
5. `src/languages/cpp/topics/cpp-beginner.json` — 在 L3a 加入 `cpp_queue_back`
6. I18n keys（en/zh）

## 需注意的邊界案例

1. **空佇列**：`back()` 在空佇列上是 UB，executor 應回傳 `defaultValue()` 而非拋出例外
2. **lift 衝突**：接受不完整的 lift 覆蓋（設計決策，已記錄）
3. **OBJ vs VECTOR field 命名**：沿用 `cpp_queue_front` 的 `OBJ` 命名，保持一致
