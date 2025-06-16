// --- DOM 元素 ---
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageButton = document.getElementById('clear-image-button');
const updateNotification = document.getElementById('update-notification');
const updateTitle = document.getElementById('update-title');
const updateContent = document.getElementById('update-content');
const updateImage = document.getElementById('update-image');
const closeNotificationButton = document.getElementById('close-notification');
const privacyPolicyButton = document.getElementById('privacy-policy-button');
const overlay = document.getElementById('overlay');

// --- 應用程式狀態 ---
let conversationHistory = [];
let attachedImage = null;

// --- 你的更新資訊 (你可以自行修改這些內容) ---
const latestUpdate = {
    version: '2.0.0', // 用版本號來判斷
    title: 'Huson-AI 2.0 上線啦！',
    content: `
        **重大更新！**
        * 核心升級，數學推理能力大幅提升。
        * 看得懂圖片了，現在你可以上傳圖片讓他分析。
        * 訊息格式大進化，支援 **粗體**、表格、程式碼等。
    `,
    imageSrc: '', // 你可以放圖片網址，或留空
    privacyPolicyUrl: 'privacy.html' // 你的隱私權政策頁面
};

// --- 頁面載入時執行 ---
window.onload = () => {
    const lastSeenVersion = localStorage.getItem('husonAiVersion');
    if (lastSeenVersion !== latestUpdate.version) {
        displayUpdateNotification(latestUpdate);
    }
    init(); // 執行 AI 初始化問候
};

// --- 更新通知功能 ---
function displayUpdateNotification(info) {
    updateTitle.innerText = info.title;
    updateContent.innerHTML = marked.parse(info.content); // 用 marked 解析內容
    if (info.imageSrc) {
        updateImage.src = info.imageSrc;
        updateImage.style.display = 'block';
    } else {
        updateImage.style.display = 'none';
    }
    privacyPolicyButton.onclick = () => window.open(info.privacyPolicyUrl, '_blank');
    closeNotificationButton.onclick = closeUpdateNotification;
    updateNotification.style.display = 'block';
    overlay.style.display = 'block';
}

function closeUpdateNotification() {
    updateNotification.style.display = 'none';
    overlay.style.display = 'none';
    localStorage.setItem('husonAiVersion', latestUpdate.version);
}

// --- 圖片處理 ---
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImage = { base64: e.target.result.split(',')[1], mimeType: file.type, originalUrl: e.target.result };
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

clearImageButton.addEventListener('click', () => {
    attachedImage = null;
    fileInput.value = '';
    imagePreviewContainer.style.display = 'none';
});

// --- 核心聊天功能 ---
function toggleInput(disabled) {
    userInput.disabled = disabled;
    sendButton.disabled = disabled;
    fileInput.disabled = disabled;
    clearImageButton.disabled = disabled;
}

function init() {
    const initialMessage = "我是Huson，有什麼可以幫你的?";
    addMessageToChat('huson', initialMessage);
}

// 修改：這個函式現在用 innerHTML 和 marked.js 來顯示內容
function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'huson-message');
    // 使用 marked.parse 將 Markdown 轉成 HTML
    messageElement.innerHTML = marked.parse(message);
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function handleUserRequest() {
    const userText = userInput.value.trim();
    if (!userText && !attachedImage) return;

    toggleInput(true);

    // 修改：在聊天視窗中顯示使用者訊息(含圖片預覽)
    const userMessageDiv = document.createElement('div');
    if (userText) {
        const textNode = document.createElement('p');
        textNode.textContent = userText;
        userMessageDiv.appendChild(textNode);
    }
    if (attachedImage) {
        const imgNode = document.createElement('img');
        imgNode.src = attachedImage.originalUrl;
        userMessageDiv.appendChild(imgNode);
    }
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', 'user-message');
    messageContainer.appendChild(userMessageDiv);
    chatWindow.appendChild(messageContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const userParts = [];
    if (userText) userParts.push({ text: userText });
    if (attachedImage) userParts.push({ inline_data: { mime_type: attachedImage.mimeType, data: attachedImage.base64 } });
    
    conversationHistory.push({ role: 'user', parts: userParts });

    userInput.value = '';
    clearImageButton.click();
    addMessageToChat('huson', '正在思考');

    try {
        const response = await fetch('/.netlify/functions/get-gemini-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: conversationHistory }),
        });

        if (!response.ok) throw new Error(`伺服器出包了，錯誤代碼：${response.status}`);

        const data = await response.json();
        const husonResponse = data.text;

        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', husonResponse);
        
        conversationHistory.push({ role: 'model', parts: [{ text: husonResponse }] });

    } catch (error) {
        console.error("出錯了:", error);
        chatWindow.removeChild(chatWindow.lastChild);
        addMessageToChat('huson', "API 好像掛了");
    } finally {
        toggleInput(false);
    }
}

sendButton.addEventListener('click', handleUserRequest);
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') handleUserRequest();
});