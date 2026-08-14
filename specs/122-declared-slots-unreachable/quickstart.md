# Quickstart

**Date**: 2026-08-14

⚠️ **一顆一個循環。** 每顆做完才做下一顆——三種子機制的修法完全不同。

## 前置

```bash
npx tsc --noEmit && npm test 2>&1 | tail -3      # 4157
npx vitest run tests/integration/audit-conformance.test.ts   # certainViolations 12
md5 -q tests/baselines/*.json                     # 只有 conformance 允許變
```

## 每一顆的循環

### 步驟一：🔴 先紅——來回測試

```
造一段有那個接點的語義樹 → render → extract → 那個值【還在】
★ 正向錨點：接點是空的時候，來回之後【仍然是空的】
```

### 步驟二：判它是哪一種子機制

```
forms/blocks.json 的 args0 非空          → ①或②，改 JSON
args0 空而 renderMapping 引用欄位名       → 🔴 ③，積木在 block-registrar
```

### 步驟三：改

```
①  加 input_value ＋ renderMapping.inputs ＋ 兩份 i18n 標籤
②  加 renderMapping.dynamicRules
③  🔴 JSON 與 block-registrar 【兩邊都改】——第三十四條護欄在看
```

### 步驟四：驗

```bash
npx vitest run tests/integration/audit-conformance.test.ts    # 數字要降
npx vitest run tests/integration/audit-dual-truth.test.ts     # ③ 一定要跑
npm test
```

### 步驟五：commit（🔴 一顆一個）

commit 訊息要說得出**是實作了還是重新分類了**。

---

## 全部做完之後

```bash
npm run build && npm run preview   # ⚠️ 重 build
```

| 情境 | 該看到 |
|---|---|
| `string s = "hi"` → 拖動積木 → 回看程式碼 | 初始值**還在** |
| 舊存檔載入 | ⚠️ **打得開**——測試綠不代表使用者的作品打得開 |

```bash
git diff --stat tests/baselines/
```

🔴 只有 `conformance.json`（＋ 快照，若積木變寬）可以出現，
**而每一個變動都要有理由**。

⚠️ 而**沒清完的每一筆**要寫進 `conformance.json` 的 `_meta.note`：
**為什麼沒清**、**清掉需要什麼**。
