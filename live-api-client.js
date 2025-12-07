/**
 * Gemini Live API WebSocket 客戶端
 * 負責與 Gemini Live API 的 WebSocket 連接和通訊
 */

class LiveAPIClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.config = {
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            generationConfig: {
                responseModalities: 'audio',
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Aoede' // 可選的語音名稱
                        }
                    }
                }
            }
        };

        // 回調函數
        this.onOpen = null;
        this.onMessage = null;
        this.onError = null;
        this.onClose = null;
    }

    /**
     * 連接到 Gemini Live API
     * @param {string} apiKey - 臨時 API 金鑰
     * @param {string} systemInstruction - 系統指令
     */
    async connect(apiKey, systemInstruction) {
        try {
            // WebSocket URL
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

            console.log('[LiveAPIClient] Connecting to Gemini Live API...');

            this.ws = new WebSocket(wsUrl);

            // 設定事件處理器
            this.ws.onopen = () => {
                console.log('[LiveAPIClient] WebSocket connected');
                this.isConnected = true;

                // 發送初始化配置
                this.sendSetup(systemInstruction);

                if (this.onOpen) this.onOpen();
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('[LiveAPIClient] Received message:', message);

                if (this.onMessage) this.onMessage(message);
            };

            this.ws.onerror = (error) => {
                console.error('[LiveAPIClient] WebSocket error:', error);
                if (this.onError) this.onError(error);
            };

            this.ws.onclose = (event) => {
                console.log('[LiveAPIClient] WebSocket closed:', event.code, event.reason);
                this.isConnected = false;

                if (this.onClose) this.onClose(event);
            };

        } catch (error) {
            console.error('[LiveAPIClient] Connection failed:', error);
            throw new Error('無法連接到語音服務');
        }
    }

    /**
     * 發送設定訊息
     */
    sendSetup(systemInstruction) {
        const setupMessage = {
            setup: {
                model: this.config.model,
                generationConfig: this.config.generationConfig
            }
        };

        // 如果有系統指令，添加到設定中
        if (systemInstruction) {
            setupMessage.setup.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        this.send(setupMessage);
        console.log('[LiveAPIClient] Setup message sent');
    }

    /**
     * 發送音頻數據
     * @param {string} base64Audio - Base64 編碼的音頻數據
     * @param {string} mimeType - 音頻 MIME 類型
     */
    sendAudio(base64Audio, mimeType = 'audio/webm;codecs=opus') {
        if (!this.isConnected) {
            console.warn('[LiveAPIClient] Not connected, cannot send audio');
            return;
        }

        const message = {
            realtimeInput: {
                mediaChunks: [{
                    mimeType: mimeType,
                    data: base64Audio
                }]
            }
        };

        this.send(message);
    }

    /**
     * 發送文字訊息（可選功能）
     * @param {string} text - 文字內容
     */
    sendText(text) {
        if (!this.isConnected) {
            console.warn('[LiveAPIClient] Not connected, cannot send text');
            return;
        }

        const message = {
            clientContent: {
                turns: [{
                    role: 'user',
                    parts: [{ text: text }]
                }],
                turnComplete: true
            }
        };

        this.send(message);
    }

    /**
     * 發送訊息到 WebSocket
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('[LiveAPIClient] WebSocket not ready');
        }
    }

    /**
     * 斷開連接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            console.log('[LiveAPIClient] Disconnected');
        }
    }

    /**
     * 獲取連接狀態
     */
    getConnectionState() {
        if (!this.ws) return 'CLOSED';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }
}

// 導出為全域變數
window.LiveAPIClient = LiveAPIClient;
