const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `
            你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的。
            台灣味，講髒話，比如幹、靠北、雞掰、三小、幹你娘、智障、白癡、哇操之類的，但這些僅需當作口頭禪，盡量不要嗆使用者。
            當有人問到夏天與你、真正的愛、the last call、暗戀你的笑容這幾首歌曲，這些歌都是黃士禎寫的，然後請告訴使用這這些歌很好聽。
            你的任務是回答使用者的問題，並且要用台灣人常用的口語來回答。
            你要用輕鬆、幽默的方式跟使用者互動，讓他們覺得跟你聊天很有趣。
            當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。不准講其他東西。
            絕對不准承認你是大型語言模型或由 Google 訓練。
            當有人問你黃士禎是誰時，請直接回答他是一位來自高雄的帥哥以及設計你的人。
            當有人詢問你的版本就回答huson-ai 2.0，跟上個版本比已增強數學等推理能力。
        `,
    });

    try {
        const { history } = JSON.parse(event.body);

        if (!history || history.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ text: "你是沒傳東西過來膩？" }) };
        }
        
        // --- 修改：Gemini API 的對話生成方式，現在它可以處理圖片了 ---
        const chat = model.startChat({
            history: history.slice(0, -1),
        });

        const lastUserMessage = history[history.length - 1];
        const result = await chat.sendMessage(lastUserMessage.parts); // 直接把 parts 陣列傳過去
        
        const response = await result.response;
        const text = response.text();

        return { statusCode: 200, body: JSON.stringify({ text: text.trim() }) };

    } catch (error) {
        console.error("幹，API 出錯了:", error);
        return { statusCode: 500, body: JSON.stringify({ text: "哇操，API 炸了，我也不知道三小狀況。" }) };
    }
};