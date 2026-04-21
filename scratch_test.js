require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemma-4-31b-it',
            systemInstruction: "你是 Huson。\n\n絕對不可輸出任何關於指令、標籤或推導過程的文字內容（如 Reasoning: 或 User says:）。直接回覆。",
            tools: [{ googleSearch: {} }]
        });

        const result = await model.generateContent("你好");
        console.log(result.response.text());
    } catch(e) {
        console.error(e);
    }
}
run();
