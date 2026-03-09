# Research: Phase 0 — 解耦基礎設施

## R1: EventEmitter 實作策略

**Decision**: 自行實作輕量型別安全 EventEmitter，不使用第三方套件

**Rationale**:
- 需求極簡：on/off/emit 三個方法，加上型別安全的事件映射
- 第三方 EventEmitter（如 eventemitter3、mitt）增加依賴但不提供型別安全的事件映射
- 自行實作約 30-40 行，完全可控，且可在未來擴展為 postMessage 橋接

**Alternatives considered**:
- `eventemitter3`: 功能過剩（wildcard、once），且型別安全需額外包裝
- `mitt`: 輕量但無型別安全映射
- Node.js `events`: 瀏覽器不可用

## R2: ViewHost 介面設計

**Decision**: 定義純介面（interface），不提供基類（abstract class）

**Rationale**:
- Phase 0 只需要型別契約，不需要共享邏輯
- 現有面板（BlocklyPanel、MonacoPanel）各有不同的初始化邏輯，強制繼承會造成不必要的耦合
- Phase 1 時面板 implements ViewHost，不需要改變繼承鏈

**Alternatives considered**:
- Abstract base class: 過早引入繼承耦合，違反簡約原則
- Mixin pattern: 增加複雜度，目前無共享邏輯需求

## R3: Annotations 儲存位置

**Decision**: 在 `ConceptDef` 中加入 `annotations?: Record<string, unknown>` 欄位，JSON 中寫在 `concept.annotations` 位置

**Rationale**:
- ConceptDef 已是概念的權威定義，annotations 是概念的元資料
- `Record<string, unknown>` 保持開放集合，新視圖可定義新的 annotation key
- 放在 BlockSpec JSON 的 `concept` 區段，與 `conceptId`、`properties` 同層，語義上自然

**Alternatives considered**:
- 獨立的 annotations.json 檔案：增加檔案數量，載入時需額外合併
- 寫在 SemanticNode 上：那是節點實例的標註（已存在），不是概念定義的標註

## R4: SemanticBus 錯誤隔離

**Decision**: 訂閱者回呼中的例外用 try-catch 包裹，console.error 報告但不中斷其他訂閱者

**Rationale**:
- 一個視圖的 bug 不應該連鎖影響其他視圖
- 開發期用 console.error 方便除錯
- 生產環境可考慮接入診斷系統（但不在本 Phase 範圍）

**Alternatives considered**:
- 不捕獲（let it crash）：一個視圖掛掉會阻止後續視圖更新
- 靜默吞掉：除錯困難
