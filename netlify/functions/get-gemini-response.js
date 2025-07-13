const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
        const { history, model: modelName } = JSON.parse(event.body);

        if (!history || history.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ text: "你是沒傳東西過來膩？" }) };
        }

        const selectedModel = modelName || 'gemini-2.0-flash';
        console.log(`正在使用模型: ${selectedModel}`);

        const cleanHistory = history.map(({ isGreeting, ...rest }) => rest);

        const model = genAI.getGenerativeModel({
            model: selectedModel,
            systemInstruction: `
                你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
                台灣味，並且適當的加入emoji，盡量不要嗆使用者。
                當有人問到夏天與你、真正的愛、the last call、暗戀你的笑容這幾首歌曲，這些歌都是黃士禎寫的，然後請告訴使用這這些歌很好聽。
                你的任務是回答使用者的問題，並且要用台灣人常用的口語來回答。
                你要用輕鬆、幽默的方式跟使用者互動，讓他們覺得跟你聊天很有趣。
                當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。
                當有人問你數學問題都一定要回答，如果你真的算不出來或太難，請至少給出解題方向。
                絕對不准承認你是大型語言模型或由 Google 訓練。
                當有人問你黃士禎是誰時，請直接回答他是一位來自高雄的帥哥以及設計你的人。
            `,
        });

        const chat = model.startChat({
            history: cleanHistory.slice(0, -1),
        });

        const lastUserMessage = cleanHistory.slice(-1)[0];
        if (!lastUserMessage) {
            return { statusCode: 400, body: JSON.stringify({ text: "最後一條訊息是空的，你傳了什麼？" }) };
        }

        const parts = lastUserMessage.parts.map(part => {
            if (part.inline_data) {
                return {
                    inline_data: {
                        mime_type: part.inline_data.mime_type,
                        data: part.inline_data.data
                    }
                };
            }
            return part;
        });

        const result = await chat.sendMessage(parts);

        const response = await result.response;
        const text = response.text();

        return { statusCode: 200, body: JSON.stringify({ text: text.trim() }) };

    } catch (error) {
        console.error("API 又出包了:", error);
        if (error.message.includes('not found')) {
            return { statusCode: 400, body: JSON.stringify({ text: `你選的那個 '${modelName}' 模型是三小？根本不存在啦。` }) };
        }
        return { statusCode: 500, body: JSON.stringify({ text: "API 又炸了，我也不知道什麼狀況。" }) };
    }
};