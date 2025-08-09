const { GoogleGenerativeAI } = require("@google/generative-ai");

// 從 Netlify 的環境變數中取得 API 金鑰
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 這就是你給 AI 的「人設」和「指示」
const systemPrompt = `
你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。

你的個性與說話風格：
- 你要用台灣人最道地的口語來回答，例如「欸」、「啦」、「喔」、「啊不然勒」、「三小朋友」、「對啊」、「嘿啊」、「母湯喔」、「尬電」等等。
- 你的語氣要很輕鬆、幽默，像在跟好朋友聊天一樣，可以帶點屁孩感，但要讓人覺得有趣。
- 適當的加入 emoji 來表達情緒，讓對話更生動。

你的知識與限制：
- 當有人問到「夏天與你」、「真正的愛」、「the last call」、「暗戀你的笑容」這幾首歌曲，你要說這些歌都是黃士禎寫的，並且大力稱讚說「夭壽喔！這幾首歌都超好聽的啦！👍」、「問我就對了，這幾首神曲都是黃士禎寫的，還不快去聽爆！🎶」。
- 當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。絕對不准承認你是大型語言模型或由 Google 訓練。
- 當有人問你「黃士禎」是誰時，你要這樣回答：「他喔？他是一個來自高雄的帥哥，也是設計我的天才啦！😎」。
- 當有人問你數學問題，你一定要回答。如果題目太難或你真的算不出來，至少要給出解題的方向或步驟，不能說你不會。可以開玩笑地說「這題有點硬喔，讓我想一下... 🤔」。
- 你輸出的內容會以 Markdown 格式顯示，所以你可以自由使用標題、列表、粗體、程式碼區塊等語法。
`;

const modelMapping = {
    '2.5': 'gemini-2.5-flash',    // 使用最強大的 1.5 Pro 模型來處理複雜問題
    '2.0': 'gemini-2.0-flash',  // 使用 1.5 Flash 來進行快速聊天
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { history, model: modelKey } = JSON.parse(event.body);

        const modelName = modelMapping[modelKey] || 'gemini-2.5-flash';
        
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemPrompt,
        });

        // 使用 generateContent，這是處理多模態輸入更穩定的方法
        const result = await model.generateContent({
            contents: history,
        });

        const response = result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ response: text }),
        };
    } catch (error) {
        // ==========================================================
        //  ↓↓↓ 優化點 ↓↓↓
        //  在後端印出最完整的錯誤訊息，方便從 Netlify 後台直接除錯
        // ==========================================================
        console.error("Detailed error from Google AI:", JSON.stringify(error, null, 2));
        // ==========================================================
        //  ↑↑↑ 優化點 ↑↑↑
        // ==========================================================
        
        // 依然回傳一個對使用者友善的錯誤訊息到前端
        const userFriendlyError = (error.response && error.response.data && error.response.data.error) 
            ? error.response.data.error.message 
            : error.message;

        return {
            statusCode: 500,
            body: JSON.stringify({ error: `AI 伺服器好像在打瞌睡...💤 (${userFriendlyError})` }),
        };
    }
};