# Research: Concept 與 BlockDef 分離

## R1: JSON 拆分策略 — Adapter vs Big-Bang

**Decision**: Adapter 漸進遷移

**Rationale**: 使用 adapter 函式將新格式（concepts.json + block-specs.json）合併回舊的 `BlockSpec[]` 格式，讓所有現有引擎（PatternLifter、TemplateGenerator、PatternRenderer、PatternExtractor）不需修改。這確保零退化風險。

**Alternatives considered**:
- Big-Bang 一次性修改所有引擎 → 風險太高，每個引擎都需重構型別
- 只拆 concept 欄位，其餘不動 → 不符合 architecture-evolution.md 的完整設計

**具體做法**:
1. 新建 `semantics/concepts.json` 和 `projections/blocks/*.json`
2. `module.ts` 載入兩層 JSON 後用 adapter 合併為 `BlockSpec[]`
3. 下游引擎繼續接收 `BlockSpec[]`，無需修改
4. ConceptRegistry 從 concepts.json 直接載入，獨立於 BlockSpecRegistry

## R2: concepts.json 格式設計

**Decision**: 從現有 BlockSpec 的 `concept` + 頂層 metadata 欄位萃取

**Rationale**: 現有 BlockSpec 已有完整的 concept 資訊（`concept.conceptId`、`concept.properties`、`concept.children`、`concept.role`、`concept.annotations`），加上 `level`、`language`、`category` 作為頂層欄位。拆分時直接映射：

```json
{
  "conceptId": "var_declare",
  "layer": "universal",
  "level": 0,
  "abstractConcept": null,
  "properties": ["type", "name"],
  "children": { "init": "expression" },
  "role": "statement",
  "annotations": {}
}
```

**Key mapping**: `layer` 由 `language` 欄位推導 — `language === "universal"` → `"universal"`，否則根據 conceptId 前綴判斷 `"lang-core"` 或 `"lang-library"`。

## R3: block-specs.json 格式設計

**Decision**: 保留 blockDef、codeTemplate、astPattern、renderMapping，新增 conceptId 參照

```json
{
  "id": "c_char_literal",
  "conceptId": "cpp_char_literal",
  "category": "values",
  "level": 1,
  "blockDef": { ... },
  "codeTemplate": { ... },
  "astPattern": { ... },
  "renderMapping": { ... }
}
```

**Rationale**: `codeTemplate` 和 `astPattern` 雖是語意相關，但它們與特定語言的語法綁定（C++ 語法模板、tree-sitter AST 結構），放在投影層更合理。ConceptRegistry 不需要這些資訊。

## R4: manifest.json 結構

**Decision**: 宣告式 manifest，列出資源路徑和 metadata

```json
{
  "id": "cpp",
  "name": "C++",
  "version": "1.0.0",
  "parser": {
    "type": "tree-sitter",
    "language": "cpp"
  },
  "provides": {
    "concepts": ["./semantics/concepts.json"],
    "blocks": ["./projections/blocks/basic.json", "./projections/blocks/advanced.json", "./projections/blocks/special.json"],
    "templates": ["./templates/universal-templates.json"],
    "liftPatterns": ["./lift-patterns.json"]
  }
}
```

**Rationale**: `provides` 使用 key→path[] 格式，讓載入器按類型讀取。路徑相對於 manifest 所在目錄。

## R5: Dummy 唯讀視圖設計

**Decision**: 純 TypeScript 類別，接收 SemanticNode 並產出 HTML string

**Rationale**: 最簡方案 — 不需 DOM framework，不需 Blockly，只依賴 `src/core/` 型別。用靜態分析（grep import）驗證獨立性。

**Alternatives considered**:
- React/Preact component → 過度設計，引入新依賴
- Console-only output → 無法驗證「視圖」概念
