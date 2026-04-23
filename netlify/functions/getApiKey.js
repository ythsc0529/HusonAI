exports.handler = async (event, context) => {
  // 基本安全檢查：只允許來自自家網域的請求 (在 Netlify 環境中可根據需求調整)
  const referer = event.headers.referer || event.headers.Referer;
  
  // 如果是在開發環境或特定的網域，才回傳金鑰
  // 注意：這裡假設您已經在 Netlify 設定了 GEMINI_API_KEY 環境變數
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "伺服器未設定 GEMINI_API_KEY" }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  };
};
