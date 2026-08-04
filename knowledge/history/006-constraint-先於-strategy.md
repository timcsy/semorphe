# 006：從「liftStrategy 先執行」到「constraint-before-strategy」

> 日期：2026-03-09
> （日期取自記錄此事的 commit `fa67b37`；原始改動的確切日期未能從 git 定位，此為**推斷**。）

## 轉移

- **舊**：pattern-lifter 先執行 `liftStrategy`（hand-written 函式），成功後才檢查 constraint。
- **新**：**先驗證 constraint 通過，才執行 liftStrategy**。這是不變式，不是最佳化建議。

## 為什麼變

`// 單行註解` 的 tree-sitter nodeType 也是 `comment`，所以它會跑進 `cpp:liftDocComment` strategy，產出錯誤的 doc_comment 節點。

根本問題是**職責顛倒**：constraint 的作用是「判斷這個 AST 節點是否屬於我」，strategy 的作用是「把屬於我的節點轉成語義節點」。先跑 strategy 等於讓 strategy 自己去判斷該不該處理——而 strategy 是逐個手寫的，每一個都要重新實作一次判斷邏輯，且沒有任何機制保證它們判斷得對。

改成 constraint 先行之後，**strategy 函式可以安全地假設輸入節點已經確認屬於自己**，不需要防禦性檢查。這讓 Layer 3 的手寫成本下降，也讓錯誤在更早、更集中的地方被攔截。

## 狀態

✅ 已採用，列為 [開放擴充](../concepts/開放擴充.md) 的不變式。

同期確立的相關規則：pattern 定義順序很重要——具體的（`/**`）必須排在寬泛的（`/*`）前面，因為 `startsWith` constraint 之間存在偏序關係（見 [005](005-pattern-歧義從禁止到偏序仲裁.md)）。
