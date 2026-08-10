# Quickstart：怎麼驗這一輪真的做到了

## 前置

```bash
g++ --version        # 必須存在。不存在時護欄要**紅**，不是 skip（FR-006）
npm ci
```

## 一、殘差那條

```bash
npx vitest run tests/integration/audit-projection-residual.test.ts
```

**預期**：綠，且報告印出

```
語料   語法完整 467 段 ／ 語法有錯（片段）353 段
殘差   169 字元 / 74855 = 0.23%
```

**證明它真的在量**（不是回報零的空掃描）：

```bash
# 注入：讓某顆元件不再被辨識 → 殘差率必須上升且指名
```
→ 這道注入寫在測試檔內（FR-011 的兩個方向），不需要手動改程式碼。

## 二、誤差那條

```bash
npx vitest run tests/integration/audit-behavior-error.test.ts
```

**預期**：綠（棘輪已定），且報告印出**四欄**語料統計與逐筆明細。

⚠️ **第一次跑必須是紅的**（FR-012）。實測第一次的數字：

```
兩邊都跑得動 276｜只有參照 18｜只有直譯器 14｜兩邊都不成 4
不一致 64／276 = 23.2%
```

而 **64 不是最終基線**——要先逐筆分類（見 `tests/assets/behavior-error-decisions.json`），
把「語料需要標準輸入」「語料是故意錯的示範」判出去之後，剩下的才是真誤差。

## 三、工具收攏

```bash
grep -rln "execSync.*g++" tests/ | wc -l     # 預期 1（就是 tests/helpers/run-cpp.ts）
npx vitest run tests/integration/fuzz-cpp-strings.test.ts \
              tests/integration/fuzz-cpp-stacks-queues.test.ts
```

**預期**：兩個檔的結果**逐字不變**（SC-004）。

## 四、全套

```bash
npm test && npm run lint
```

## 驗收對照

| SC | 怎麼看 |
|---|---|
| 001 兩條獨立 | `ls tests/baselines/ \| grep -E "residual\|error"` → 兩個檔 |
| 002 殘差 ≤ 0.23% ＋ 兩欄 | 上面第一節的報告 |
| 003 誤差明細夠用 | 基線裡的明細不必重跑就看得出差在哪 |
| 004 工具 2 → 1 | 上面第三節的 grep |
| 005 缺編譯器要紅 | `PATH=/nonexistent npx vitest run …behavior-error…` → 紅 |
| 006 首次紅色紀錄 | commit 訊息與 `_meta.note` 記下 64／276 這個起點 |
