# Contract: Semantic Tree API

系統核心的公開介面，所有 UI 層和語言模組透過此 API 與語義樹互動。

## SemanticTree（語義樹管理器）

```
createEmpty() → SemanticNode
  建立空的 program 根節點

fromJSON(json: string) → SemanticNode
  從 JSON 字串反序列化語義樹
  錯誤：InvalidFormatError（格式不合法）、VersionMismatchError（版本不相容）

toJSON(tree: SemanticNode) → string
  將語義樹序列化為 JSON 字串

addChild(parent: SemanticNode, childName: string, child: SemanticNode) → SemanticNode
  在指定子節點槽位新增子節點，回傳新版本的根節點

removeChild(parent: SemanticNode, childName: string, index: number) → SemanticNode
  移除指定位置的子節點，回傳新版本的根節點

updateProperty(node: SemanticNode, key: string, value: PropertyValue) → SemanticNode
  更新節點屬性，回傳新版本的根節點

findById(tree: SemanticNode, id: string) → SemanticNode | null
  在樹中查找指定 ID 的節點
```

## ProjectionPipeline（投影管線）

```
projectToCode(tree: SemanticNode, language: string, style: StylePreset) → string
  將語義樹投影為程式碼文字
  保證：輸出為合法的目標語言程式碼

projectToBlocks(tree: SemanticNode, language: string, locale: string, level: number) → BlocklyWorkspaceState
  將語義樹投影為 Blockly 積木結構
  保證：所有語義節點都被表示（超出層級的降級顯示）

parse(code: string, language: string) → AST
  將程式碼解析為 AST（使用 tree-sitter）
  保證：即使有語法錯誤也會回傳部分 AST（tree-sitter error recovery）

lift(ast: AST, language: string) → LiftResult
  將 AST 提升為語義樹
  回傳：{ tree: SemanticNode, errors: LiftError[], hasUnresolved: boolean }
  保證：所有 AST 節點都被處理（四級策略，不丟失資訊）
```

## ConceptRegistry（概念註冊表）

```
register(def: ConceptDef) → void
  註冊一個概念定義
  錯誤：DuplicateConceptError（ID 已存在）

get(id: ConceptId) → ConceptDef | undefined
  查詢概念定義

listByLayer(layer: string) → ConceptDef[]
  列出指定層級的所有概念

listByLevel(level: number) → ConceptDef[]
  列出指定認知層級（含以下）的所有概念

findAbstract(concreteId: ConceptId) → ConceptDef | undefined
  查找具體概念映射的抽象概念
```

## BlockSpecRegistry（積木規格註冊表）

```
loadFromJSON(jsonArray: BlockSpec[]) → void
  從 JSON 陣列批量載入積木規格

getByConceptId(conceptId: ConceptId) → BlockSpec | undefined
  根據概念 ID 查找積木規格

getByAstPattern(nodeType: string, constraints: AstConstraint[]) → BlockSpec[]
  根據 AST 模式查找匹配的積木規格（可能多個）

listByCategory(category: string, level: number) → BlockSpec[]
  列出指定分類和認知層級的積木規格（用於工具箱建構）
```

## StorageService（持久化服務）

```
save(state: WorkspaceState) → void
  儲存工作區狀態到 localStorage
  錯誤：StorageFullError（空間不足時提示使用者匯出）

load() → WorkspaceState | null
  從 localStorage 載入工作區狀態

exportToFile(state: WorkspaceState) → Blob
  將工作區狀態匯出為 JSON 檔案

importFromFile(file: File) → WorkspaceState
  從 JSON 檔案匯入工作區狀態
  錯誤：InvalidFormatError、VersionMismatchError
```
