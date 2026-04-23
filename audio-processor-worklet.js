class AudioProcessorWorklet extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
            const channelData = input[0];
            // 將 Float32Array 傳送到主執行緒
            this.port.postMessage(channelData);
        }
        return true;
    }
}

registerProcessor('audio-processor-worklet', AudioProcessorWorklet);
