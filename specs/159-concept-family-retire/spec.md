# spec 159：`concept` 家族整族退場

**路線圖位置**：spec 158 的續作。158 把**身分鍵**改完了，這一輪是**周邊命名**。
**skill**：`component-rename`（大規模改名）＋ `build-guardrail`

## 為什麼有這一刀

spec 158 之後我回報「大改名完成」。**那句話是錯的。** 2026-08-20 的知識庫審查翻出：

```
🟢 SemanticNode.componentId          改對了（身分鍵是真的換了）
🔴 3496 處 concept 家族識別字         散在 656 個檔
🔴 12 個檔名                          src/core/component/method-concepts.ts ← 資料夾改了檔名沒改
🔴 2 個混血命名                       componentConcepts、componentConceptMappings
🔴 護欄一個都擋不住                    它只認 \bconceptId\b，連 byConceptId 都漏（大寫 C 讓 \b 不成立）
```

> **一條擋「四個名字」的規則，擋不住一個【家族】。**

## 護欄（已蓋，動手前就是紅的）

`tests/integration/component-vocabulary.test.ts` ── **硬性零，不是棘輪**
（改名是「修法便宜」的那一類，見 build-guardrail 6.8）

| 檢查 | 動手前 |
|---|---|
| `concept` 家族處數 | 🔴 **3496**（656 檔） |
| 檔名帶 concept | 🔴 **12** |
| 豁免（基線目錄以外） | 🟢 4，逐一具名 |
| SavedState 有無 concept 欄位 | 🟢 **無** |

## 🟢 本輪【不需要】存檔遷移——而這是量出來的，不是假設的

skill 步驟 5 說「一次改名 = 一次存檔版本 ＋ 凍結明表」。**那條針對的是身分／參數改名**，
而本輪動的是**符號名**。證據：

```
src/core/storage-version.ts:35  SAVED_STATE_FIELDS = { version, tree, blocklyState, code,
                                language, styleId, topicId, targetId, enabledBranches,
                                lastModified, blockStyleId, locale }   ← 零個 concept 欄位
src/core/storage.ts                                                    ← 零處 concept
```

⚠️ 而這條**寫成護欄斷言**（`★ 存檔格式不受本輪影響`），不是口頭聲明——
若哪天存檔欄位長出 concept，這一刀的前提就失效，護欄會說話。

## 具名豁免（每一條都要說得出理由）

| 路徑 | 為什麼 |
|---|---|
| 護欄自己 | 要寫得出舊名才擋得住舊名 |
| `tests/baselines/` | 量測工具不得量到自己（基線會數到護欄的規則文字） |
| `src/migrations/**`、`src/languages/*/id-migrations.ts` | **凍結明表——鍵是【過去】的身分**，改掉等於真實使用者的舊存檔升不上來 |
| `knowledge/concepts/` 這個字串 | 知識庫資料夾，人拍板不改名（`concepts/元件.md`） |

## 分段（skill 開頭那一問：紅了指得出是哪一段嗎）

| 段 | 內容 | 量 | 驗收 |
|---|---|---|---|
| ① | **JSON 鍵**（允許清單）＋ 讀它們的程式碼**同步** | 99 | 全綠 |
| ② | **檔名**（12）＋ import 路徑 | 12 | tsc + 全綠 |
| ③ | `src/` 的**匯出符號** | 39 | tsc + 全綠 |
| ④ | `src/` 其餘（區域變數／參數／英文註解） | ~800 | tsc + 全綠 |
| ⑤ | `tests/` ＋ `e2e/` | ~2500 | 全綠 |
| ⑥ | 棘輪收**硬性零** | — | 護欄轉綠 |

🔴 **紅了整段 `git checkout` 還原，不在紅的狀態上疊改動**（skill 步驟 4）。

## skill 步驟 6：改名前先掃「拿名字的形狀做判斷」

已知這是**靜默災難**（發生過三次，兩次在同一輪）。動手前列清單，改完逐筆看過。

## 明確排除

- `knowledge/` 的中文「概念」——2026-08-20 已逐行審過（194 → 54），**本輪不再動**
- `specs/` ——病歷
- 任何**功能**改動。這一刀只改名字

## 驗收

- [x] 護欄的三個數字：3496 → **0**、12 → **0**、豁免具名（基線目錄外 4 條 ＋ 兩種引用路徑）
- [x] 4762 支全綠、tsc 乾淨
- [x] 「名字形狀判斷」清單逐筆看過（`file-classification.ts` 真的炸了，而它是**紅的**）
- [x] 護欄基線**數字零變動**、中立性維持 0/33/0
- [x] e2e **37 全過**

## 結果

匯出符號 39 → 0、檔名 14 → 0、混血命名 2 → 0。四針注射：舊複合詞與裸 concept 都真的紅，
兩種引用路徑維持綠（豁免生效，而注射①證明同一個檔照樣掃得到）。

轉變記在 [history/110](../../knowledge/history/110-concept家族整族退場.md)。
