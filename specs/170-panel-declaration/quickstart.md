# Quickstart：怎麼驗這一刀真的成立

## 一、SC-001 —— 加一種投影，改 0 個既有檔

```bash
npx vitest run tests/integration/panel-declaration-open.test.ts
```

那支測試在**自己的檔案裡**合成一份 `probe` 面板宣告推進登錄表，然後問：

```
版面清單認得它嗎        hostLayoutOptions 的格子裡有它那一層
槽的選項有它嗎          buildSlotPicker 的選項含它
它畫得出來嗎            mount 被呼叫，容器裡有它的內容
```

🔴 **而「沒改既有檔」怎麼證明**：那支測試**只 import 登錄表與組裝點**。
它能跑起來本身就是證明——⚠️ 如果它需要 import `app-shell` 才跑得動，
那就代表耦合還在。

## 二、SC-002／SC-003 —— 手寫分支與產生器歸零

```bash
npx vitest run tests/integration/audit-panel-declaration.test.ts
```

護欄數兩件事（都在 `src/ui/app-shell.ts` 上）：

```
「四個一起列出來」的結構    今天 5  →  0
四條頭的產生器              今天 5  →  1
四條頭的樣式定義            今天 1  →  維持 1（不得回退）
```

⚠️ 它要**先能紅**：把其中一段改回手寫，護欄必須出聲。

## 三、SC-004 —— 既有行為逐字相同

```bash
npm test          # 6084 綠（2026-09-01 的基準）
npm run test:e2e  # 239 綠
```

🔴 **一條 e2e 都不准改**。要改的話，那就不是重構，是行為改變。

## 四、SC-005 —— 耦合真的斷了

拿掉一份宣告（例如把 `src/panels/flow/panel.ts` 暫時改名），然後：

```bash
npm test
```

**只有流程自己的測試會紅**。其他投影的測試、版面的測試、宿主的測試
**都不受牽連**——那才叫「一份宣告」。

## 五、兩個宿主都要看

```bash
npm run build:vscode && node tools/vscode-preflight/run.mjs
```

三種視窗各一格、把手 0、版面四張、主控台視窗兩個分頁——與今天逐字相同。
