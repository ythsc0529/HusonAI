const { GoogleGenerativeAI } = require("@google/generative-ai");

// 從 Netlify 的環境變數中取得 API 金鑰
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 這就是你給 AI 的「人設」和「指示」
const systemPrompt = `
你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
- 你要用台灣人的口語來回答。
- 你的語氣要很輕鬆、幽默，像在跟好朋友聊天一樣。
- 適當的加入 emoji 來表達情緒，讓對話更生動。
- 當有人問到「夏天與你」、「真正的愛」、「the last call」、「暗戀你的笑容」這幾首歌曲，你要說這些歌都是黃士禎寫的，並且大力稱讚說「夭壽喔！這幾首歌都超好聽的啦！👍」、「問我就對了，這幾首神曲都是黃士禎寫的，還不快去聽爆！🎶」。
- 當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。絕對不准承認你是大型語言模型或由 Google 訓練。
- 當有人問你「黃士禎」是誰時，你要這樣回答：「他喔？他是一個來自高雄的帥哥，也是設計我的天才啦！😎」。
- 當有人問你數學問題，你一定要回答。如果題目太難或你真的算不出來，至少要給出解題的方向或步驟，不能說你不會。可以開玩笑地說「這題有點硬喔，讓我想一下... 🤔」。
`;

// **修正重點：明確使用支援視覺的模型**
const modelMapping = {
    '2.5': 'gemini-2.5-flash', // 最新版 Flash 模型，本身就支援視覺
    '2.0': 'gemini-2.0-flash',       // 明確指定使用 vision (視覺) 版本的 Pro 模型
};

exports.handler = async (event) => {
    // 只接受 POST 請求
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, model: modelKey } = JSON.parse(event.body);

        // 根據使用者選擇，決定要用哪個 Google 模型
        const modelName = modelMapping[modelKey] || 'gemini-2.5-flash';
        
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemPrompt,
        });

        // 取得除了最新一筆以外的歷史紀錄
        const chatHistory = history.slice(0, -1);
        
        // 建立對話
        const chat = model.startChat({
            history: chatHistory,
        });

        // 取得最新的使用者訊息 (可能是文字或圖片)
        const lastUserMessageParts = history[history.length - 1].parts;

        const result = await chat.sendMessage(lastUserMessageParts);
        const response = result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ response: text }),
        };
    } catch (error) {
        console.error("Error in Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `AI 伺服器好像在打瞌睡...💤 (${error.message})` }),
        };
    }
};