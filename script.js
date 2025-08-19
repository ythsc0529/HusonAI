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
        let imageData = { mimeType: '', base64: '' };
        
        // 保證送出按鈕不會當成 form submit（避免頁面 reload）
        if (sendBtn) sendBtn.setAttribute('type', 'button');

        // 當正在壓縮或讀取圖片時禁用送出，避免 race condition
        let imageProcessing = false;

        const handleImageSelection = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('請選擇有效的圖片檔案！');
                imageUploadInput.value = '';
                return;
            }

            try {
                imageProcessing = true;
                if (sendBtn) sendBtn.disabled = true;

                // 壓縮參數（可依需求調整）
                const options = {
                    maxSizeMB: 1.0,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true
                };
                const compressedFile = await imageCompression(file, options);
                const reader = new FileReader();
                reader.readAsDataURL(compressedFile);

                reader.onload = () => {
                    console.log("圖片檔案讀取成功（已壓縮）。");
                    imageData.mimeType = compressedFile.type || file.type;
                    imageData.base64 = reader.result.split(',')[1];
                    showImagePreview(reader.result);
                    if (compressionStatus) {
                        compressionStatus.style.display = 'block';
                        compressionStatus.textContent = `已壓縮：${bytesToSize(compressedFile.size)}（原始：${bytesToSize(file.size)}）`;
                    }
                    imageProcessing = false;
                    if (sendBtn) sendBtn.disabled = false;
                };

                reader.onerror = () => {
                    console.error("FileReader 讀取檔案失敗！");
                    alert("讀取圖片時發生錯誤，請再試一次。");
                    clearImagePreview();
                    imageProcessing = false;
                    if (sendBtn) sendBtn.disabled = false;
                };
            } catch (err) {
                console.error("圖片壓縮或讀取失敗", err);
                alert("圖片處理失敗，請稍後再試或換張圖片。");
                clearImagePreview();
                imageProcessing = false;
                if (sendBtn) sendBtn.disabled = false;
            }
        };

        imageUploadInput.addEventListener('change', handleImageSelection);
        
        // helper: bytes -> 可讀大小
        const bytesToSize = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        const sendMessage = async () => {
            try {
                console.log('[DEBUG] sendMessage called', { imageProcessing, imageData });
                if (imageProcessing) {
                    alert('圖片還在處理中，請稍等一下再送出。');
                    return;
                }

                const messageText = messageInput.value.trim();
                const hasImage = imageData.base64 !== '';

                if (messageText === '' && !hasImage) return;

                // 如果有圖片但 base64 不存在，提示使用者
                if (hasImage && (!imageData.base64 || !imageData.mimeType)) {
                    alert('圖片尚未準備好，請稍後重試。');
                    return;
                }

                appendMessage('user', messageText, imageData.base64, imageData.mimeType);

                const userMessageParts = [];
                if (hasImage) {
                    userMessageParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
                }
                if (messageText) {
                     userMessageParts.push({ text: messageText });
                }

                conversationHistory.push({ role: 'user', parts: userMessageParts });
                saveHistory();

                messageInput.value = '';
                // 不要在送出前清掉 imageData 與預覽，避免 payload / race condition 問題
                // 送出時會把按鈕鎖住，送完成功或失敗後再決定是否清除預覽
                if (sendBtn) sendBtn.disabled = true;
 
                if (currentChatId === 'studio') {
                    appendTypingIndicator();
                    setTimeout(() => {
                        removeTypingIndicator();
                        const replyText = '已收到您的回覆，我們的團隊將會盡快處理，感謝您的留言！';
                        appendMessage('ai', replyText);
                        conversationHistory.push({ role: 'model', parts: [{ text: replyText }] });
                        saveHistory();
                        // studio 路徑結束後恢復按鈕並清掉預覽
                        if (sendBtn) sendBtn.disabled = false;
                        clearImagePreview();
                    }, 800);
                    return;
                }

                appendTypingIndicator();

                // 準備要傳送的資料
                const modelMap = { 'huson2.5': '2.5', 'huson2.0': '2.0' };
                
                // 將 conversationHistory 序列化成 server 能接受的純文字格式
                const serializeHistoryForServer = (history) => {
                    return history.map(item => {
                        // 將 parts 合併成單一字串：text 直接保留，inlineData 轉成 data URL 標記
                        const combined = item.parts.map(p => {
                            if (p.text) return p.text;
                            if (p.inlineData && p.inlineData.data) {
                                // 這裡把圖片轉成可傳的 data URL 字串（server 端若需要可再解碼）
                                return `[[IMAGE:${p.inlineData.mimeType};base64,${p.inlineData.data}]]`;
                            }
                            return '';
                        }).filter(Boolean).join('\n');

                        return {
                            role: item.role,
                            content: combined
                        };
                    });
                };

                const payload = {
                    history: serializeHistoryForServer(conversationHistory),
                    model: modelMap[currentChatId]
                };
     
                // 決定性的除錯日誌
                console.log("準備傳送給 AI 的最終資料 (Final Payload to be Sent):", JSON.stringify(payload));
                
                try {
                    // 檢查 payload 大小，避免超出伺服器限制（此值可調整）
                    const payloadStr = JSON.stringify(payload);
                    const payloadBytes = new Blob([payloadStr]).size;
                    const MAX_PAYLOAD_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
                    if (payloadBytes > MAX_PAYLOAD_BYTES) {
                        removeTypingIndicator();
                        alert(`圖片或訊息過大（${bytesToSize(payloadBytes)}），請壓縮或換張較小的圖片再試。`);
                        if (sendBtn) sendBtn.disabled = false;
                        return;
                    }
                    console.log('[DEBUG] 發送到伺服器前 payload 大小:', bytesToSize(payloadBytes));
                    console.log('[DEBUG] 發送 payload:', payload);

                    const response = await fetch('/.netlify/functions/getAiResponse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: payloadStr,
                    });

                    let data;
                    const text = await response.text();
                    try { data = JSON.parse(text); } catch { data = { error: text }; }

                    if (!response.ok) {
                        throw new Error(data.error || `HTTP 狀態碼: ${response.status}`);
                    }

                    const aiResponse = data.response;
                    conversationHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
                    saveHistory();
                    removeTypingIndicator();
                    appendMessage('ai', aiResponse);
                    // 成功送出後才清除預覽与還原按鈕
                    if (sendBtn) sendBtn.disabled = false;
                    clearImagePreview();

                } catch (error) {
                    console.error("呼叫 AI 時出錯:", error);
                    removeTypingIndicator();
                    // 發生錯誤時解鎖按鈕，保留預覽讓使用者重試
                    if (sendBtn) sendBtn.disabled = false;
                    appendMessage('ai', `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${error.message}`);
                }
            } catch (err) {
                console.error('sendMessage caught error:', err);
                removeTypingIndicator();
                appendMessage('ai', `哎呀，好像出錯了捏... 歹勢啦！😥\n錯誤訊息: ${err.message || err}`);
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
                const welcomeText = initialMessages[chatId];
                appendMessage('ai', welcomeText, null, null, false);
            }
        };

        const saveHistory = () => {
            if (!currentChatId) return;

            try {
                // 建立一份安全的複本，移除 inlineData 中的 base64 資料（只保留 mimeType）
                const safeCopy = conversationHistory.map(item => {
                    const parts = item.parts.map(p => {
                        if (p.inlineData && p.inlineData.data) {
                            // 不儲存大量的 base64，僅保留 mimeType 作為標記
                            return { inlineData: { mimeType: p.inlineData.mimeType } };
                        }
                        return p;
                    });
                    return { role: item.role, parts };
                });
                sessionStorage.setItem(`${currentChatId}_history`, JSON.stringify(safeCopy));
            } catch (e) {
                // 如果第一次存取失敗（通常是 quota exceed），嘗試更保守的做法或放棄儲存圖片
                console.warn('儲存歷史失敗，可能超出 quota，已略過儲存圖片。', e);
                try {
                    const safeCopy2 = conversationHistory.map(item => {
                        const parts = item.parts.map(p => {
                            if (p.inlineData) return { inlineData: { mimeType: p.inlineData.mimeType } };
                            if (p.text) return { text: p.text };
                            return {};
                        });
                        return { role: item.role, parts };
                    });
                    sessionStorage.setItem(`${currentChatId}_history`, JSON.stringify(safeCopy2));
                } catch (e2) {
                    console.error('再次儲存失敗，放棄儲存歷史。', e2);
                }
            }
        };

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
            if(compressionStatus) {
                compressionStatus.style.display = 'none';
            }
            imageData.mimeType = '';
            imageData.base64 = '';
        };
        
        // 顯示預覽但不要重設 imageData（否則會導致送出時沒有圖片）
        const showImagePreview = (src) => {
            // 只清除 DOM 預覽內容，不要改到 imageData
            imagePreviewContainer.innerHTML = '';
            const img = document.createElement('img');
            img.src = src;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.onclick = clearImagePreview;
            imagePreviewContainer.appendChild(img);
            imagePreviewContainer.appendChild(removeBtn);
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
    });