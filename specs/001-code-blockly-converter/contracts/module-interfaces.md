# 模組介面規範

定義核心引擎與各語言模組之間的介面契約。

## ParserModule 介面

```typescript
interface ParserModule {
  /** 語言識別碼，如 "c", "cpp" */
  getLanguageId(): string;

  /** 解析程式碼，回傳 AST 根節點 */
  parse(code: string): Promise<ASTNode>;
}
```

## GeneratorModule 介面

```typescript
interface GeneratorModule {
  /** 語言識別碼 */
  getLanguageId(): string;

  /** 從 Blockly workspace 產生程式碼 */
  generate(workspace: BlocklyWorkspace): string;
}
```

## BlockRegistry 介面

```typescript
interface BlockRegistry {
  /** 註冊積木定義，驗證失敗拋出錯誤 */
  register(spec: BlockSpec): void;

  /** 移除積木定義 */
  unregister(id: string): void;

  /** 取得積木定義 */
  get(id: string): BlockSpec | undefined;

  /** 依 AST 節點類型查詢積木 */
  getByNodeType(nodeType: string): BlockSpec[];

  /** 取得某分類下所有積木 ID */
  getByCategory(category: string): string[];

  /** 驗證積木定義格式，回傳錯誤列表 */
  validate(spec: unknown): ValidationError[];

  /** 產生 Blockly 工具箱定義 */
  toToolboxDef(): ToolboxDefinition;
}
```

## Converter 介面

```typescript
interface Converter {
  /** 程式碼轉換為 Blockly workspace 序列化格式 */
  codeToBlocks(code: string, languageId: string): WorkspaceState;

  /** Blockly workspace 轉換為程式碼 */
  blocksToCode(workspace: BlocklyWorkspace, languageId: string): string;
}
```
