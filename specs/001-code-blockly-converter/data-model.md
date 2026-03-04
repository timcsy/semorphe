# 資料模型：程式碼與 Blockly 積木雙向轉換工具

## Block Spec（積木定義）

描述一個積木的完整規格。是系統的核心資料結構。

**屬性**:
- `id`: string — 積木唯一識別碼（如 `c_for_loop`）
- `category`: string — 工具箱分類（如 `loops`、`variables`、`functions`）
- `blockDef`: object — Blockly JSON 積木定義（外觀、輸入欄位、顏色、tooltip）
- `codeTemplate`: object — 程式碼模板，描述如何從積木產生程式碼
  - `pattern`: string — 程式碼模板字串，含佔位符（如 `for (${INIT}; ${COND}; ${UPDATE}) {\n${BODY}\n}`）
  - `imports`: string[] — 此積木需要的 #include 指令
  - `order`: number — 運算子優先順序（用於括號判斷）
- `astPattern`: object — AST 匹配模式，描述如何從 CST 辨識此積木
  - `nodeType`: string — tree-sitter CST 節點類型（如 `for_statement`）
  - `constraints`: object[] — 子節點約束條件（可選）
- `version`: string — 定義檔版本號

**唯一性**: `id` 欄位全域唯一，內建積木與自訂積木不得衝突。

## Block Registry（積木註冊表）

管理所有已載入的積木定義。

**屬性**:
- `blocks`: Map<string, BlockSpec> — 以 id 為 key 的積木定義映射
- `categories`: Map<string, string[]> — 分類到積木 id 列表的映射

**操作**:
- `register(spec)`: 驗證並註冊積木定義
- `unregister(id)`: 移除積木定義
- `get(id)`: 取得積木定義
- `getByNodeType(nodeType)`: 依 AST 節點類型查詢積木（Code → Block 用）
- `getByCategory(category)`: 取得某分類下所有積木
- `validate(spec)`: 驗證積木定義格式
- `toToolboxDef()`: 產生 Blockly 工具箱定義

## Parser Module 介面

語言解析器的抽象介面。

**操作**:
- `parse(code: string)`: 解析程式碼，回傳 AST
- `getLanguageId()`: 回傳語言識別碼（如 `cpp`）

## Generator Module 介面

程式碼產生器的抽象介面。

**操作**:
- `generate(workspace)`: 從 Blockly workspace 產生程式碼字串
- `getLanguageId()`: 回傳語言識別碼

## Converter（轉換協調器）

協調雙向轉換的中樞。

**依賴**:
- BlockRegistry
- Parser Module（Code → Block 方向）
- Generator Module（Block → Code 方向）

**操作**:
- `codeToBlocks(code, languageId)`: 程式碼 → Blockly workspace JSON
- `blocksToCode(workspace, languageId)`: Blockly workspace → 程式碼字串

## Workspace State（工作區狀態）

使用者的工作內容，用於持久化。

**屬性**:
- `blocklyState`: object — Blockly workspace 的 JSON 序列化
- `code`: string — 目前的程式碼內容
- `languageId`: string — 目前使用的語言
- `customBlockSpecs`: BlockSpec[] — 使用者上傳的自訂積木定義
- `lastModified`: string — 最後修改時間（ISO 8601）
