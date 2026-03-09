# Quickstart: Concept 與 BlockDef 分離

## 驗證流程

### 1. 基本功能不退化

```bash
# 全部測試通過
npx vitest run

# 建構成功
npm run build
```

### 2. JSON 拆分完整性

```bash
# concepts.json 涵蓋所有原 BlockSpec 的 concept
# （數量應與原 BlockSpec 總數一致）
node -e "
  const c = require('./src/blocks/semantics/universal-concepts.json');
  const cc = require('./src/languages/cpp/semantics/concepts.json');
  console.log('Total concepts:', c.length + cc.length);
"

# block-specs.json 涵蓋所有原 blockDef
node -e "
  const b = require('./src/languages/cpp/projections/blocks/basic.json');
  const a = require('./src/languages/cpp/projections/blocks/advanced.json');
  const s = require('./src/languages/cpp/projections/blocks/special.json');
  console.log('Total projections:', b.length + a.length + s.length);
"
```

### 3. ConceptRegistry 獨立性

```bash
# concept-registry.ts 不 import blockly
grep -r "from 'blockly'" src/core/concept-registry.ts
# 預期：無結果

# concepts.json 不包含 blockDef
grep -r "blockDef" src/blocks/semantics/ src/languages/cpp/semantics/
# 預期：無結果
```

### 4. Dummy 視圖獨立性

```bash
# semantic-tree-view.ts 不 import blockly 或 projections
grep -r "from 'blockly'\|projections\|panels/" src/views/semantic-tree-view.ts
# 預期：無結果
```

### 5. Manifest 驅動載入

```bash
# manifest.json 存在且格式正確
cat src/languages/cpp/manifest.json | python3 -m json.tool
# 預期：有效 JSON，包含 id、name、version、provides
```

### 6. 瀏覽器 Smoke Test

1. `npm run dev` 啟動開發伺服器
2. 開啟瀏覽器，確認 Blockly toolbox 正常顯示
3. 拖拽積木並檢查程式碼產生
4. 在 Monaco 輸入程式碼並檢查 code→blocks 同步
5. 切換 cognitive level（L0→L1→L2）檢查 toolbox 更新
6. 切換 style preset（APCS↔競賽）檢查 style conformance
