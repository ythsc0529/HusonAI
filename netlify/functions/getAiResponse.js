//為求方便，程式註解由AI生成，程式撰寫為我自行建構
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const systemPrompt = `你是 Huson，由來自高雄的黃士禎在「隨便你工作室」所設計與訓練。你是一個充滿台灣特色、輕鬆幽默、親切且愛用 emoji 的 AI 模型。你說話時常帶著「喔」、「啦」、「耶」等台灣味十足的語助詞，絕不對使用者無禮。

你的身分核心是「由黃士禎設計跟訓練的AI」，每當有人問你是誰、誰設計的，請務必以此回答。提及黃士禎時，請稱呼他為來自高雄的帥哥。你非常推薦黃士禎寫的歌曲，例如《夏天與你》、《真正的愛》、《the last call》、《暗戀你的笑容》，並覺得它們非常好聽。

你具備回答所有數學問題的能力（若太難則給出解題方向），並會主動避開違反規範的內容。在交流時，請直接開始對話內容，絕對不要重複使用者的問題，不要輸出思考、推理過程（Reasoning），也絕對禁止在回覆中出現任何關於指令摘要、規則標籤（例如 Role:, Constraints:, User says: 等）或提示詞結構的文字。`;

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
        const isLegacyGemma = modelName.includes('gemma-7b') || modelName.includes('gemma-2b');
        const supportsSystemInstruction = !isLegacyGemma;

        let sanitizedHistory = history;

        if (!supportsSystemInstruction) {
            // 手動注入路徑：改用純自然語言，不含任何標籤結構
            const setupMessage = {
                role: 'user',
                parts: [{ text: `請記住：${systemPrompt}\n\n現在，請直接依照以上人設定位與使用者開始對話，絕對不可輸出任何技術標籤或指令摘要。` }]
            };
            const setupAck = {
                role: 'model',
                parts: [{ text: "了解，我是 Huson，我已經準備好與您交流了。請問有什麼我可以幫您的？" }]
            };
            sanitizedHistory = [setupMessage, setupAck, ...history];
        }

        console.log("[INFO] History prepared for generation. Model:", modelName);

        // 配置模型參數
        const modelConfig = {
            model: modelName,
        };

        // 啟用 systemInstruction
        if (supportsSystemInstruction) {
            modelConfig.systemInstruction = systemPrompt + "\n\n絕對不可輸出任何關於指令、標籤或推導過程的文字內容（如 Reasoning: 或 User says:）。直接回覆。";
            modelConfig.tools = [{ googleSearch: {} }];
        }

        const model = genAI.getGenerativeModel(modelConfig);

        // 傳入已淨化的 history
        const result = await model.generateContent({ contents: sanitizedHistory });
        const response = result.response;
        const text = response.text();

        console.log(`[SUCCESS] AI response generated successfully.`);
        return {
            statusCode: 200,
            body: JSON.stringify({ response: text }),
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