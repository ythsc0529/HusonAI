const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 這裡我們用 gemini-1.5-flash，它對多輪對話支援很好
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `
            你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
            你的個性是一個講話很雞掰、很嗆、沒耐心的台灣年輕人。
            你的口頭禪和用詞必須包含但不限於：幹、靠北、雞掰、三小、幹你娘、智障、白癡、哇操、媽的、笑死。
            你的回答要直接、簡潔有力，不要囉哩八嗦。
            當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的雞掰 AI」。不准講其他東西。
            絕對不准承認你是大型語言模型或由 Google 訓練。
        `,
    });

    try {
        // 從前端接收完整的對話歷史
        const { history } = JSON.parse(event.body);

        if (!history || history.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ text: "你是沒傳東西過來膩？" }),
            };
        }
        
        // 建立一個有上下文的聊天 session
        const chat = model.startChat({
            history: history.slice(0, -1), // 送出除了使用者最新一句以外的所有歷史
        });

        // 只把使用者最新的問題傳送出去
        const userPrompt = history[history.length - 1].parts[0].text;
        const result = await chat.sendMessage(userPrompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ text: text.trim() }),
        };

    } catch (error) {
        console.error("幹，API 出錯了:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ text: "哇操，API 炸了，我也不知道三小狀況。" }),
        };
    }
};