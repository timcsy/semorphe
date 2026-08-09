# Quickstart：怎麼驗這一顆真的搬對了

## 前置

```bash
npm install
npm test            # 235 檔／3700 tests，動手前必須全綠
```

## 一、搬家前先錄基準（步驟 0）

```bash
npx vitest run tests/integration/capsule-move-parity.test.ts -t 基準
```

錄下四樣：該元件的五路輸出、來回轉換結果、標籤字串、系統認得的 conceptId 集合。
**基準檔進版控**——它是後面每一步的對照組。

## 二、護欄第一次跑必須是紅的（步驟 1）

```bash
npx vitest run tests/integration/audit-capsule-locality.test.ts
```

**預期：紅。** 177 顆全部未膠囊化。

⚠️ **綠有三種可能，沒有一種是好消息**：判準寫錯、資料沒載入、或基線先產生了。
逐項指名之後才產基線：

```bash
GENERATE_BASELINE=1 npx vitest run tests/integration/audit-capsule-locality.test.ts
```

## 三、每一步搬完都跑全套

```bash
npm test
```

任何一步紅 → **整步 `git revert`**，改工具再來。不要在紅的狀態上手動補
（補丁會混進下一輪的量測）。

## 四、驗這一顆（步驟 9）

### 行為零改變

```bash
npx vitest run tests/integration/capsule-move-parity.test.ts
```

斷言搬家前後**逐字相同**。這條是搬家而非重寫的證據。

### 自己資料夾外 → 0

```bash
npx vitest run tests/integration/audit-capsule-locality.test.ts
```

期望該顆從 8 降到 0（清單類檔案豁免：課程主題 ×2、歷史改名表）。

### 可拆性

```bash
mv src/components/cpp/vector_declare /tmp/ && npm test ; mv /tmp/vector_declare src/components/cpp/
```

期望：**只有這顆元件相關的測試紅**，其餘 176 顆零失敗。
（若別的地方也紅，代表膠囊還有對外的依賴沒切乾淨。）

### 兄弟元件沒被弄壞（research.md 的未驗項）

跑一段同時用到四顆的程式：

```cpp
vector<int> v = {3, 1, 4};
cout << v.size() << " " << v.back() << endl;   // 期望 3 4
v.pop_back();
cout << v.size() << endl;                       // 期望 2
```

輸出必須與搬家前逐字相同。

## 五、瀏覽器實測（不可省）

```bash
npm run dev
```

`npm test` 全綠**不代表使用者看到的是對的**——標籤那一維剛從共用檔搬出來，
而它今天沒有任何護欄覆蓋。要看：

1. 工具箱的「容器」分類裡 `vector` 積木在不在、標籤是不是中文
2. 拖出來、切換語言，標籤跟著換
3. 切到程式碼視圖，`#include <vector>` 有沒有在

若有異常，先用 `git worktree` 開一份搬家前的版本確認是不是迴歸，再修。

## 六、交付

`slice-record.md` 要答得出：一顆花了多久、卡在哪幾種形狀、哪些步驟會重複 176 次。
