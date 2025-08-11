document.addEventListener('DOMContentLoaded', () => {
    // 頁面元素
    const selectionPage = document.getElementById('selection-page');
    const chatPage = document.getElementById('chat-page');
    const selectionCards = document.querySelectorAll('.selection-card');
    const backBtn = document.getElementById('back-to-selection-btn');
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const chatTitle = document.getElementById('chat-title');
    const compressionStatus = document.getElementById('compression-status'); // 新增

    // 全域變數
    let currentChatId = null;
    let conversationHistory = [];
    let imageData = { mimeType: '', base64: '' };

    // 初始化語音辨識 (無變動)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'zh-TW';
    } else {
        voiceInputBtn.style.display = 'none';
    }

    // ==========================================================
    //  ↓↓↓ 全新圖片處理核心邏輯 ↓↓↓
    // ==========================================================
    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 檢查檔案類型是否為圖片
        if (!file.type.startsWith('image/')) {
            alert('請選擇有效的圖片檔案！');
            return;
        }

        // 開始處理，禁用傳送按鈕避免誤觸
        sendBtn.disabled = true;
        compressionStatus.textContent = `圖片處理中，請稍候... ⏳`;
        compressionStatus.style.display = 'block';

        console.log(`圖片壓縮前大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

        // 設定壓縮選項
        const options = {
            maxSizeMB: 1,          // 最大檔案大小 (MB)
            maxWidthOrHeight: 1920,  // 最大寬度或高度
            useWebWorker: true,    // 使用 Web Worker 加快處理速度
            initialQuality: 0.8    // 初始壓縮品質
        };

        try {
            // 使用 browser-image-compression 工具進行壓縮
            const compressedFile = await imageCompression(file, options);
            console.log(`圖片壓縮後大小: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

            // 將壓縮後的檔案轉為 Base64
            const reader = new FileReader();
            reader.readAsDataURL(compressedFile);
            reader.onloadend = () => {
                imageData.mimeType = compressedFile.type;
                imageData.base64 = reader.result.split(',')[1];

                // 顯示預覽圖並恢復按鈕
                showImagePreview(reader.result);
                sendBtn.disabled = false;
                compressionStatus.style.display = 'none';
            };
            reader.onerror = () => {
                 throw new Error("讀取壓縮後檔案失敗！");
            }

        } catch (error) {
            console.error('圖片壓縮或處理失敗:', error);
            alert(`圖片處理失敗惹... 歹勢啦！\n${error.message}`);
            sendBtn.disabled = false;
            compressionStatus.style.display = 'none';
        } finally {
             // 清空 input 的值，確保可以再次上傳同一個檔案
            imageUploadInput.value = '';
        }
    };
    // 綁定事件到新的處理函式
    imageUploadInput.addEventListener('change', handleImageUpload);
    // ==========================================================
    //  ↑↑↑ 全新圖片處理核心邏輯 ↑↑↑
    // ==========================================================


    // 頁面導航邏輯 (無變動)
    selectionCards.forEach(card => {
        card.addEventListener('click', () => {
            currentChatId = card.dataset.chat;
            loadChat(currentChatId);
            selectionPage.classList.remove('active');
            chatPage.classList.add('active');
        });
    });
    backBtn.addEventListener('click', () => {
        chatPage.classList.remove('active');
        selectionPage.classList.add('active');
        currentChatId = null;
    });

    // 聊天核心邏輯 (除了圖片處理，其餘無變動)
    const loadChat = (chatId) => {
        const titles = {
            'huson2.5': 'Huson 3.0 pro',
            'huson2.0': 'Huson 3.0 mini',
            'studio': '隨便你工作室 💬'
        };
        chatTitle.textContent = titles[chatId];
        chatWindow.innerHTML = '';
        messageInput.value = '';
        clearImagePreview();
        const savedHistory = sessionStorage.getItem(`${chatId}_history`);
        conversationHistory = savedHistory ? JSON.parse(savedHistory) : [];
        if (conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                let text = '', imageBase64 = null, imageMimeType = 'image/jpeg';
                const imagePart = msg.parts.find(p => p.inlineData);
                const textPart = msg.parts.find(p => p.text);
                if (textPart) text = textPart.text;
                if (imagePart) {
                    imageBase64 = imagePart.inlineData.data;
                    imageMimeType = imagePart.inlineData.mimeType;
                }
                appendMessage(msg.role === 'model' ? 'ai' : 'user', text, imageBase64, imageMimeType, false);
            });
        } else {
            const initialMessages = {
                'huson2.5': '你好，我是 Huson 3.0 pro，專門處理複雜問題的。請講。🧐',
                'huson2.0': '哈囉！我是 Huson 3.0 mini，地表最快的啦！有啥問題，儘管問！😎',
                'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？'
            };
            appendMessage('ai', initialMessages[chatId], null, null, false);
        }
    };
    const saveHistory = () => {
        if (currentChatId) sessionStorage.setItem(`${currentChatId}_history`, JSON.stringify(conversationHistory));
    };

    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        const hasImage = imageData.base64 !== '';
        if (messageText === '' && !hasImage) return;
        if (sendBtn.disabled) return; // 如果按鈕被禁用，不執行任何操作

        if (currentChatId === 'studio' && conversationHistory.length === 0) {
            const initialMessages = { 'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？' };
            conversationHistory.push({ role: 'model', parts: [{ text: initialMessages.studio }] });
        }
        appendMessage('user', messageText, imageData.base64, imageData.mimeType);
        const userMessageParts = [];
        if (hasImage) userMessageParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
        if (messageText) userMessageParts.push({ text: messageText });
        conversationHistory.push({ role: 'user', parts: userMessageParts });
        saveHistory();
        messageInput.value = '';
        clearImagePreview();

        if (currentChatId === 'studio') {
            appendTypingIndicator();
            setTimeout(() => {
                removeTypingIndicator();
                const replyText = '已收到您的回覆，我們的團隊將會盡快處理，感謝您的留言！';
                appendMessage('ai', replyText);
                conversationHistory.push({ role: 'model', parts: [{ text: replyText }] });
                saveHistory();
            }, 800);
            return;
        }

        appendTypingIndicator();
        try {
            const modelMap = { 'huson2.5': '2.5', 'huson2.0': '2.0' };
            const response = await fetch('/.netlify/functions/getAiResponse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: conversationHistory, model: modelMap[currentChatId] }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP 狀態碼: ${response.status}`);
            }
            const data = await response.json();
            const aiResponse = data.response;
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            saveHistory();
            removeTypingIndicator();
            appendMessage('ai', aiResponse);
        } catch (error) {
            console.error('呼叫 AI 時出錯:', error);
            removeTypingIndicator();
            appendMessage('ai', `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${error.message}`);
        }
    };

    // 輔助函式 (僅 appendMessage 和 clearImagePreview 有小調整)
    const appendMessage = (sender, text, imageBase64 = null, imageMimeType = 'image/jpeg', animate = true) => {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${sender}-message`);
        if (!animate) {
            messageWrapper.style.animation = 'none';
            messageWrapper.style.opacity = '1';
            messageWrapper.style.transform = 'translateY(0)';
        }
        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = sender === 'ai' ? 'H' : '你';
        const textContent = document.createElement('div');
        textContent.classList.add('text-content');
        if (sender === 'user') {
            if (imageBase64) {
                const img = document.createElement('img');
                img.src = `data:${imageMimeType};base64,${imageBase64}`;
                img.classList.add('uploaded-image');
                textContent.appendChild(img);
            }
            if (text) {
                const p = document.createElement('p');
                p.textContent = text;
                textContent.appendChild(p);
            }
        } else {
            textContent.innerHTML = marked.parse(text);
        }
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(textContent);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };
    const appendTypingIndicator = () => {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', 'ai-message', 'typing-indicator-wrapper');
        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = 'H';
        const textContent = document.createElement('div');
        textContent.classList.add('text-content');
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        textContent.appendChild(typingIndicator);
        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(textContent);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };
    const removeTypingIndicator = () => {
        const indicator = document.querySelector('.typing-indicator-wrapper');
        if (indicator) indicator.remove();
    };
    const clearImagePreview = () => {
        imagePreviewContainer.innerHTML = '';
        compressionStatus.style.display = 'none'; // 清除預覽時也隱藏狀態文字
        imageData.mimeType = '';
        imageData.base64 = '';
    };
    const showImagePreview = (src) => {
        imagePreviewContainer.innerHTML = ''; // 先清空
        const img = document.createElement('img');
        img.src = src;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.onclick = clearImagePreview;
        imagePreviewContainer.appendChild(img);
        imagePreviewContainer.appendChild(removeBtn);
    };

    // 事件監聽 (無變動)
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    if (recognition) {
        voiceInputBtn.addEventListener('click', () => {
            if (voiceInputBtn.classList.contains('recording')) { recognition.stop(); } else { try { recognition.start(); } catch(e) { console.error("語音辨識啟動失敗", e); alert("語音辨識無法啟動。"); } }
        });
        recognition.onstart = () => voiceInputBtn.classList.add('recording');
        recognition.onend = () => voiceInputBtn.classList.remove('recording');
        recognition.onresult = (event) => { messageInput.value = event.results[0][0].transcript; sendMessage(); };
        recognition.onerror = (event) => { if (event.error !== 'no-speech') { console.error('語音辨識錯誤:', event.error); alert(`語音辨識好像怪怪的：${event.error}`); } };
    }
});