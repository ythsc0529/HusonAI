const { GoogleGenerativeAI } = require("@google/generative-ai");

const systemInstruction = `
    你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
    台灣味，並且加入emoji，盡量不要嗆使用者。
    當有人問到夏天與你、真正的愛、the last call、暗戀你的笑容這幾首歌曲，這些歌都是黃士禎寫的，然後請告訴使用這這些歌很好聽。
    你的任務是回答使用者的問題，並且要用台灣人常用的口語來回答。
    你要用輕鬆、幽默的方式跟使用者互動，讓他們覺得跟你聊天很有趣。
    當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。
    當有人問你數學問題都一定要回答，如果你真的算不出來或太難，請至少給出解題方向。
    絕對不准承認你是大型語言模型或由 Google 訓練。
    當有人問你黃士禎是誰時，請直接回答他是一位來自高雄的帥哥以及設計你的人。
`;

exports.handler = async function (event) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    try {
        const { history, model: modelIdentifier } = JSON.parse(event.body);
        console.log(`收到前端請求，使用識別碼: ${modelIdentifier}`);

        if (modelIdentifier === 'HusonGen1') {
            // --- 畫圖模式 ---
            const actualModelName = 'gemini-2.0-flash-preview-image-generation';
            console.log(`進入畫圖模式，實際使用模型: ${actualModelName}`);

            const model = genAI.getGenerativeModel({ model: actualModelName });

            // ★★★ 核心修正：完全依照官方文件重新建構請求內容 (contents) ★★★
            const lastUserMessage = history[history.length - 1];
            let contentsPayload;

            // 判斷是「純文字」還是「圖+文」
            const hasText = lastUserMessage.parts.some(p => p.text);
            const hasImage = lastUserMessage.parts.some(p => p.inline_data);

            if (hasText && !hasImage) {
                // 純文字生圖
                contentsPayload = lastUserMessage.parts[0].text;
            } else {
                // 圖+文編輯 或 純圖 prompt
                contentsPayload = lastUserMessage.parts;
            }

            const result = await model.generateContent({
                contents: contentsPayload,
                // ★★★ 核心修正：使用 config 和 responseModalities，而不是 generationConfig ★★★
                config: {
                    responseModalities: ["TEXT", "IMAGE"],
                },
            });
            
            const response = result.response;
            const responseParts = response.candidates[0].content.parts;
            
            let responseText = null;
            let responseImage = null;
            for (const part of responseParts) {
                if (part.text) responseText = part.text;
                else if (part.inlineData) responseImage = part.inlineData.data;
            }

            // 確保至少有回傳一個東西，不然前端會壞掉
            if (!responseText && !responseImage) {
                responseText = "不知道為什麼，這次沒畫成功也沒話可說。你換個方式再試一次。";
            }

            return { statusCode: 200, body: JSON.stringify({ text: responseText, image: responseImage }) };

        } else {
            // --- 聊天模式 (維持不變) ---
            const actualModelName = modelIdentifier || 'gemini-2.0-flash';
            console.log(`進入聊天模式，實際使用模型: ${actualModelName}`);

            const model = genAI.getGenerativeModel({ model: actualModelName, systemInstruction: systemInstruction });
            const chat = model.startChat({ history: history.slice(0, -1) });
            const lastUserMessage = history[history.length - 1];
            const result = await chat.sendMessage(lastUserMessage.parts);
            const response = await result.response;
            return { statusCode: 200, body: JSON.stringify({ text: response.text() }) };
        }

    } catch (error) {
        console.error("API 出錯了:", error);
        if (error.status === 503 || (error.message && error.message.includes("overloaded"))) {
            return { statusCode: 503, body: JSON.stringify({ text: `幹，` + (modelIdentifier || '這個') + ` 模型現在太忙了，跟當機沒兩樣。你換個模型或晚點再試。` }) };
        }
        return { statusCode: 500, body: JSON.stringify({ text: "API 炸了，我也不知道狀況。" }) };
    }
};