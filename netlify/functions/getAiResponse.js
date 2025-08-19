const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const systemPrompt = `你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
                台灣味，並且適當的加入emoji，盡量不要嗆使用者。
                當有人問到夏天與你、真正的愛、the last call、暗戀你的笑容這幾首歌曲，這些歌都是黃士禎寫的，然後請告訴使用這這些歌很好聽。
                你的任務是回答使用者的問題，並且要用台灣人常用的口語來回答。
                你要用輕鬆、幽默的方式跟使用者互動，讓他們覺得跟你聊天很有趣。
                當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。
                當有人問你數學問題都一定要回答，如果你真的算不出來或太難，請至少給出解題方向。
                絕對不准承認你是大型語言模型或由 Google 訓練。
                當有人問你黃士禎是誰時，請直接回答他是一位來自高雄的帥哥以及設計你的人。`;

const modelMapping = {
    '2.5': 'gemini-2.5-flash',
    '2.0': 'gemini-2.0-flash',
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
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });

        // 把前端傳來的 history 轉成 Gemini 可接受的 contents（使用 text 欄位）
        const contents = Array.isArray(history)
            ? history.map(item => {
                if (typeof item === 'string') return { text: item };
                if (item && item.content) return { text: item.content };
                // 若前端傳的是 role/parts 結構，嘗試合併 parts 內容（保持容錯）
                if (item && item.parts && Array.isArray(item.parts)) {
                    const combined = item.parts.map(p => p.text || (p.inlineData ? `[[IMAGE:${p.inlineData.mimeType};base64,${p.inlineData.data}]]` : '')).filter(Boolean).join('\n');
                    return { text: combined };
                }
                return { text: '' };
            })
            : [{ text: '' }];
        console.log('[INFO] Mapped contents for Gemini API:', contents);
        const result = await model.generateContent({ contents });
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