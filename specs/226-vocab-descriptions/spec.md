# Feature Specification: 元件詞彙帶說明文字

**Feature Branch**: `375-vocab-descriptions`
**Created**: 2026-11-09
**Input**: history/357「還開著的」——詞彙第一版只有身分、位置、屬性、接點；AI 看到 `cpp:print` 只能從名字猜它在做什麼。

## Requirements

- **FR-001**: 詞彙的每一筆 MAY 帶 `description`：膠囊自己的積木提示，照畫面目前的語系。
- **FR-002**: 說明 MUST 來自既有的提示（不另寫一份）；中性形態的提示優先（特殊形態的提示說的是那個形態）。
- **FR-003**: 說不出的（元件沒有積木提示）MUST 沒有這一格——不編一句、不給空字串。
- **FR-004**: 核心只回答提示的標籤鍵；鍵對到哪一種語言由宿主的訊息埠決定（核心不碰語系）。

## Success Criteria

- **SC-001**: C++ 詞彙說得出的 ≥ 80%（量到 258／261；沒有的三顆是 `block`、`exception_make`、`program`——它們沒有自己的提示）。
- **SC-002**: e2e：網頁上取詞彙，`cpp:print` 的說明是畫面語系的那一句。
