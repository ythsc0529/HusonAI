/**
 * Live API Client and Audio Processor for Gemini Multimodal Live
 * Designed for LH1 Model
 */

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.stream = null;
        this.mediaRecorder = null;
        this.inputSampleRate = 16000;
        this.isRecording = false;
        this.onAudioData = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.nextStartTime = 0;
    }

    async initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.inputSampleRate
        });
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async startCapture(callback) {
        if (this.isRecording) return;
        
        this.onAudioData = callback;
        
        // Use AudioWorklet if possible (modern way)
        try {
            if (!this.audioContext.audioWorklet) {
                throw new Error('AudioWorklet not supported');
            }

            // Only add the module if it hasn't been added yet
            if (!this.workletLoaded) {
                // Create worklet code as a Blob
                const workletCode = `
                    class AudioCaptureProcessor extends AudioWorkletProcessor {
                        process(inputs, outputs, parameters) {
                            const input = inputs[0];
                            if (input.length > 0) {
                                const inputData = input[0];
                                this.port.postMessage(inputData);
                            }
                            return true;
                        }
                    }
                    registerProcessor('audio-capture-processor', AudioCaptureProcessor);
                `;
                const blob = new Blob([workletCode], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                await this.audioContext.audioWorklet.addModule(url);
                this.workletLoaded = true;
                URL.revokeObjectURL(url);
            }
            
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.stream);
            
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
            this.workletNode.port.onmessage = (e) => {
                if (!this.isRecording) return;
                const inputData = e.data;
                const pcmData = this.floatTo16BitPCM(inputData);
                const base64Audio = this.base64Encode(pcmData);
                if (this.onAudioData) this.onAudioData(base64Audio);
            };
            
            source.connect(this.workletNode);
            this.isRecording = true;
        } catch (e) {
            console.warn('Fallback to ScriptProcessorNode due to:', e.message);
            // Fallback to legacy ScriptProcessorNode if AudioWorklet fails
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(this.stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            processor.onaudioprocess = (e) => {
                if (!this.isRecording) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = this.floatTo16BitPCM(inputData);
                const base64Audio = this.base64Encode(pcmData);
                if (this.onAudioData) this.onAudioData(base64Audio);
            };
            
            this.processor = processor;
            this.isRecording = true;
        }
    }

    stopCapture() {
        this.isRecording = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
    }

    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    }

    base64Encode(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Play PCM audio from Base64
    async playPCMAudio(base64Data) {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
        }
        
        const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, this.inputSampleRate);
        audioBuffer.getChannelData(0).set(float32Data);
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        const currentTime = this.audioContext.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime;
        }
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
    }

    stopAllPlayback() {
        // Reset nextStartTime to allow immediate playback of new audio
        this.nextStartTime = this.audioContext.currentTime;
    }
}

class LiveAPIClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.onOpen = null;
        this.onMessage = null;
        this.onClose = null;
        this.onError = null;
    }

    async connect(apiKey, systemInstruction) {
        return new Promise((resolve, reject) => {
            const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
            
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                
                // Send setup message
                const setupMessage = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        system_instruction: {
                            parts: [{ text: systemInstruction }]
                        },
                        generation_config: {
                            response_modalities: ["audio"]
                        }
                    }
                };
                
                this.ws.send(JSON.stringify(setupMessage));
                if (this.onOpen) this.onOpen();
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (this.onMessage) this.onMessage(data);
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                if (this.onClose) this.onClose();
            };
            
            this.ws.onerror = (error) => {
                if (this.onError) this.onError(error);
                reject(error);
            };
        });
    }

    sendAudio(base64Audio) {
        if (!this.isConnected) return;
        
        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        mime_type: "audio/pcm;rate=16000",
                        data: base64Audio
                    }
                ]
            }
        };
        
        this.ws.send(JSON.stringify(message));
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// UI Manager for LH1 Live Mode
class LH1UIManager {
    constructor() {
        this.overlay = null;
        this.sphere = null;
        this.statusText = null;
        this.muteBtn = null;
        this.isMuted = false;
        this.onEndCall = null;
        this.onToggleMute = null;
    }

    createOverlay() {
        if (document.querySelector('.live-view-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'live-view-overlay';
        overlay.innerHTML = `
            <div class="live-bg">
                <div class="live-bg-blob"></div>
            </div>
            <div class="lh1-sphere-container">
                <div class="live-status-text" id="live-status">正在喚醒 LH1...</div>
                <div class="lh1-sphere" id="lh1-core"></div>
            </div>
            <div class="live-controls">
                <button class="live-btn" id="live-mute-btn" title="靜音">
                    <i class="fas fa-microphone"></i>
                </button>
                <button class="live-btn" id="live-camera-btn" disabled title="開啟相機 (即將推出)">
                    <i class="fas fa-video"></i>
                </button>
                <button class="live-btn" id="live-screen-btn" disabled title="螢幕分享 (即將推出)">
                    <i class="fas fa-desktop"></i>
                </button>
                <button class="live-btn end-call" id="live-end-btn" title="結束對話">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        this.overlay = overlay;
        this.sphere = overlay.querySelector('#lh1-core');
        this.statusText = overlay.querySelector('#live-status');
        this.muteBtn = overlay.querySelector('#live-mute-btn');
        
        overlay.querySelector('#live-end-btn').addEventListener('click', () => {
            if (this.onEndCall) this.onEndCall();
        });

        this.muteBtn.addEventListener('click', () => {
            this.isMuted = !this.isMuted;
            this.muteBtn.classList.toggle('active', this.isMuted);
            this.muteBtn.innerHTML = this.isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
            if (this.onToggleMute) this.onToggleMute(this.isMuted);
        });
    }

    show() {
        this.overlay.classList.add('active');
    }

    hide() {
        this.overlay.classList.remove('active');
    }

    updateStatus(text, state = 'idle') {
        this.statusText.textContent = text;
        this.sphere.className = 'lh1-sphere ' + state;
    }
}

window.AudioProcessor = AudioProcessor;
window.LiveAPIClient = LiveAPIClient;
window.LH1UIManager = LH1UIManager;
