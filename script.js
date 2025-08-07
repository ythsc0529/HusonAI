document.addEventListener('DOMContentLoaded', () => {
    // 取得所有需要的 HTML 元素
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceInputBtn = document.getElementById('voice-input-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // 初始化 Web Speech API
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
        console.log('你的瀏覽器不支援語音辨識喔～');
    }

    // 對話歷史紀錄，用來傳給 AI 參考上下文
    let conversationHistory = [];
    let imageData = {
        mimeType: '',
        base64: ''
    };

    // 發送訊息的函式
    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        const hasImage = imageData.base64 !== '';
        
        if (messageText === '' && !hasImage) {
            return;
        }

        // 顯示使用者訊息
        appendMessage('user', messageText, imageData.base64);
        
        // 取得當前選擇的模型
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        
        // 將使用者訊息加入歷史紀錄
        const userMessageParts = [];
        if (messageText) {
            userMessageParts.push({ text: messageText });
        }
        if (hasImage) {
            userMessageParts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.base64
                }
            });
        }
        conversationHistory.push({ role: 'user', parts: userMessageParts });

        // 清空輸入框和圖片預覽
        messageInput.value = '';
        clearImagePreview();

        // 顯示 "AI 正在輸入中..." 的動畫
        appendTypingIndicator();

        try {
            // 呼叫我們的 Netlify Function
            const response = await fetch('/.netlify/functions/getAiResponse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    history: conversationHistory,
                    model: selectedModel
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `發生錯誤惹，HTTP 狀態碼: ${response.status}`);
            }

            const data = await response.json();
            const aiResponse = data.response;

            // 將 AI 回應加入歷史紀錄
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
            
            // 移除 "輸入中" 動畫並顯示 AI 回應
            removeTypingIndicator();
            appendMessage('ai', aiResponse);

        } catch (error) {
            console.error('呼叫 AI 時出錯:', error);
            removeTypingIndicator();
            appendMessage('ai', `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${error.message}`);
        }
    };
    
    // 將訊息顯示在聊天視窗的函式
    const appendMessage = (sender, text, imageBase64 = null) => {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${sender}-message`);

        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = sender === 'ai' ? 'H' : '你';
        
        const textContent = document.createElement('div');
        textContent.classList.add('text-content');
        
        if (sender === 'user') {
            if (imageBase64) {
                const img = document.createElement('img');
                img.src = `data:image/jpeg;base64,${imageBase64}`;
                img.classList.add('uploaded-image');
                textContent.appendChild(img);
            }
            if (text) {
                const p = document.createElement('p');
                p.textContent = text;
                textContent.appendChild(p);
            }
        } else { // AI message
            // 使用 marked.js 將 Markdown 轉為 HTML
            textContent.innerHTML = marked.parse(text);
        }

        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(textContent);
        chatWindow.appendChild(messageWrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight; // 自動滾動到底部
    };

    // 顯示 "輸入中..."
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

    // 移除 "輸入中..."
    const removeTypingIndicator = () => {
        const indicator = document.querySelector('.typing-indicator-wrapper');
        if (indicator) {
            indicator.remove();
        }
    };

    // 處理圖片上傳
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            imageData.mimeType = file.type;
            // 去掉 base64 字串的 data URI 前綴
            imageData.base64 = reader.result.split(',')[1];
            
            showImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    });

    // 顯示圖片預覽
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

    // 清除圖片預覽和資料
    const clearImagePreview = () => {
        imagePreviewContainer.innerHTML = '';
        imageData.mimeType = '';
        imageData.base64 = '';
        // 重設 file input 的值，這樣才能再次上傳同一個檔案
        imageUploadInput.value = '';
    };

    // 處理語音輸入
    if (recognition) {
        voiceInputBtn.addEventListener('click', () => {
            if (voiceInputBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                recognition.start();
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
            // 語音輸入後自動送出
            sendMessage();
        };

        recognition.onerror = (event) => {
            console.error('語音辨識錯誤:', event.error);
            alert(`語音辨識好像怪怪的：${event.error}`);
        };
    }

    // 監聽事件
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        // 按下 Enter 送出，Shift+Enter 換行
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});