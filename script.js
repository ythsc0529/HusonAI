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
    version: '2.0.4',
    title: 'Huson-AI 2.0.4 對話系統升級',
    content: `* **重大更新**：現在切換模型會保留各自的對話紀錄了，就像開獨立的聊天室一樣。`,
    imageSrc: '',
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
        const initialMessage = `我是 Huson，目前使用 ${selectedOption.innerText} 模型。`;
        if (!chatHistories[modelName].some(m => m.role === 'model' && m.isGreeting)) {
             const greeting = { role: 'model', parts: [{ text: initialMessage }], isGreeting: true };
             chatHistories[modelName].push(greeting);
             renderMessage('model', greeting.parts, true);
        }
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
        } else if (part.inline_data || part.originalUrl) {
            const imgNode = document.createElement('img');
            imgNode.src = part.originalUrl || `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
            contentDiv.appendChild(imgNode);
        }
    });
    
    messageContainer.appendChild(contentDiv);

    if (role === 'huson' && !isGreeting) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = '複製內文';
        const copyIcon = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" /></svg>`;
        const checkIcon = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" /></svg>`;
        copyBtn.innerHTML = copyIcon;
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(contentDiv.innerText).then(() => {
                copyBtn.innerHTML = checkIcon;
                setTimeout(() => { copyBtn.innerHTML = copyIcon; }, 1500);
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
    renderMessage('user', userPartsForDisplay);
    
    const userPartsForApi = [];
    if (userText) userPartsForApi.push({ text: userText });
    if (attachedImage) userPartsForApi.push({ inline_data: { mime_type: attachedImage.mimeType, data: attachedImage.base64 } });

    chatHistories[currentModel].push({ role: 'user', parts: userPartsForApi });

    userInput.value = '';
    clearAttachedImage();
    
    const thinkingMessage = document.createElement('div');
    thinkingMessage.classList.add('message', 'huson-message');
    thinkingMessage.innerText = '正在思考';
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

        if (!response.ok) throw new Error(`伺服器出包了，代碼：${response.status}`);
        const data = await response.json();
        const husonResponse = data.text;
        chatHistories[currentModel].push({ role: 'model', parts: [{ text: husonResponse }] });

        chatWindow.removeChild(thinkingMessage);
        renderMessage('huson', [{ text: husonResponse }]);
        
    } catch (error) {
        console.error("出錯了:", error);
        chatWindow.removeChild(thinkingMessage);
        renderMessage('huson', [{ text: "API 好像掛了" }]);
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
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); userInput.placeholder = '講話啊，或打字啦'; };
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) { finalTranscript += event.results[i][0].transcript; } else { interimTranscript += event.results[i][0].transcript; }
        }
        userInput.value = finalTranscript || interimTranscript;
    };
    recognition.onerror = (event) => { console.error('語音辨識錯誤:', event.error); alert(`語音辨識出錯了，錯誤類型: ${event.error}`); };
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