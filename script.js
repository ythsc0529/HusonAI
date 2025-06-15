const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageButton = document.getElementById('clear-image-button');

let conversationHistory = [];
let attachedImage = null; // 用來存放要上傳的圖片資料

// --- 新增：處理圖片選擇的邏輯 ---
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImage = {
                base64: e.target.result.split(',')[1], // 只要 Base64 的部分
                mimeType: file.type,
            };
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file); // 轉成 Base64
    }
});

// --- 新增：處理清除圖片的邏輯 ---
clearImageButton.addEventListener('click', () => {
    attachedImage = null;
    fileInput.value = ''; // 清空 file input
    imagePreviewContainer.style.display = 'none';
});

// --- 新增：用來鎖定/解鎖輸入框的函式 ---
function toggleInput(disabled) {
    userInput.disabled = disabled;
    sendButton.disabled = disabled;
    fileInput.disabled = disabled;
}

// 網頁一打開就執行的初始化
function init() {
    const initialMessage = "我是 Huson，有什麼可以幫你的？";
    addMessageToChat('huson', initialMessage);
}

// 用來把訊息新增到聊天視窗的函式
function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    if (sender === 'user') {
        messageElement.classList.add('user-message');
    } else {
        messageElement.classList.add('huson-message');
    }
    messageElement.innerText = message;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function handleUserRequest() {
    const userText = userInput.value.trim();
    if (!userText && !attachedImage) return; // 沒文字也沒圖就滾

    toggleInput(true); // --- 修改：送出後立刻鎖定輸入 ---

    // 在畫面上顯示使用者傳的訊息
    addMessageToChat('user', userText || '正在使用圖片分析功能'); // 如果沒打字就顯示圖片分析
    
    // 把使用者訊息(包含圖片)加到對話歷史
    const userParts = [];
    if (userText) {
        userParts.push({ text: userText });
    }
    if (attachedImage) {
        userParts.push({
            inline_data: {
                mime_type: attachedImage.mimeType,
                data: attachedImage.base64,
            },
        });
    }
    conversationHistory.push({ role: 'user', parts: userParts });

    // 清空輸入框並顯示「正在輸入...」
    userInput.value = '';
    clearImageButton.click(); // 清除預覽圖
    addMessageToChat('huson', '正在思考');

    try {
        const response = await fetch('/.netlify/functions/get-gemini-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: conversationHistory }),
        });

        if (!response.ok) {
            throw new Error(`伺服器出包了，代碼：${response.status}`);
        }

        const data = await response.json();
        const husonResponse = data.text;

        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', husonResponse);
        
        conversationHistory.push({ role: 'model', parts: [{ text: husonResponse }] });

    } catch (error) {
        console.error("出錯了:", error);
        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', "API 好像掛了，請稍後再試。");
    } finally {
        toggleInput(false); // --- 修改：不管成功還失敗，最後都要解鎖 ---
    }
}

sendButton.addEventListener('click', handleUserRequest);
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleUserRequest();
    }
});

init();