# Research: DependencyResolver 抽象 + Program Scaffold

**Date**: 2026-03-10 | **Feature**: 020-dependency-scaffold

## R1: 現有 ModuleRegistry 架構分析

**Decision**: ModuleRegistry 直接實作 DependencyResolver 介面，不另建 adapter

**Rationale**:
- ModuleRegistry 已有 `getRequiredHeaders(conceptIds: string[]): string[]` 方法
- DependencyResolver 只需擴展回傳型別為 `DependencyEdge[]`（含 sourceType + directive）
- 現有 ~30 個 StdModule 的註冊機制不變，只需在 getRequiredHeaders 基礎上增加 `resolve()` 方法

**Alternatives considered**:
- 建立獨立 CppDependencyResolver 類別包裝 ModuleRegistry → 多一層間接性，違反簡約原則
- 從頭重寫不繼承 ModuleRegistry → 破壞現有測試，風險高

## R2: Program Boilerplate 現況

**Decision**: ProgramScaffold 為全新功能，非重構

**Rationale**:
- 經研究確認，**目前系統不產生 `int main() { ... }` 或 `return 0;`**
- Program generator（`statements.ts` line 12-46）直接渲染語句序列
- `#include` 由 auto-include 系統處理，`using namespace std;` 由使用者手動放置積木
- ProgramScaffold 需要**新增**以下能力：
  - 自動產生 `int main() {` / `return 0;` / `}` 包裹
  - 統一管理 auto-include 結果
  - 管理 `using namespace std;` 的自動產生
- 這是新功能，非重構現有硬編碼

**Alternatives considered**:
- 只重構 auto-include 而不加 main() 包裹 → 不滿足 spec 的 scaffold 四區段需求
- 在 generator 中硬編碼 main() → 違反 DependencyResolver 的語言無關設計

## R3: Monaco Ghost Line 實作方式

**Decision**: 使用 Monaco `deltaDecorations` API + CSS 類別

**Rationale**:
- 現有 `MonacoPanel` 已使用 `deltaDecorations` 做行高亮（`addHighlight` 方法）
- Ghost line 可用相同 API，設定 `isWholeLine: true` + 自訂 CSS 類別（低透明度）
- Hover tooltip 可用 Monaco 的 `HoverProvider` API 註冊
- L0 隱藏模式：程式碼字串包含 boilerplate，但 Monaco 使用 `editor.setHiddenAreas()` 或摺疊 API 隱藏對應行

**Alternatives considered**:
- 使用 Monaco 的 `viewZones` API → 更複雜，適用於插入虛擬行而非標記現有行
- 用 CSS `display:none` 硬隱藏 → 不可靠，Monaco 行號會錯亂
- L0 模式產生不含 boilerplate 的程式碼 → 已在 clarify 階段決定不採用

## R4: DependencyResolver 介面設計

**Decision**: `resolve(conceptIds: string[]): DependencyEdge[]` 最小介面

**Rationale**:
- 輸入：概念 ID 列表（從語義樹 collectConcepts 收集）
- 輸出：DependencyEdge 列表（每個含 sourceType + directive + 可選 reason）
- 取代現有 `getRequiredHeaders`，不保留向後相容，所有呼叫端遷移至 `resolve()`
- C++ 實作中所有 std headers 的 sourceType 均為 `'stdlib'`
- reason 欄位供 Ghost Line tooltip 使用（如 `'cout'`）

**Alternatives considered**:
- 接受整棵語義樹而非 conceptIds → 增加介面耦合度
- 回傳 Map<header, conceptIds[]> → 結構過於複雜
- 保留 getRequiredHeaders 向後相容 → 維護雙 API 負擔，違反簡約原則

## R5: ProgramScaffold 與認知等級整合

**Decision**: ProgramScaffold 接受認知等級參數，直接標記 ScaffoldItem 的 visibility

**Rationale**:
- 現有 `cognitive-levels.ts` 定義 L0/L1/L2 對積木的過濾
- ProgramScaffold 不修改認知等級系統，只消費其值
- visibility 映射規則：L0→hidden, L1→ghost, L2+→editable
- 每個 ScaffoldItem 都帶 visibility 標記，code generator 和 Monaco panel 根據標記決定行為

**Alternatives considered**:
- ProgramScaffold 不管認知等級，由 UI 層判斷 → 違反單一責任（scaffold 應知道每個項目的可見性）
- 建立 VisibilityResolver 獨立層 → 過度設計
