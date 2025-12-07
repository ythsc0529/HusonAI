/**
 * 音頻處理模組
 * 負責音頻的擷取、格式轉換和播放
 */

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;

        // 音頻參數
        this.sampleRate = 16000; // 16kHz for input
        this.outputSampleRate = 24000; // 24kHz for output
    }

    /**
     * 初始化音頻上下文
     */
    async initialize() {
        try {
            // 創建 AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.outputSampleRate
            });

            console.log('[AudioProcessor] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[AudioProcessor] Initialization failed:', error);
            throw new Error('無法初始化音頻系統');
        }
    }

    /**
     * 請求麥克風權限並開始擷取音頻
     */
    async startCapture(onAudioData) {
        try {
            // 請求麥克風權限
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1, // mono
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 創建 MediaRecorder
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            };

            this.mediaRecorder = new MediaRecorder(this.audioStream, options);

            // 處理音頻數據
            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    // 將音頻數據轉換為 base64
                    const base64Audio = await this.blobToBase64(event.data);
                    if (onAudioData) {
                        onAudioData(base64Audio);
                    }
                }
            };

            // 開始錄音，每 100ms 發送一次數據
            this.mediaRecorder.start(100);
            this.isRecording = true;

            console.log('[AudioProcessor] Audio capture started');
            return true;
        } catch (error) {
            console.error('[AudioProcessor] Failed to start capture:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('麥克風權限被拒絕，請允許使用麥克風');
            }
            throw new Error('無法啟動麥克風');
        }
    }

    /**
     * 停止音頻擷取
     */
    stopCapture() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }

        console.log('[AudioProcessor] Audio capture stopped');
    }

    /**
     * 播放 AI 回應的音頻
     * @param {string} base64Audio - Base64 編碼的音頻數據
     */
    async playAudio(base64Audio) {
        try {
            // 將 base64 轉換為 ArrayBuffer
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // 解碼音頻數據
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

            // 創建音頻源並播放
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);

            console.log('[AudioProcessor] Playing audio');
        } catch (error) {
            console.error('[AudioProcessor] Failed to play audio:', error);
        }
    }

    /**
     * 播放 PCM 音頻數據（Gemini Live API 回傳格式）
     * @param {string} base64PCM - Base64 編碼的 16-bit PCM 數據
     */
    async playPCMAudio(base64PCM) {
        try {
            // 將 base64 轉換為 ArrayBuffer
            const binaryString = atob(base64PCM);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // 將 16-bit PCM 轉換為 Float32Array
            const int16Array = new Int16Array(bytes.buffer);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0; // 正規化到 [-1, 1]
            }

            // 創建 AudioBuffer
            const audioBuffer = this.audioContext.createBuffer(
                1, // mono
                float32Array.length,
                this.outputSampleRate
            );
            audioBuffer.getChannelData(0).set(float32Array);

            // 播放音頻
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);

            console.log('[AudioProcessor] Playing PCM audio');
        } catch (error) {
            console.error('[AudioProcessor] Failed to play PCM audio:', error);
        }
    }

    /**
     * 將 Blob 轉換為 Base64
     */
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 獲取音量等級（用於視覺化）
     */
    getVolumeLevel() {
        // TODO: 實作音量檢測
        return 0;
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.stopCapture();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        console.log('[AudioProcessor] Cleaned up');
    }
}

// 導出為全域變數（因為使用傳統的 script 標籤載入）
window.AudioProcessor = AudioProcessor;
