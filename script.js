// --- DOM 元素 ---
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageButton = document.getElementById('clear-image-button');
const micBtn = document.getElementById('mic-btn');
const modelSelector = document.getElementById('model-selector');
const versionTitle = document.getElementById('version-title');
const updateNotification = document.getElementById('update-notification');
const updateTitle = document.getElementById('update-title');
const updateContent = document.getElementById('update-content');
const updateImage = document.getElementById('update-image');
const closeNotificationButton = document.getElementById('close-notification');
const privacyPolicyButton = document.getElementById('privacy-policy-button');
const overlay = document.getElementById('overlay');

// --- 應用程式狀態 ---
let attachedImage = null;
let isListening = false;
let currentModel = modelSelector.value;
let chatHistories = {
    'gemini-2.0-flash': [],
    'gemini-2.5-flash': []
};

// --- 你的更新資訊 ---
const latestUpdate = {
    version: '2.1.1', // UI 大改版，升一版
    title: 'Huson-AI 2.1.0 介面刷新',
    content: `* **重大更新**：整體 UI 介面重新設計，變得更潮了。
               * 新增了訊息動畫、按鈕效果，還有新的「思考中」動畫。`,
    imageSrc: '', // 你可以放更新相關的圖片網址
    privacyPolicyUrl: 'privacy.html'
};

// --- 頁面載入時執行 ---
window.onload = () => {
    const lastSeenVersion = localStorage.getItem('husonAiVersion');
    if (lastSeenVersion !== latestUpdate.version) {
        displayUpdateNotification(latestUpdate);
    }
    loadConversation(currentModel);
};

// --- 更新通知功能 ---
function displayUpdateNotification(info) {
    updateTitle.innerText = info.title;
    updateContent.innerHTML = marked.parse(info.content);
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

function clearAttachedImage() {
    attachedImage = null;
    fileInput.value = '';
    imagePreviewContainer.style.display = 'none';
}

clearImageButton.addEventListener('click', clearAttachedImage);

// --- 核心聊天功能 ---
function toggleInput(disabled) {
    userInput.disabled = disabled;
    sendButton.disabled = disabled;
    fileInput.disabled = disabled;
    clearImageButton.disabled = disabled;
    micBtn.disabled = disabled;
    modelSelector.disabled = disabled;
}

function loadConversation(modelName) {
    const selectedOption = modelSelector.querySelector(`option[value="${modelName}"]`);
    versionTitle.innerText = selectedOption.innerText;
    chatWindow.innerHTML = '';
    const history = chatHistories[modelName];

    if (history.length === 0) {
        const initialMessage = `我是 Huson，目前使用 ${selectedOption.innerText} 模型。有什麼問題？`;
        renderMessage('huson', [{ text: initialMessage }], true);
    } else {
        history.forEach(message => {
            renderMessage(message.role, message.parts, message.isGreeting);
        });
    }
}

function renderMessage(sender, parts, isGreeting = false) {
    const role = (sender === 'user') ? 'user' : 'huson';
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', `${role}-message`);

    const contentDiv = document.createElement('div');
    
    parts.forEach(part => {
        if (part.text) {
            const textElement = document.createElement('div');
            textElement.innerHTML = marked.parse(part.text);
            contentDiv.appendChild(textElement);
        } else if (part.originalUrl) {
            const imgNode = document.createElement('img');
            imgNode.src = part.originalUrl;
            contentDiv.appendChild(imgNode);
        } else if (part.inline_data) {
             const imgNode = document.createElement('img');
             imgNode.src = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
             contentDiv.appendChild(imgNode);
        }
    });
    
    messageContainer.appendChild(contentDiv);

    if (role === 'huson' && !isGreeting) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = '複製內文';
        copyBtn.innerHTML = `<img src="copy.svg" alt="複製">`;
        const checkIconHtml = `<img src="tick.svg" alt="已複製">`;
        
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(contentDiv.innerText).then(() => {
                copyBtn.innerHTML = checkIconHtml;
                setTimeout(() => { copyBtn.innerHTML = `<img src="copy.svg" alt="複製">`; }, 1500);
            }).catch(err => console.error('複製失敗:', err));
        });
        messageContainer.appendChild(copyBtn);
    }
    
    chatWindow.appendChild(messageContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function handleUserRequest() {
    const userText = userInput.value.trim();
    if (!userText && !attachedImage) return;

    toggleInput(true);

    const userPartsForDisplay = [];
    if (userText) userPartsForDisplay.push({ text: userText });
    if (attachedImage) userPartsForDisplay.push({ originalUrl: attachedImage.originalUrl });
    
    if (chatHistories[currentModel].length === 0) {
        const greetingMessage = chatWindow.querySelector('.huson-message');
        if (greetingMessage) greetingMessage.remove();
    }
    renderMessage('user', userPartsForDisplay);
    
    const userPartsForApi = [];
    if (userText) userPartsForApi.push({ text: userText });
    if (attachedImage) userPartsForApi.push({ inline_data: { mime_type: attachedImage.mimeType, data: attachedImage.base64 } });

    chatHistories[currentModel].push({ role: 'user', parts: userPartsForApi });

    userInput.value = '';
    clearAttachedImage();
    
    const thinkingMessage = document.createElement('div');
    thinkingMessage.classList.add('message', 'huson-message');
    thinkingMessage.innerHTML = `
        <div class="thinking-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    chatWindow.appendChild(thinkingMessage);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const response = await fetch('/.netlify/functions/get-gemini-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                history: chatHistories[currentModel],
                model: currentModel
            }),
        });

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({text: `伺服器回傳 ${response.status}，而且連內容都讀不到`}));
             throw new Error(errorData.text || `伺服器錯誤 ${response.status}`);
        }
        const data = await response.json();
        const husonResponse = data.text;
        chatHistories[currentModel].push({ role: 'model', parts: [{ text: husonResponse }] });

        chatWindow.removeChild(thinkingMessage);
        renderMessage('huson', [{ text: husonResponse }]);
        
    } catch (error) {
        console.error("出錯了:", error);
        chatWindow.removeChild(thinkingMessage);
        renderMessage('huson', [{ text: `API 好像掛了。錯誤：${error.message}` }]);
    } finally {
        toggleInput(false);
    }
}

// --- 語音辨識功能 ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'zh-TW';
    recognition.interimResults = true;
    micBtn.addEventListener('click', () => { if (!isListening) { recognition.start(); } else { recognition.stop(); } });
    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); userInput.placeholder = '正在聽你講話，請說...'; };
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); userInput.placeholder = '說話或打字'; };
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; } else { interimTranscript += event.results[i][0].transcript; }
        }
        userInput.value = finalTranscript || interimTranscript;
    };
    recognition.onerror = (event) => { console.error('語音辨識錯誤:', event.error); alert(`語音辨識出錯了。錯誤類型: ${event.error}`); };
} else {
    console.log("你的瀏覽器不支援語音辨識啦。");
    micBtn.style.display = 'none';
}

// --- 事件監聽 ---
sendButton.addEventListener('click', handleUserRequest);
userInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handleUserRequest(); });
modelSelector.addEventListener('change', (event) => {
    currentModel = event.target.value;
    console.log("模型切換至：", currentModel);
    loadConversation(currentModel);
});