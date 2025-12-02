//為求方便，程式註解由AI生成，程式撰寫為我自行建構
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
    const uploadBtn = document.getElementById('upload-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const chatTitle = document.getElementById('chat-title');
    const compressionStatus = document.getElementById('compression-status');
    const notificationContainer = document.getElementById('notification-container');

    //更新報 Modal 元素與行為
    const updateModal = document.getElementById('update-modal');
    const updateCloseBtn = document.getElementById('update-close-btn');
    const updateDismissCheckbox = document.getElementById('update-dismiss-checkbox');

    // 若 localStorage 設定了 hideUpdates=true 則不顯示，否則每次登入顯示
    const hideUpdates = localStorage.getItem('hideUpdates') === 'true';
    if (!hideUpdates) {
        updateModal.classList.add('active');
        updateModal.setAttribute('aria-hidden', 'false');
    }

    const closeUpdateModal = () => {
        if (updateDismissCheckbox && updateDismissCheckbox.checked) {
            localStorage.setItem('hideUpdates', 'true');
        }
        updateModal.classList.remove('active');
        updateModal.setAttribute('aria-hidden', 'true');
    };

    updateCloseBtn.addEventListener('click', closeUpdateModal);
    // 點遮罩也關閉
    const overlay = document.querySelector('.update-modal-overlay');
    if (overlay) overlay.addEventListener('click', closeUpdateModal);
    // Esc 鍵關閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && updateModal.classList.contains('active')) closeUpdateModal();
    });

    // 全域變數
    let currentChatId = null;
    let conversationHistory = [];
    let imageData = null;

    const sendMessage = async () => {
        const messageText = messageInput.value.trim();

        if (messageText === '') {
            if (imageData) {
                showNotification('請輸入文字', '傳送圖片時請附上說明文字，讓 AI 更能理解您的需求。', 'warning');
            }
            return;
        }

        // 構建訊息內容
        const userMessageParts = [];
        if (messageText) userMessageParts.push({ text: messageText });

        if (imageData) {
            userMessageParts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            });
            appendMessage('user', messageText, true, imageData);
        } else {
            appendMessage('user', messageText);
        }

        conversationHistory.push({ role: 'user', parts: userMessageParts });
        saveHistory();

        messageInput.value = '';
        // 清除圖片
        imageData = null;
        imageUploadInput.value = '';
        imagePreviewContainer.innerHTML = '';

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

        // 判斷是否顯示搜尋動畫 (OH3 不支援搜尋)
        const searchKeywords = ['股市', 'google', 'search', '搜尋', '查', '找', '天氣', '新聞', '股票', '匯率', '哪裡', '什麼', 'who', 'what', 'where', 'when', 'how', '時事'];
        const isSearching = currentChatId !== 'oh3' && searchKeywords.some(keyword => messageText.toLowerCase().includes(keyword));

        appendTypingIndicator(isSearching ? 'searching' : 'typing');

        // 準備要傳送的資料
        const modelMap = { 'huson2.5': '2.5', 'huson2.0': '2.0', 'oh3': 'oh3' };
        const payload = {
            history: conversationHistory,
            model: modelMap[currentChatId]
        };

        // 移除會 stringify 完整 payload（可能含大量資料）的日誌，改為簡短日誌
        console.log("Prepared payload (no binary included). Model:", payload.model);

        try {
            // 禁用送出按鈕以避免重複送出
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

            let errorMessage = `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${error.message}`;
            let notificationMessage = error.message;

            if (currentChatId === 'huson2.5') {
                const suggestion = '\n\n💡 建議：您可以嘗試使用「Huson 3.0 mini」或「OH3」模型，或是重新整理網頁再試一次。';
                errorMessage += suggestion;
                notificationMessage += ' (建議嘗試 Mini 或 OH3 模型或重整網頁)';
            } else if (currentChatId === 'huson2.0') {
                const suggestion = '\n\n💡 建議：您可以嘗試使用「OH3」模型，或是重新整理網頁再試一次。';
                errorMessage += suggestion;
                notificationMessage += ' (建議嘗試 OH3 模型或重整網頁)';
            } else if (currentChatId === 'oh3') {
                const suggestion = '\n\n💡 建議：請嘗試重新整理網頁再試一次。';
                errorMessage += suggestion;
                notificationMessage += ' (建議重整網頁)';
            }

            showNotification('發生錯誤', notificationMessage, 'error');
            appendMessage('ai', errorMessage);
        } finally {
            // 無論成功或失敗都重新啟用按鈕
            sendBtn.disabled = false;
        }
    };

    const loadChat = (chatId) => {
        const titles = {
            'huson2.5': 'Huson 3.0 pro',
            'huson2.0': 'Huson 3.0 mini',
            'oh3': 'OH3',
            'studio': '隨便你工作室 💬'
        };
        chatTitle.textContent = titles[chatId];
        chatWindow.innerHTML = '';
        messageInput.value = '';
        imageData = null;
        imagePreviewContainer.innerHTML = '';
        conversationHistory = [];

        const initialMessages = {
            'huson2.5': '你好，我是 Huson 3.0 pro，專門處理複雜問題的。請講。🧐',
            'huson2.0': '哈囉！我是 Huson 3.0 mini，地表最快的啦！有啥問題，儘管問！😎',
            'oh3': '嗨！我是 OH3，最輕量化的模型。我可能沒那麼聰明，但我會盡力回答你的問題！🪶',
            'studio': '您好，這裡是「隨便你工作室」，請問有什麼可以為您服務的？'
        };
        const welcomeText = initialMessages[chatId];
        appendMessage('ai', welcomeText, null, null, false);
    };

    const saveHistory = () => {
        // sessionStorage 已移除，不做任何持久化
        return;
    };

    const appendMessage = (sender, text, animate = true, image = null) => {
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
            if (image) {
                const img = document.createElement('img');
                img.src = `data:${image.mimeType};base64,${image.data}`;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '8px';
                img.style.marginBottom = text ? '8px' : '0';
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

    const appendTypingIndicator = (type = 'typing') => {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', 'ai-message', 'typing-indicator-wrapper');
        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.textContent = 'H';
        const textContent = document.createElement('div');
        textContent.classList.add('text-content');

        if (type === 'searching') {
            const searchingIndicator = document.createElement('div');
            searchingIndicator.classList.add('searching-indicator');
            searchingIndicator.innerHTML = '<span></span><span></span><span></span><span></span>';

            const text = document.createElement('span');
            text.style.marginLeft = '10px';
            text.style.fontSize = '0.9rem';
            text.style.color = 'var(--text-muted)';
            text.textContent = '正在搜尋...';

            textContent.appendChild(searchingIndicator);
            textContent.appendChild(text);
        } else {
            const typingIndicator = document.createElement('div');
            typingIndicator.classList.add('typing-indicator');
            typingIndicator.innerHTML = '<span></span><span></span><span></span>';
            textContent.appendChild(typingIndicator);
        }

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
                catch (e) {
                    console.error("語音辨識啟動失敗", e);
                    showNotification('語音辨識失敗', '無法啟動語音辨識功能。', 'error');
                }
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
                showNotification('語音辨識錯誤', `發生錯誤：${event.error}`, 'error');
            }
        };
    } else {
        voiceInputBtn.style.display = 'none';
    }

    // 圖片上傳處理
    uploadBtn.addEventListener('click', () => {
        imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showNotification('格式錯誤', '請上傳圖片檔案 (JPG, PNG, WEBP 等)。', 'warning');
            return;
        }

        try {
            // 壓縮圖片
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1024,
                useWebWorker: true
            };

            let compressedFile = file;
            // 如果有引入 browser-image-compression 則使用
            if (window.imageCompression) {
                compressedFile = await imageCompression(file, options);
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                imageData = {
                    mimeType: file.type,
                    data: base64String
                };

                // 顯示預覽
                imagePreviewContainer.innerHTML = `
                    <div class="image-preview-item">
                        <img src="${reader.result}" alt="Preview">
                        <button class="remove-image-btn" onclick="removeImage()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                // 綁定移除按鈕事件 (因為 onclick="removeImage()" 需要全域函數，這裡用事件委派或直接綁定)
                const removeBtn = imagePreviewContainer.querySelector('.remove-image-btn');
                removeBtn.onclick = (e) => {
                    e.stopPropagation(); // 防止觸發其他點擊
                    imageData = null;
                    imageUploadInput.value = '';
                    imagePreviewContainer.innerHTML = '';
                };
            };
            reader.readAsDataURL(compressedFile);

        } catch (error) {
            console.error('圖片處理失敗:', error);
            showNotification('圖片處理失敗', '無法處理此圖片，請試試看別張。', 'error');
        }
    });

    // Notification System
    const showNotification = (title, message, type = 'info') => {
        const notification = document.createElement('div');
        notification.classList.add('notification', type);

        const icons = {
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            success: 'fa-check-circle',
            info: 'fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });

        notificationContainer.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                closeNotification(notification);
            }
        }, 5000);
    };

    const closeNotification = (notification) => {
        notification.classList.add('hiding');
        notification.addEventListener('animationend', () => {
            if (notification.parentElement) {
                notification.remove();
            }
        });
    };
});
