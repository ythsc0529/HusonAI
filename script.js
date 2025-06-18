// --- DOM 元素 ---
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('file-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const clearImageButton = document.getElementById('clear-image-button');
const micBtn = document.getElementById('mic-btn');
const modelToggle = document.getElementById('model-toggle'); // 模型切換開關
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
let isListening = false;
let currentModel = 'gemini-2.0-flash'; // 預設模型

// --- 你的更新資訊 ---
const latestUpdate = {
    version: '2.0.3', // 我幫你升一版，這樣更新通知才會跳出來
    title: 'Huson-AI 2.0.3 模型切換功能',
    content: `
        * **新功能**：標題旁邊新增了模型切換器，讓你可以在 2.0 mini(回應速度較快，適合日常使用)2.5(回應速度慢，適合數學或程式) 之間自由選擇！
        * **注意**：高階模型可能反應比較慢或有其他特性，自己體驗看看。
    `,
    imageSrc: '',
    privacyPolicyUrl: 'privacy.html'
};

// --- 頁面載入時執行 ---
window.onload = () => {
    const lastSeenVersion = localStorage.getItem('husonAiVersion');
    if (lastSeenVersion !== latestUpdate.version) {
        displayUpdateNotification(latestUpdate);
    }
    init();
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
}

function init() {
    const initialMessage = "我是 Huson 2.0。你可以用上面的開關切換模型，也可以問我問題";
    addMessageToChat('huson', initialMessage);
}

function addMessageToChat(sender, message) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message', sender === 'user' ? 'user-message' : 'huson-message');
    
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = marked.parse(message);
    messageContainer.appendChild(contentDiv);

    if (sender === 'huson') {
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
            }).catch(err => {
                console.error('複製失敗:', err);
                alert('複製失敗，你的瀏覽器可能太舊或不支援。');
            });
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
    clearAttachedImage();
    addMessageToChat('huson', '...');

    try {
        const response = await fetch('/.netlify/functions/get-gemini-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                history: conversationHistory,
                model: currentModel // 把當前選擇的模型名稱傳給後端
            }),
        });

        if (!response.ok) throw new Error(`伺服器出包了，代碼：${response.status}`);

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

// --- 語音辨識功能 ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'zh-TW';
    recognition.interimResults = true;

    micBtn.addEventListener('click', () => { if (!isListening) { recognition.start(); } else { recognition.stop(); } });
    recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); userInput.placeholder = '正在聆聽'; };
    recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); userInput.placeholder = '問我問題或上傳圖片'; };
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
    console.log("你的瀏覽器不支援語音辨識啦請使用chrome或safari。");
    micBtn.style.display = 'none';
}

// --- 事件監聽 ---
sendButton.addEventListener('click', handleUserRequest);
userInput.addEventListener('keypress', (event) => { if (event.key === 'Enter') handleUserRequest(); });
modelToggle.addEventListener('change', () => {
    if (modelToggle.checked) {
        currentModel = 'gemini-2.5-flash';
        console.log("模型切換至：", currentModel);
    } else {
        currentModel = 'gemini-2.0-flash';
        console.log("模型切換至：", currentModel);
    }
});