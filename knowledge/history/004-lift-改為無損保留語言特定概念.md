# 004：從「lift 直接壓扁成通用概念」到「Lossless Lift + 可選正規化」

> 日期：2026-03-09

## 轉移

- **舊**：lift 時直接把語言特定寫法壓扁成通用概念。`extractPrintf()` 回傳 `print { values: [x] }`。
- **新**：lift 優先產出**語言特定概念**（`cpp_printf { format, args }`），正規化交給 style exception 系統在下游**可選**執行。

```
Code → lift → cpp_printf { format: "%.2f\n", args: [x] }   ← 無損
                ↓ style exception（可選）
             print { values: [x] }                          ← 有損但使用者明確選擇
```

## 為什麼變

`printf("%.2f\n", x)` 經過壓扁後，format string 消失了。後果：

- round-trip 壞掉：`printf("%.2f\n", x)` → blocks → `cout << x`
- 使用者在借音場景明確按下「保留」，格式資訊**仍然**丟失——因為資訊在 lift 階段就已經沒了，下游再怎麼選都救不回來

根本問題是**把「正規化」這個政策決定放進了「辨識」這個機械步驟裡**。辨識階段應該盡可能保留它看到的東西；要不要統一成通用寫法是使用者的選擇，屬於 style 層。

判斷準則因此確立：

- 有結構化資訊（format string、特殊語法）→ lift 為語言特定概念
- 天然映射且無資訊丟失（`cout << x` → `print`）→ 直接 lift 為通用概念
- Style exception 系統 = **正規化提議器**（「保留」= no-op，「統一」= normalize）

## 狀態

✅ 已採用（commit `fa67b37`，同批引入 style exceptions 模組）。這條原則後來擴展為 [開放擴充](../concepts/開放擴充.md) 的 Lossless Lift 段落。
