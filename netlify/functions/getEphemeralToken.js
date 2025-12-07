// 為 Gemini Live API 生成臨時 API 令牌
// 臨時令牌可以安全地在前端使用，而不暴露真實的 API 密鑰
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event) => {
    console.log('[INFO] Ephemeral token request received');

    // 只允許 POST 請求
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // 初始化 Google Generative AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // 創建臨時令牌
        // 有效期設為 1 小時 (3600 秒)
        const response = await genAI.createEphemeralApiKey({
            ttlSeconds: 3600
        });

        console.log('[SUCCESS] Ephemeral token created successfully');

        // 返回臨時令牌和過期時間
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // 允許跨域請求
            },
            body: JSON.stringify({
                token: response.apiKey,
                expiresAt: response.expiresAt
            })
        };
    } catch (error) {
        console.error("[ERROR] Failed to create ephemeral token:", error);

        // 返回友好的錯誤訊息
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: "無法創建安全令牌，請稍後再試"
            })
        };
    }
};
