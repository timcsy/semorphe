# 007：從「Generator 內含依賴推導」到「DependencyResolver 獨立」

> 日期：2026-03-10

## 轉移

- **舊**：program generator 同時負責「產生程式碼」和「推導需要哪些 `#include`」。
- **新**：`DependencyResolver` 是**語言模組的職責**，核心只定義介面；它是 **Scope 3 的索引建構器**，在 `project()` 之前獨立運行，不屬於 generator pipeline。

```typescript
interface DependencyResolver {
  resolve(conceptIds: string[]): DependencyEdge[]
}
```

## 為什麼變

兩個層次的理由。

**理論上**：`#include <iostream>` 不屬於資訊分類學原有的四類（語義/呈現/元資訊/語法偏好）。它是 **Scope 3 的圖邊（depends_on 關係）投影到 Scope 2 程式碼中的產物**——一種跨 Scope 的衍生投影。既然它是從概念使用集合**確定性推導**出來的，那它就應該在推導階段產生，而不是在文字產生階段順便算出來。generator 內含依賴推導違反 P1 的投影管線分離。

**工程上**：把它留在 generator 裡，等於每個新語言都要在自己的 generator 中重新實作一次依賴推導，且核心無從驗證。抽成介面後，新語言只需註冊自己的 resolver。

這個定位也決定了 round-trip 規則：依賴宣告是 **best-effort**——lift() 時可忽略（因為可重新推導），project() 時自動生成。使用者手動加的依賴記錄在 metadata 中避免丟失。

## 狀態

✅ 已採用（commit `212d280` 設計 + 接上 UI，`8217774` 完成 DependencyResolver + ProgramScaffold）。

**尾巴**：generator 中的 auto-include 邏輯當時暫留（功能正確），架構上應完全抽離為 Scaffold 層。後續 2026-06 仍有兩次修補（`a3beb40`、`38c4110`）處理 scaffold 可見時與 blocks→code 方向的 auto-include 注入——顯示這個抽離當時並未做徹底。

完整現場（功能寫好了卻沒接上 UI）見 [episodes/2026-03-10-auto-include-寫好了卻沒接上.md](../episodes/2026-03-10-auto-include-寫好了卻沒接上.md)。
