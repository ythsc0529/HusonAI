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
    const compressionStatus = document.getElementById('compression-status');

    // 全域變數
    let currentChatId = null;
    let conversationHistory = [];
    // 圖片功能已移除，故不再保留 imageData

    const sendMessage = async () => {
        const messageText = messageInput.value.trim();
        const imagePreview = imagePreviewContainer.querySelector('img');

        if (!messageText && !imagePreview) return;

        const userMessageParts = [];
        if (messageText) {
            appendMessage('user', messageText);
            userMessageParts.push({ text: messageText });
        }

        if (imagePreview) {
            const base64Image = imagePreview.src.split(',')[1];
            appendImage('user', imagePreview.src);
            userMessageParts.push({ inlineData: { mimeType: imagePreview.dataset.mimeType, data: base64Image } });
            imagePreviewContainer.innerHTML = ''; // 清空圖片預覽
        }

        processMessage(userMessageParts);
        messageInput.value = '';
    };

    const processMessage = async (userMessageParts) => {
        conversationHistory.push({ role: 'user', parts: userMessageParts });
        saveHistory();

        appendTypingIndicator();

        const modelMap = { 'huson2.5': '2.5', 'huson2.0': '2.0' };
        const payload = {
            history: conversationHistory,
            model: modelMap[currentChatId]
        };

        try {
            sendBtn.disabled = true;

            const response = await fetch('/.netlify/functions/getAiResponse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
            console.error("呼叫 AI 時出錯:", error);
            removeTypingIndicator();
            appendMessage('ai', `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${error.message}`);
        } finally {
            sendBtn.disabled = false;
        }
    };
    
    const loadChat = (chatId) => {
        const titles = {
            'huson2.5': 'Huson 3.0 pro',
            'huson2.0': 'Huson 3.0 mini',
            'studio': '隨便你工作室 💬'
        };
        chatTitle.textContent = titles[chatId];
        chatWindow.innerHTML = '';
        messageInput.value = '';
        // 圖片預覽相關已移除

        // 已移除 sessionStorage：每次切換時重置會話歷史（不做任何持久化）
        conversationHistory = [];

        const initialMessages = {
            'huson2.5': '你好，我是 Huson 3.0 pro，專門處理複雜問題的。請講。🧐',
            'huson2.0': '哈囉！我是 Huson 3.0 mini，地表最快的啦！有啥問題，儘管問！😎',
            'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？'
        };
        const welcomeText = initialMessages[chatId];
        appendMessage('ai', welcomeText, null, null, false);
    };

    const saveHistory = () => {
        // sessionStorage 已移除，不做任何持久化
        return;
    };

    const appendMessage = (sender, text, animate = true) => {
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

    const appendImage = (sender, imageUrl) => {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${sender}-message`);
        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = sender === 'ai' ? 'H' : '你';
        const textContent = document.createElement('div');
        textContent.classList.add('text-content');
        const img = document.createElement('img');
        img.src = imageUrl;
        img.classList.add('uploaded-image');
        textContent.appendChild(img);
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

    selectionCards.forEach(card => {
        card.addEventListener('click', () => {
            currentChatId = card.dataset.chat;
            loadChat(currentChatId);
            selectionPage.classList.remove('active');
            chatPage.classList.add('active');
        })
    });
    
    backBtn.addEventListener('click', () => {
        chatPage.classList.remove('active');
        selectionPage.classList.add('active');
        currentChatId = null;
    });

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'zh-TW';

        voiceInputBtn.addEventListener('click', () => {
            if (voiceInputBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                try { recognition.start(); }
                catch(e) { console.error("語音辨識啟動失敗", e); alert("語音辨識無法啟動。"); }
            }
        });

        recognition.onstart = () => voiceInputBtn.classList.add('recording');
        recognition.onend = () => voiceInputBtn.classList.remove('recording');
        recognition.onresult = (event) => {
            messageInput.value = event.results[0][0].transcript;
            sendMessage();
        };
        recognition.onerror = (event) => {
            if (event.error !== 'no-speech') {
                console.error('語音辨識錯誤:', event.error);
                alert(`語音辨識好像怪怪的：${event.error}`);
            }
        };
    } else {
        voiceInputBtn.style.display = 'none';
    }

    imageUploadInput.addEventListener('change', () => {
        const file = imageUploadInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                imagePreviewContainer.innerHTML = ''; // 清空之前的預覽
                const img = document.createElement('img');
                img.src = reader.result;
                img.dataset.mimeType = file.type;
                img.classList.add('uploaded-image');
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '✖';
                removeBtn.title = '移除圖片';
                removeBtn.addEventListener('click', () => {
                    imagePreviewContainer.innerHTML = ''; // 移除圖片預覽
                    imageUploadInput.value = ''; // 清空檔案輸入
                });
                imagePreviewContainer.appendChild(img);
                imagePreviewContainer.appendChild(removeBtn);
            };
            reader.readAsDataURL(file);
        }
    });
});