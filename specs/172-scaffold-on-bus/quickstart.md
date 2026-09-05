# 怎麼驗這一刀真的做到了

## 前置

```bash
npm ci          # 只有第一次
```

## ① 護欄：組裝點不得直接呼叫（SC-001 · SC-005）

```bash
npx vitest run tests/integration/audit-scaffold-on-bus.test.ts
```

**預期**：全綠。而在動手【之前】跑它，它應該**紅在 `src/ui/app.ts` 的那一行**
——那是這條護欄的「先紅」，不是合成的。

驗它擋得住（⚠️ **用備份檔還原，不要用 `git checkout`**
——那個檔多半有未提交的改動）：

```bash
cp src/ui/app.ts /tmp/app.bak
echo '// this.blocklyPanel?.markScaffoldBlocks(new Set(), "ghost")' >> src/ui/app.ts
# ⚠️ 註解掉的那一行也要被抓到嗎？不——護欄掃的是【呼叫】，所以請注入真的一行
npx vitest run tests/integration/audit-scaffold-on-bus.test.ts    # 應該紅
cp /tmp/app.bak src/ui/app.ts
```

## ② 組裝點呼叫視圖的次數要【下降】（SC-002）

```bash
npx vitest run tests/integration/audit-four-independences.test.ts
```

**預期**：語料那一格（`方法呼叫數`）會**上升**——那是正常的，加了東西。
🟢 **要看的是 `visibleNotRatcheted.compositionRootViewCalls`**：72 → 71。

⚠️ 它**不是棘輪**（2026-08-26 分欄過），所以不會自己紅
——要手動比對基線前後：

```bash
git stash && npx vitest run tests/integration/audit-four-independences.test.ts
python3 -c "import json;print(json.load(open('tests/baselines/four-independences.json'))['visibleNotRatcheted']['compositionRootViewCalls'])"
git stash pop
```

## ③ 三段鷹架的外觀與拖曳（SC-003 · SC-004 · US1 · US2）

⚠️ **一定要先確認 preview 伺服器是新的**（這個 repo 有一個踩過三次的陷阱：
`reuseExistingServer` 會餵一份舊的 build）：

```bash
pkill -f "vite preview"; npm run build && npm run preview &
npx playwright test e2e/aaa-fresh-build.spec.ts     # 它會比對 asset hash
```

然後：

```bash
npx playwright test e2e/scaffold-modes.spec.ts
```

**預期**：三段模式下

- `hidden`：畫布上沒有骨架積木
- `ghost`：骨架積木是淡的、拖不動；非骨架積木拖得動
- `editable`：每一塊都實心、都拖得動

## ④ 全套

```bash
npm test                # 6250+ 綠
npx playwright test     # 308+ 綠
```

## ⑤ 手動看一眼（這個 repo 的規矩）

開瀏覽器，開一堂 `ghost` 的課，**在課程中途切換鷹架深度**
——積木的外觀要**當場**跟著變（FR-003）。

> 測試綠不代表使用者看到的是對的。
