/**
 * AudioProcessor - 處理音訊擷取與播放
 */
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.source = null;
        this.processor = null;
        this.isRecording = false;
        this.onAudioData = null;
        this.sampleRate = 16000; // Gemini Live API 期望的輸入採樣率
        this.outputSampleRate = 24000; // Gemini Live API 提供的輸出採樣率
    }

    async initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        // 為了播放音訊，我們需要一個專門的播放 Context (或共用)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async startCapture(callback) {
        if (this.isRecording) return;
        
        this.onAudioData = callback;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        this.source = this.audioContext.createMediaStreamSource(this.stream);
        
        // 使用 ScriptProcessorNode (雖然被廢棄但相容性最好且實作簡單)
        // 緩衝區大小 4096 適合 16kHz
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.processor.onaudioprocess = (e) => {
            if (!this.isRecording) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            // 將 Float32 轉換為 Int16 (PCM)
            const pcmData = this.floatTo16BitPCM(inputData);
            // 轉換為 Base64
            const base64Audio = this.arrayBufferToBase64(pcmData.buffer);
            
            if (this.onAudioData) {
                this.onAudioData(base64Audio);
            }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        this.isRecording = true;
    }

    stopCapture() {
        this.isRecording = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.processor) {
            this.processor.disconnect();
        }
        if (this.source) {
            this.source.disconnect();
        }
    }

    // 播放從 API 傳回的 Base64 PCM 音訊
    async playPCMAudio(base64Data) {
        const arrayBuffer = this.base64ToArrayBuffer(base64Data);
        const pcmData = new Int16Array(arrayBuffer);
        const floatData = new Float32Array(pcmData.length);
        
        // Int16 to Float32
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        const audioBuffer = this.audioContext.createBuffer(1, floatData.length, this.outputSampleRate);
        audioBuffer.getChannelData(0).set(floatData);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start();
    }

    // 輔助工具
    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Int16Array(buffer);
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

/**
 * LiveAPIClient - 管理與 Gemini Live API 的 WebSocket 連接
 */
class LiveAPIClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.onOpen = null;
        this.onMessage = null;
        this.onError = null;
        this.onClose = null;
        this.model = "models/gemini-2.0-flash-exp"; // 目前支援 Live 的模型路徑
    }

    async connect(apiKey, systemInstruction) {
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
        
        this.ws = new WebSocket(url);

        return new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                this.isConnected = true;
                // 發送設定訊息
                const setupMessage = {
                    setup: {
                        model: this.model,
                        generation_config: {
                            response_modalities: ["audio"],
                            speech_config: {
                                voice_config: { prebuilt_voice_config: { voice_name: "Aoide" } }
                            }
                        },
                        system_instruction: {
                            parts: [{ text: systemInstruction }]
                        }
                    }
                };
                this.ws.send(JSON.stringify(setupMessage));
                if (this.onOpen) this.onOpen();
                resolve();
            };

            this.ws.onmessage = (event) => {
                let data;
                if (event.data instanceof Blob) {
                    // 處理二進位數據 (如果有)
                } else {
                    data = JSON.parse(event.data);
                    if (this.onMessage) this.onMessage(data);
                }
            };

            this.ws.onerror = (error) => {
                if (this.onError) this.onError(error);
                reject(error);
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                if (this.onClose) this.onClose();
            };
        });
    }

    sendAudio(base64Data) {
        if (!this.isConnected) return;
        
        const audioMessage = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: "audio/pcm",
                        data: base64Data
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(audioMessage));
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

window.AudioProcessor = AudioProcessor;
window.LiveAPIClient = LiveAPIClient;
