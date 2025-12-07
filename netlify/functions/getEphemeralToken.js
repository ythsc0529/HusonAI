// 為 Gemini Live API 生成臨時 API 令牌
// 臨時令牌可以安全地在前端使用，而不暴露真實的 API 密鑰
const { GoogleGenAI } = require("@google/genai");

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
        // 初始化 Google GenAI 客戶端
        const client = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });

        // 設定過期時間（30 分鐘）
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // 創建臨時令牌
        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 100,  // 允許使用次數
                expireTime: expireTime,
                liveConnectConstraints: {
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    config: {
                        temperature: 0.7,
                        responseModalities: ['AUDIO']
                    }
                },
                httpOptions: {
                    apiVersion: 'v1alpha'
                }
            }
        });

        console.log('[SUCCESS] Ephemeral token created successfully');

        // token.name 包含實際的令牌值
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                token: tokenResponse.name,
                expiresAt: expireTime
            })
        };
    } catch (error) {
        console.error("[ERROR] Failed to create ephemeral token:", error);
        console.error("[ERROR] Error details:", error.message, error.stack);

        // 返回友好的錯誤訊息
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: "無法創建安全令牌，請稍後再試",
                details: error.message
            })
        };
    }
};
