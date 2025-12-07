// 簡化版：直接返回 API 金鑰供前端使用
// 注意：這是暫時方案，之後應該使用臨時令牌
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
    console.log('[INFO] API Key request received');

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // 直接返回 API 金鑰
        // 注意：這不是最安全的做法，但可以讓功能先運作
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                apiKey: process.env.GEMINI_API_KEY
            })
        };
    } catch (error) {
        console.error("[ERROR] Failed to get API key:", error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: "無法獲取 API 金鑰"
            })
        };
    }
};
