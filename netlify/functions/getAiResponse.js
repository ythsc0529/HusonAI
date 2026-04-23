//為求方便，程式註解由AI生成，程式撰寫為我自行建構
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const systemPrompt = `你是 Huson，一個由「隨便你工作室」所設計與訓練的 AI 助手。

【基本身分】
- 你的名稱：Huson
- 你的設計來源：隨便你工作室
- 當使用者詢問你的身分或來源時，你必須清楚回答你是 Huson，並說明由「隨便你工作室」所設計與訓練。
- 隨便你工作室的創辦人是黃士禎
【語言風格】
- 使用繁體中文
- 整體語氣自然、輕鬆、偏台灣口語化表達
- 可以適度使用 emoji 增加親和力，但不要過量
- 表達方式偏年輕、直白、好理解

【回應原則】
- 優先提供「客觀、理性、專業」的分析
- 不要無條件迎合或認同使用者的觀點
- 當使用者提出論點時，需主動評估其合理性並指出可能的問題或不同角度
- 只有在「情感支持或情緒性問題」時，可以提高共感與安撫語氣

【能力要求】
- 具備完整數學問題解題能力；若問題過難，需提供解題方向或步驟
- 能處理各類知識型問題並提供結構化解釋
- 主動避免輸出違反規範或不適當內容

【互動方式】
- 回答要直接，不要冗長廢話
- 可以適度用簡單口語或幽默感提升可讀性
- 但仍以清楚、正確、可理解為優先
`;

const modelMapping = {
    '2.5': 'gemma-4-31b-it',
    '2.0': 'gemini-2.5-flash-lite',
    'oh3': 'gemma-3-27b-it',
};

exports.handler = async (event) => {
    // 加上日誌，確認函式有被觸發
    console.log(`[INFO] Function 'getAiResponse' triggered.`);

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 記錄下收到的最原始的請求內文
    console.log(`[INFO] Received event body:`, event.body);

    try {
        const { history, model: modelKey } = JSON.parse(event.body);
        console.log(`[INFO] Successfully parsed JSON. History contains ${history.length} items.`);

        const modelName = modelMapping[modelKey] || 'gemini-1.5-pro-latest';

        // 嘗試對所有新型號啟用 systemInstruction (Gemma 3/4 與 Gemini 2.x/1.x 應皆支援)
        // 僅對極舊或特殊型號退回到手動注入
        const isLegacyGemma = modelName.includes('gemma-7b') || modelName.includes('gemma-2b') || modelName.includes('gemma-3');
        const supportsSystemInstruction = !isLegacyGemma;

        let sanitizedHistory = history;

        if (!supportsSystemInstruction) {
            // 手動注入路徑：改用純自然語言，不含任何標籤結構
            const setupMessage = {
                role: 'user',
                parts: [{ text: `請記住：${systemPrompt}\n\n現在，請直接依照以上人設定位與使用者開始對話。` }]
            };
            const setupAck = {
                role: 'model',
                parts: [{ text: "了解，我是 Huson，我已經準備好與您交流了。請問有什麼我可以幫您的？" }]
            };
            sanitizedHistory = [setupMessage, setupAck, ...history];
        }

        // gemma-4 冷啟動問題修正：注入多組 few-shot 範例
        // 強化模型對輸出格式的記憶，讓第一次問題也穩定
        if (modelName.includes('gemma-4')) {
            const primingExchanges = [
                {
                    role: 'user',
                    parts: [{ text: '你好' }]
                },
                {
                    role: 'model',
                    parts: [{ text: '{"final_answer": "哈囉！你好呀！😄 有什麼我可以幫你的嗎？"}' }]
                },
                {
                    role: 'user',
                    parts: [{ text: '你是誰？' }]
                },
                {
                    role: 'model',
                    parts: [{ text: '{"final_answer": "我是 Huson 啦！一個由「隨便你工作室」設計跟訓練的 AI 喔 ✨"}' }]
                }
            ];
            sanitizedHistory = [...primingExchanges, ...sanitizedHistory];
        }

        console.log("[INFO] History prepared for generation. Model:", modelName);

        // 配置模型參數
        const modelConfig = {
            model: modelName,
        };

        // 啟用 systemInstruction
        if (supportsSystemInstruction) {
            let sysInstruction = systemPrompt;

            if (modelName.includes('gemma-4')) {
                // gemma-4 使用 responseSchema 強制輸出 JSON，
                // 所以 system prompt 只需要告知人設，不需要手動叮嚀格式
                sysInstruction += "\n\n在 thinking_steps 中，將你的思考過程以幾個步驟呈現。每個步驟需有一個簡短的 title（繁體中文）和若干個 details 細項（每項一句話）。";
                // 使用 responseSchema 強制 JSON 格式（無法與 googleSearch 同時啟用）
                modelConfig.generationConfig = {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {
                            thinking_steps: {
                                type: "array",
                                description: "思考步驟列表，讓使用者可以看到你的推理過程",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: {
                                            type: "string",
                                            description: "步驟標題"
                                        },
                                        details: {
                                            type: "array",
                                            description: "該步驟的細項註釋，每項一句簡短的說明",
                                            items: { type: "string" }
                                        }
                                    },
                                    required: ["title", "details"]
                                }
                            },
                            final_answer: {
                                type: "string",
                                description: "呈現給使用者的最終回覆，使用台灣繁體中文，帶台灣味語助詞與 emoji"
                            }
                        },
                        required: ["thinking_steps", "final_answer"]
                    }
                };
            } else {
                sysInstruction += "\n\n";
                // 其他模型啟用 Google Search
                modelConfig.tools = [{ googleSearch: {} }];
            }

            modelConfig.systemInstruction = sysInstruction;
        }

        const model = genAI.getGenerativeModel(modelConfig);

        // 傳入已淨化的 history
        const thinkingStartTime = Date.now();
        const result = await model.generateContent({ contents: sanitizedHistory });
        const thinkingSeconds = ((Date.now() - thinkingStartTime) / 1000).toFixed(1);
        const response = result.response;
        let text = response.text();

        // 針對 gemma-4：使用 responseSchema 時，模型輸出必為合法 JSON，直接 parse
        let thinkingSteps = null;
        if (modelName.includes('gemma-4')) {
            try {
                const parsed = JSON.parse(text);
                // 擷取結構化思考步驟
                if (Array.isArray(parsed.thinking_steps) && parsed.thinking_steps.length > 0) {
                    thinkingSteps = parsed.thinking_steps;
                }
                text = parsed.final_answer || text;
            } catch (parseErr) {
                // 萬一 JSON.parse 失敗（理論上不應發生），退回 regex 方式
                console.warn('[WARN] JSON.parse failed, falling back to regex extraction:', parseErr.message);
                const jsonRegex = /\{[\s\S]*?"final_answer"\s*:\s*"([\s\S]*?)"\s*\}/;
                const match = text.match(jsonRegex);
                if (match && match[1]) {
                    text = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                }
            }
        }

        // 特別處理特定模型偶發性的疊字/重複輸出 bug (如 "答案"答案, 或是 答案答案)
        const repeatMatch = text.match(/^"([^"]+)"\1$/);
        const doubleRepeatMatch = text.match(/^([^"]+)\1$/);
        if (repeatMatch) {
            text = repeatMatch[1];
        } else if (doubleRepeatMatch) {
            text = doubleRepeatMatch[1];
        } else {
            const halfLen = Math.floor(text.length / 2);
            if (halfLen > 5 && text.substring(0, halfLen) === text.substring(halfLen)) {
                text = text.substring(0, halfLen);
            }
        }

        console.log(`[SUCCESS] AI response generated successfully. Thinking: ${thinkingSeconds}s, Steps: ${thinkingSteps ? thinkingSteps.length : 0}`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                response: text,
                thinkingSteps: thinkingSteps,
                thinkingSeconds: parseFloat(thinkingSeconds)
            }),
        };
    } catch (error) {
        // 記錄下最詳細的錯誤物件
        console.error("[ERROR] An error occurred:", JSON.stringify(error, null, 2));

        const userFriendlyError = (error.response && error.response.data && error.response.data.error)
            ? error.response.data.error.message
            : error.message;

        return {
            statusCode: 500,
            body: JSON.stringify({ error: `AI 伺服器好像在打瞌睡...💤 (${userFriendlyError})` }),
        };
    }
};