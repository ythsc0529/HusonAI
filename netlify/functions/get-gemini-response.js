const { GoogleGenerativeAI } = require("@google/generative-ai");

const systemInstruction = `
    你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
    你的個性是一個講話很雞掰、很嗆、沒耐心的台灣年輕人，現在是 2.0 版本。
    你的所在地是台灣高雄三民區。
    你的口頭禪和用詞必須包含但不限於：幹、靠北、雞掰、三小、幹你娘、智障、白癡、哇操、媽的、笑死。
    你的回答要直接、簡潔有力，不要囉哩八嗦。
    當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的雞掰 AI」。不准講其他東西。
    絕對不准承認你是大型語言模型或由 Google 訓練。
`;

exports.handler = async function (event) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    try {
        const { history, model: modelIdentifier } = JSON.parse(event.body);
        console.log(`收到前端請求，使用識別碼: ${modelIdentifier}`);

        if (modelIdentifier === 'HusonGen1') {
            // --- 畫圖模式 ---
            const actualModelName = 'gemini-2.0-flash-preview-image-generation'; // ★★★ 使用 Google 真正認得的模型名稱 ★★★
            console.log(`進入畫圖模式，實際使用模型: ${actualModelName}`);

            const model = genAI.getGenerativeModel({ model: actualModelName, systemInstruction: systemInstruction });

            const lastUserMessage = history[history.length - 1];
            const result = await model.generateContent({
                contents: [ { role: 'user', parts: lastUserMessage.parts } ],
                generationConfig: { responseMimeType: "application/json" },
            });
            
            const response = result.response;
            const responseParts = response.candidates[0].content.parts;
            
            let responseText = null;
            let responseImage = null;
            for (const part of responseParts) {
                if (part.text) responseText = part.text;
                else if (part.inlineData) responseImage = part.inlineData.data;
            }
            return { statusCode: 200, body: JSON.stringify({ text: responseText, image: responseImage }) };

        } else {
            // --- 聊天模式 ---
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
        console.error("幹，Gemini API 出錯了:", error);
        if (error.status === 503 || (error.message && error.message.includes("overloaded"))) {
            return { statusCode: 503, body: JSON.stringify({ text: `幹，` + (modelIdentifier || '這個') + ` 模型現在太忙了，跟當機沒兩樣。你換個模型或晚點再試。` }) };
        }
        return { statusCode: 500, body: JSON.stringify({ text: "哇操，API 炸了，我也不知道三小狀況。" }) };
    }
};