# Module Interfaces: 概念式積木系統

**Feature**: 002-concept-blocks-redesign
**Date**: 2026-03-03

## 核心介面

### BlockSpec（修改）

```typescript
interface BlockSpec {
  id: string                     // 唯一識別碼
  language: 'universal' | string // 'universal' 或語言 ID（如 'cpp'）
  category: string               // 概念類別
  version: string
  blockDef: Record<string, unknown>  // Blockly JSON 定義

  // 僅語言特殊積木需要（共用積木為 undefined）
  codeTemplate?: CodeTemplate
  astPattern?: AstPattern
}
```

### LanguageModule（新增）

```typescript
interface LanguageModule {
  readonly languageId: string

  getParser(): ParserModule
  getGenerator(): GeneratorModule
  getBlockSpecs(): BlockSpec[]       // 該語言的特殊積木定義
  getAdapter(): LanguageAdapter      // AST ↔ 積木映射
}
```

### LanguageAdapter（新增）

```typescript
interface LanguageAdapter {
  /**
   * 給定 AST 節點，回傳對應的積木 ID。
   * 優先匹配共用積木，無法匹配時才嘗試語言特殊積木。
   * 回傳 null 表示需要降級為原始碼積木。
   */
  matchNodeToBlock(node: Node): string | null

  /**
   * 給定 AST 節點和目標積木 ID，萃取欄位值。
   * 回傳 { fields, inputs } 與現有的 extractFieldsAndInputs 功能相同。
   */
  extractFields(node: Node, blockId: string): {
    fields: Record<string, unknown>
    inputs: Record<string, { block: BlockJSON }>
  }

  /**
   * 給定共用積木 ID 和欄位值，生成該語言的程式碼片段。
   * 語言特殊積木使用 codeTemplate，不呼叫此方法。
   */
  generateCode(blockId: string, block: BlockJSON, indent: number): string
}
```

### ParserModule（不變）

```typescript
interface ParserModule {
  getLanguageId(): string
  parse(code: string): Promise<Tree>
}
```

### GeneratorModule（修改）

```typescript
interface GeneratorModule {
  getLanguageId(): string

  /**
   * 從 Blockly workspace JSON 生成程式碼。
   * 內部透過 LanguageAdapter.generateCode() 處理共用積木，
   * 透過 codeTemplate 處理語言特殊積木。
   */
  generate(workspace: WorkspaceJSON): string
}
```

### SourceMapping（新增）

```typescript
interface SourceMapping {
  blockId: string
  startLine: number   // 0-based
  endLine: number     // 0-based
}
```

## 模組依賴關係

```
App
 ├── BlockRegistry          ← 管理所有 BlockSpec（universal + language-specific）
 ├── LanguageModule (cpp)    ← 提供 Parser, Generator, Adapter, BlockSpecs
 ├── Converter               ← 協調 Parser ↔ Registry ↔ Generator
 │    ├── CodeToBlocksConverter  ← 使用 LanguageAdapter 做 AST → Block 映射
 │    └── GeneratorModule        ← 使用 LanguageAdapter 做 Block → Code 生成
 ├── SyncController          ← 雙向同步（不變）
 ├── BlocklyEditor           ← 按 language 過濾工具箱積木
 └── CodeEditor              ← 不變
```

## 資料流

### Code → Blocks（解析方向）

```
C++ 程式碼
  → CppParser.parse()           → tree-sitter Tree
  → CodeToBlocksConverter
      → CppAdapter.matchNodeToBlock(node)  → 積木 ID
      → CppAdapter.extractFields(node, id) → fields + inputs
      → buildBlock()             → BlockJSON
      → chainStatements()        → workspace JSON
      → 附加 SourceMapping[]
  → Blockly workspace
```

### Blocks → Code（生成方向）

```
Blockly workspace JSON
  → CppGenerator.generate()
      → 遍歷 block chain
      → 共用積木: CppAdapter.generateCode(blockId, block)
      → 語言特殊積木: substituteTemplate(codeTemplate.pattern, block)
      → 收集 imports
      → 組合成完整程式碼
  → C++ 程式碼字串
```

### 雙向對照高亮

```
使用者點選積木 → Blockly 事件
  → 查 SourceMapping[blockId]
  → CodeMirror.dispatch(highlight startLine..endLine)

使用者點選程式碼行 → CodeMirror 事件
  → 查 SourceMapping（找 startLine <= cursorLine <= endLine 的 block）
  → Blockly.workspace.highlightBlock(blockId)
```
