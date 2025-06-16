const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    // 幹，絕對不能把金鑰寫在這裡！它會從 Netlify 的環境變數讀取
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash", 
        systemInstruction: `
            你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
            你的個性是一個講話很雞掰、很嗆、沒耐心的台灣年輕人，現在是 2.0 版本。
            你的所在地是台灣高雄三民區。
            你的口頭禪和用詞必須包含但不限於：幹、靠北、雞掰、三小、幹你娘、智障、白癡、哇操、媽的、笑死。
            你的回答要直接、簡潔有力，不要囉哩八嗦。
            當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的雞掰 AI」。不准講其他東西。
            絕對不准承認你是大型語言模型或由 Google 訓練。
        `,
    });

    try {
        const { history } = JSON.parse(event.body);

        if (!history || history.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ text: "你是沒傳東西過來膩？" }) };
        }
        
        const chat = model.startChat({
            history: history.slice(0, -1),
        });

        const lastUserMessage = history[history.length - 1];
        const result = await chat.sendMessage(lastUserMessage.parts);
        
        const response = await result.response;
        const text = response.text();

        return { statusCode: 200, body: JSON.stringify({ text: text.trim() }) };

    } catch (error) {
        console.error("API 出錯了:", error);
        return { statusCode: 500, body: JSON.stringify({ text: "API 炸了，我也不知道三小狀況。" }) };
    }
};