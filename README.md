# HusonAI 3.0

這是我最近在開發的一個AI整合實驗專案，主要是想把Gemini的各種能力（包括最新的Live API）整合進一個乾淨、好用的Web介面，原本只是想做個自用的工具，後來越寫越順手就把它包裝成了現在這個樣子。

**體驗網址：[https://huson-ai.netlify.app](https://huson-ai.netlify.app)**

---

## 為什麼要做這個？

現在市面上的AI介面雖然多，但有時候我們需要的功能散落在各處，而且沒有一款能較為理解台灣人以及講話風格像台灣人的AI，我想做一個能同時處理「深度邏輯推理」、「極速日常對答」以及「語音即時連線」的平台。

## 核心模型 (The Lineup)

目前專案裡整合了幾款不同性質的模型，可以根據需求切換：

*   **Huson 3.0 Pro**：最強大的模型。我給它加了「思維鏈 (Chain of Thought)」推理邏輯，適合拿來解Bug、寫程式或者處理需要燒腦的複雜問題。
*   **Huson 3.0 Mini**：反應最快的一款。如果你只是想問個天氣、翻譯一下文字，選這個就對了，反應幾乎是秒回。
*   **OH3 (Gemma 3)**：輕量化備援方案。要是遇到主要模型掛掉時，這台「備用機」可以頂著用。
*   **LH1 (Huson Live)**：這個是我最花心思的部分。它是基於Gemini Live API做的，支援**國語與台語**的即時語音對話。對，它真的會講台語。

## 技術亮點

這不是一個簡單的API轉發站，我在裡面塞了一些我覺得很好用的功能：

*   **視覺處理**：支援直接貼圖或上傳圖片，前端會自動做圖片壓縮（`browser-image-compression`），確保不會因為圖片太大導致 API 報錯或傳輸太久。
*   **數學公式渲染**：整合了KaTeX，不管是微積分還是統計公式都能漂亮地顯示出來。
*   **語音輸入/輸出**：除了Live模式，普通的文字對話也支援語音輸入。
*   **後端架構**：跑在Netlify Functions上，用Serverless的方式去接Google Generative AI SDK，安全性相對比較高（API Key 不會流到前端）。

## 如何在本地跑起來？

如果你想拿這套程式碼自己改，大概步驟如下：

1.  **複製專案**：
    ```bash
    git clone https://github.com/ythsc0529/HusonAI.git
    cd HusonAI
    ```

2.  **安裝依賴**：
    ```bash
    npm install
    ```

3.  **環境變數設定**：
    在根目錄建一個 `.env` 檔案，或者是直接在 Netlify 的環境變數裡設定：
    *   `GEMINI_API_KEY`: 你的 Google AI Studio API Key。

4.  **啟動開發伺服器**：
    我這裡用了 Netlify CLI 來模擬生產環境：
    ```bash
    netlify dev
    ```

## 關於作者

這個專案由 **隨便你工作室 (Whatever Studio)** 開發。
我們喜歡做一些有趣、好玩的實驗性產品。如果你有任何建議或發現了什麼Bug，歡迎隨時聯絡。
**工作室網址：[https://uptoyouweb.netlify.app](https://uptoyouweb.netlify.app)**
---

*Peace out. ✌️*
