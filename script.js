document.addEventListener('DOMContentLoaded', () => {
    // 頁面元素
    const selectionPage = document.getElementById('selection-page');
    const chatPage = document.getElementById('chat-page');
    const selectionCards = document.querySelectorAll('.selection-card');
    const backBtn = document.getElementById('back-to-selection-btn');

    // 聊天頁面元素
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const chatTitle = document.getElementById('chat-title');

    // 全域變數
    let currentChatId = null; // e.g., 'huson2.5', 'huson2.0', 'studio'
    let conversationHistory = [];
    let imageData = { mimeType: '', base64: '' };

    // 初始化語音辨識
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'zh-TW';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else {
        voiceInputBtn.style.display = 'none';
    }

    // ===== 頁面導航邏輯 =====

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
        currentChatId = null; // 清空當前聊天 ID
    });

    // ===== 聊天核心邏輯 =====

    const loadChat = (chatId) => {
        // 1. 設定聊天室標題
        const titles = {
            'huson2.5': 'Huson 3.0 pro',
            'huson2.0': 'Huson3.0 mini',
            'studio': '隨便你工作室 💬'
        };
        chatTitle.textContent = titles[chatId];
        
        // 2. 清空聊天視窗和輸入
        chatWindow.innerHTML = '';
        messageInput.value = '';
        clearImagePreview();
        
        // 3. 從 sessionStorage 載入歷史紀錄
        const savedHistory = sessionStorage.getItem(`${chatId}_history`);
        conversationHistory = savedHistory ? JSON.parse(savedHistory) : [];

        // 4. 渲染歷史訊息
        if (conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                let text = '';
                let imageBase64 = null;
                let imageMimeType = 'image/jpeg'; // default
                msg.parts.forEach(part => {
                    if(part.text) {
                        text = part.text;
                    }
                    if(part.inlineData) {
                        imageBase64 = part.inlineData.data;
                        imageMimeType = part.inlineData.mimeType;
                    }
                });
                appendMessage(msg.role === 'model' ? 'ai' : 'user', text, imageBase64, imageMimeType, false);
            });
        } else {
            // 5. 如果沒有歷史紀錄，只顯示歡迎訊息，但不存入 history
            const initialMessages = {
                'huson2.5': '你好，我是 Huson 3.0 pro，專門處理複雜問題的。請講。🧐',
                'huson2.0': '哈囉！我是 Huson 3.0 mini，地表最快的啦！有啥問題，儘管問！😎',
                'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？'
            };
            const welcomeText = initialMessages[chatId];
            appendMessage('ai', welcomeText, null, null, false);
        }
    };
    
    const saveHistory = () => {
        if (currentChatId) {
            sessionStorage.setItem(`${currentChatId}_history`, JSON.stringify(conversationHistory));
        }
    };

    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        const hasImage = imageData.base64 !== '';
        
        if (messageText === '' && !hasImage) return;

        // 如果是客服模式，且是第一句話，要先手動加入歡迎訊息到 history
        if (currentChatId === 'studio' && conversationHistory.length === 0) {
            const initialMessages = { 'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？' };
            conversationHistory.push({ role: 'model', parts: [{ text: initialMessages.studio }] });
        }

        appendMessage('user', messageText, imageData.base64, imageData.mimeType);
        
        const userMessageParts = [];
        if (hasImage) {
            // 對於有圖的訊息，將文字和圖片包在同一個 part 裡
            userMessageParts.push({
                inlineData: { mimeType: imageData.mimeType, data: imageData.base64 }
            });
        }
        if (messageText) {
             userMessageParts.push({ text: messageText });
        }
        
        conversationHistory.push({ role: 'user', parts: userMessageParts });
        saveHistory();
        
        messageInput.value = '';
        clearImagePreview();

        // 處理客服模式
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
                body: JSON.stringify({
                    history: conversationHistory,
                    model: modelMap[currentChatId]
                }),
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
    
    // ===== 輔助函式 =====

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
        if (indicator) {
            indicator.remove();
        }
    };
    
    const clearImagePreview = () => {
        imagePreviewContainer.innerHTML = '';
        imageData.mimeType = '';
        imageData.base64 = '';
        imageUploadInput.value = '';
    };

    const showImagePreview = (src) => {
        clearImagePreview();
        const img = document.createElement('img');
        img.src = src;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.onclick = clearImagePreview;
        imagePreviewContainer.appendChild(img);
        imagePreviewContainer.appendChild(removeBtn);
    };

    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            imageData.mimeType = file.type;
            imageData.base64 = reader.result.split(',')[1];
            showImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    });
    
    // 監聽事件
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    if (recognition) {
        voiceInputBtn.addEventListener('click', () => {
            if (voiceInputBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch(e) {
                    console.error("語音辨識啟動失敗", e);
                    alert("語音辨識無法啟動，可能正在處理上一個請求。");
                }
            }
        });
        recognition.onstart = () => {
            voiceInputBtn.classList.add('recording');
        };
        recognition.onend = () => {
            voiceInputBtn.classList.remove('recording');
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            messageInput.value = transcript;
            sendMessage();
        };
        recognition.onerror = (event) => {
            console.error('語音辨識錯誤:', event.error);
            if (event.error !== 'no-speech') {
                alert(`語音辨識好像怪怪的：${event.error}`);
            }
        };
    }
});