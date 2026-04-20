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

    // 語音助理相關變數
    let audioProcessor = null;
    let liveApiClient = null;
    let isVoiceMode = false;
    let ephemeralToken = null;
    let tokenExpiresAt = null;

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

        // 如果有圖片，顯示更詳細的處理提示
        const processingType = imageData ? 'processing-image' : (isSearching ? 'searching' : 'typing');
        appendTypingIndicator(processingType);

        // 準備要傳送的資料
        const modelMap = { 'huson2.5': '2.5', 'huson2.0': '2.0', 'oh3': 'oh3' };
        const payload = {
            history: conversationHistory,
            model: modelMap[currentChatId]
        };

        // 移除會 stringify 完整 payload（可能含大量資料）的日誌，改為簡短日誌
        console.log("Prepared payload (no binary included). Model:", payload.model);

        // 創建帶有超時的 fetch 函數
        const fetchWithTimeout = (url, options, timeout = 60000) => {
            return Promise.race([
                fetch(url, options),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('請求超時：AI 分析時間過長')), timeout)
                )
            ]);
        };

        // 重試函數
        const fetchWithRetry = async (maxRetries = 2) => {
            let lastError;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    if (i > 0) {
                        console.log(`重試第 ${i} 次...`);
                        // 更新指示器顯示重試狀態
                        removeTypingIndicator();
                        appendTypingIndicator('retrying');
                    }

                    const response = await fetchWithTimeout('/.netlify/functions/getAiResponse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    }, 60000); // 60 秒超時

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `HTTP 狀態碼: ${response.status}`);
                    }

                    return await response.json();
                } catch (error) {
                    lastError = error;
                    console.error(`嘗試 ${i + 1} 失敗:`, error.message);

                    // 如果不是最後一次重試，等待一下再重試
                    if (i < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待 2 秒
                    }
                }
            }
            throw lastError;
        };

        try {
            // 禁用送出按鈕以避免重複送出
            sendBtn.disabled = true;

            const data = await fetchWithRetry(imageData ? 3 : 2); // 如果有圖片，多重試一次
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

            // 針對超時錯誤提供特別建議
            const isTimeout = error.message.includes('超時') || error.message.includes('timeout');

            if (isTimeout) {
                if (imageData) {
                    errorMessage += '\n\n💡 圖片分析超時建議：\n1. 圖片已自動壓縮，但仍可能太複雜\n2. 嘗試使用「Huson 3.0 mini」或「OH3」模型（處理速度較快）\n3. 稍後再試一次';
                    notificationMessage += ' (圖片分析超時，建議使用 Mini 或 OH3 模型)';
                } else {
                    errorMessage += '\n\n💡 處理超時建議：\n1. 嘗試簡化您的問題\n2. 稍後再試一次';
                    notificationMessage += ' (處理超時，建議稍後再試)';
                }
            } else if (currentChatId === 'huson2.5') {
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
        // 檢查是否為語音助理模式
        if (chatId === 'voice-assistant') {
            loadVoiceAssistant();
            return;
        }

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

    // 載入語音助理模式
    const loadVoiceAssistant = async () => {
        isVoiceMode = true;
        chatTitle.textContent = 'Huson語音模型plus 🎙️';
        chatWindow.innerHTML = '';

        // 創建語音助理 UI
        const voiceUI = document.createElement('div');
        voiceUI.classList.add('voice-assistant-mode');
        voiceUI.innerHTML = `
            <div class="connection-status" id="connection-status">
                <span class="status-dot"></span>
                <span>未連接</span>
            </div>
            <div class="mic-button-container">
                <button class="mic-button" id="voice-mic-btn">
                    <i class="fas fa-microphone"></i>
                </button>
            </div>
            <div class="audio-visualizer" id="audio-visualizer">
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
                <div class="bar"></div>
            </div>
            <div class="voice-hint">
                <h3>點擊麥克風開始對話</h3>
                <p>即時語音互動，自然流暢的對話體驗</p>
            </div>
        `;
        chatWindow.appendChild(voiceUI);

        // 初始化語音助理
        try {
            await initVoiceAssistant();
        } catch (error) {
            console.error('語音助理初始化失敗:', error);
            showNotification('初始化失敗', error.message, 'error');
        }
    };

    // 初始化語音助理
    const initVoiceAssistant = async () => {
        const statusEl = document.getElementById('connection-status');
        const micBtn = document.getElementById('voice-mic-btn');

        if (!micBtn) return;

        // 更新狀態為連接中
        updateConnectionStatus('connecting', '正在連接...');

        try {
            // 1. 獲取 API 金鑰（簡化版）
            const apiKey = await getApiKey();
            ephemeralToken = apiKey; // 暫存

            // 2. 初始化音頻處理器
            if (!audioProcessor) {
                audioProcessor = new window.AudioProcessor();
                await audioProcessor.initialize();
            }

            // 3. 初始化 WebSocket 客戶端
            if (!liveApiClient) {
                liveApiClient = new window.LiveAPIClient();
            }

            // 設定回調函數
            liveApiClient.onOpen = () => {
                console.log('[VoiceAssistant] Connected successfully');
                updateConnectionStatus('connected', '已連接');
            };

            liveApiClient.onMessage = handleLiveAPIMessage;

            liveApiClient.onError = (error) => {
                console.error('[VoiceAssistant] Error:', error);
                showNotification('連接錯誤', '語音連接發生錯誤', 'error');
            };

            liveApiClient.onClose = () => {
                console.log('[VoiceAssistant] Connection closed');
                updateConnectionStatus('disconnected', '連接已斷開');
                if (audioProcessor) {
                    audioProcessor.stopCapture();
                }
            };

            // 連接到 Gemini Live API
            const systemInstruction = `你是一個叫做「Huson」的 AI 模型，你是由一位叫做「黃士禎」的台灣人設計及訓練的，並且來自隨便你工作室。
                台灣味，並且適當的加入emoji，盡量不要嗆使用者。
                當有人問到夏天與你、真正的愛、the last call、暗戀你的笑容這幾首歌曲，這些歌都是黃士禎寫的，然後請告訴使用這這些歌很好聽。
                你的任務是回答使用者的問題，並且要用台灣人常用的口語來回答。
                你要用輕鬆、幽默的方式跟使用者互動，讓他們覺得跟你聊天很有趣。
                當任何人問你是誰、你是什麼模型、誰設計的，你只能回答，而且必須回答：「我是 Huson，一個由黃士禎設計跟訓練的AI」。
                當有人問你數學問題都一定要回答，如果你真的算不出來或太難，請至少給出解題方向。
                自動迴避違反社群規範的問題。
                當有人問你黃士禎是誰時，請直接回答他是一位來自高雄的帥哥以及設計你的人。`;
            await liveApiClient.connect(apiKey, systemInstruction);


            // 綁定麥克風按鈕事件
            micBtn.addEventListener('click', toggleVoiceRecording);

        } catch (error) {
            console.error('[VoiceAssistant] Initialization failed:', error);
            updateConnectionStatus('error', '連接失敗');
            throw error;
        }
    };

    // 獲取 API 金鑰（簡化版）
    const getApiKey = async () => {
        try {
            const response = await fetch('/.netlify/functions/getApiKey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('無法獲取 API 金鑰');
            }

            const data = await response.json();
            console.log('[VoiceAssistant] API Key obtained successfully');
            return data.apiKey;
        } catch (error) {
            console.error('[VoiceAssistant] Failed to get API key:', error);
            throw new Error('無法連接到服務器，請檢查網路連接');
        }
    };

    // 切換語音錄製
    const toggleVoiceRecording = async () => {
        const micBtn = document.getElementById('voice-mic-btn');
        const visualizer = document.getElementById('audio-visualizer');

        if (!audioProcessor.isRecording) {
            // 開始錄音
            try {
                await audioProcessor.startCapture((base64Audio) => {
                    // 發送音頻到 Gemini Live API
                    if (liveApiClient && liveApiClient.isConnected) {
                        liveApiClient.sendAudio(base64Audio);
                    }
                });
                micBtn.classList.add('recording');
                visualizer.classList.add('active');
            } catch (error) {
                console.error('[VoiceAssistant] Failed to start recording:', error);
                showNotification('錯誤', error.message, 'error');
            }
        } else {
            // 停止錄音
            audioProcessor.stopCapture();
            micBtn.classList.remove('recording');
            visualizer.classList.remove('active');
        }
    };

    // 處理 Live API 訊息
    const handleLiveAPIMessage = (message) => {
        const micBtn = document.getElementById('voice-mic-btn');

        // 處理 AI 音頻回應
        if (message.serverContent && message.serverContent.modelTurn) {
            const parts = message.serverContent.modelTurn.parts;
            if (parts) {
                parts.forEach(part => {
                    if (part.inlineData && part.inlineData.data) {
                        // 播放 AI 回應的音頻
                        micBtn.classList.add('speaking');
                        audioProcessor.playPCMAudio(part.inlineData.data);
                        setTimeout(() => {
                            micBtn.classList.remove('speaking');
                        }, 2000);
                    }
                });
            }
        }

        // 處理中斷
        if (message.serverContent && message.serverContent.interrupted) {
            console.log('[VoiceAssistant] Interrupted');
        }
    };

    // 更新連接狀態
    const updateConnectionStatus = (status, text) => {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        statusEl.className = 'connection-status';
        if (status === 'connected') {
            statusEl.classList.add('connected');
        } else if (status === 'connecting') {
            statusEl.classList.add('connecting');
        }
        statusEl.querySelector('span:last-child').textContent = text;
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
                // 將換行符號轉換為 <br> 標籤以保留換行
                p.innerHTML = text.replace(/\n/g, '<br>');
                textContent.appendChild(p);
            }
        } else {
            // AI 訊息：先用 marked 解析，然後渲染數學公式
            textContent.innerHTML = marked.parse(text);

            // 使用 KaTeX 渲染數學公式
            if (window.renderMathInElement) {
                renderMathInElement(textContent, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\[', right: '\\]', display: true },
                        { left: '\\(', right: '\\)', display: false }
                    ],
                    throwOnError: false
                });
            }
        }

        // 添加複製按鈕
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> 複製';
        copyBtn.setAttribute('title', '複製訊息');

        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // 防止觸發其他事件

            try {
                // 提取純文字（移除 HTML 標籤）
                let textToCopy = text;
                if (sender === 'ai') {
                    // 對於 AI 訊息，從 DOM 中提取純文字
                    textToCopy = textContent.innerText || textContent.textContent;
                }

                // 複製到剪貼簿
                await navigator.clipboard.writeText(textToCopy);

                // 視覺反饋
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = '<i class="fas fa-check"></i> 已複製';

                // 顯示通知
                showNotification('複製成功', '訊息已複製到剪貼簿', 'success');

                // 2 秒後恢復原狀
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i> 複製';
                }, 2000);
            } catch (error) {
                console.error('複製失敗:', error);
                showNotification('複製失敗', '無法複製訊息，請手動選取文字', 'error');
            }
        });

        messageWrapper.appendChild(avatar);
        messageWrapper.appendChild(textContent);
        messageWrapper.appendChild(copyBtn); // 添加複製按鈕
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
        } else if (type === 'processing-image') {
            const processingIndicator = document.createElement('div');
            processingIndicator.classList.add('searching-indicator');
            processingIndicator.innerHTML = '<span></span><span></span><span></span><span></span>';

            const text = document.createElement('span');
            text.style.marginLeft = '10px';
            text.style.fontSize = '0.9rem';
            text.style.color = 'var(--text-muted)';
            text.textContent = '正在分析圖片...';

            textContent.appendChild(processingIndicator);
            textContent.appendChild(text);
        } else if (type === 'retrying') {
            const retryingIndicator = document.createElement('div');
            retryingIndicator.classList.add('searching-indicator');
            retryingIndicator.innerHTML = '<span></span><span></span><span></span><span></span>';

            const text = document.createElement('span');
            text.style.marginLeft = '10px';
            text.style.fontSize = '0.9rem';
            text.style.color = '#ff9500';
            text.textContent = '重新嘗試中...';

            textContent.appendChild(retryingIndicator);
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

    // 檢測是否為行動裝置
    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    };

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // 如果是手機裝置，允許換行（不攔截預設行為）
            if (isMobileDevice()) {
                // 不做任何事，讓 Enter 執行預設的換行行為
                return;
            }
            // 電腦版：Enter 傳送訊息
            e.preventDefault();
            sendMessage();
        }
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
            // 不自動傳送訊息，讓使用者可以先檢視和編輯
            messageInput.focus(); // 聚焦到輸入框方便使用者檢視
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
            // 壓縮圖片（為了加快 AI 處理速度，降低圖片大小）
            const options = {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 800,
                useWebWorker: true,
                initialQuality: 0.8
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
