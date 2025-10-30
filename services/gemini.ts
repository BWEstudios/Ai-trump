// Fix: The 'LiveSession' type is not exported from '@google/genai'. It has been removed from the import.
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Language, type GroundingSource } from '../types';
import { createBlob, decode, decodeAudioData, encode } from '../utils/audio';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function generateTextResponse(prompt: string, systemInstruction: string): Promise<{ text: string, sources: GroundingSource[] }> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
        },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: GroundingSource[] = groundingChunks
        .map((chunk: any) => ({
            title: chunk.web?.title || 'Source',
            uri: chunk.web?.uri || '#',
        }))
        .filter(source => source.uri !== '#');

    return { text, sources };
}

export async function generateSpeech(text: string, language: Language): Promise<Uint8Array> {
    const voiceName = language === Language.JAPANESE ? 'Charon' : 'Fenrir';
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) {
        throw new Error("No audio data received from TTS API.");
    }
    
    return decode(base64Audio);
}


interface LiveConversationCallbacks {
    systemInstruction: string;
    language: Language;
    onUserMessage: (text: string) => void;
    onModelMessage: (text: string) => void;
    onComplete: () => void;
    onError: (error: Error) => void;
}

// Fix: The explicit return type was removed to allow TypeScript to infer it, as 'LiveSession' is not an exported type.
export async function startLiveConversation(callbacks: LiveConversationCallbacks) {
    
    let inputStream: MediaStream;
    let inputAudioContext: AudioContext;
    let scriptProcessor: ScriptProcessorNode;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;
    const sources = new Set<AudioBufferSourceNode>();

    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: callbacks.language === Language.JAPANESE ? 'Charon' : 'Fenrir' } },
            },
            systemInstruction: callbacks.systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
            onopen: async () => {
                try {
                    inputStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    const source = inputAudioContext.createMediaStreamSource(inputStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        }).catch(callbacks.onError);
                    };

                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                } catch(err) {
                    callbacks.onError(err as Error);
                }
            },
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.outputTranscription?.text) {
                    currentOutputTranscription += message.serverContent.outputTranscription.text;
                }
                if (message.serverContent?.inputTranscription?.text) {
                    currentInputTranscription += message.serverContent.inputTranscription.text;
                }

                if (message.serverContent?.turnComplete) {
                    if (currentInputTranscription.trim()) {
                        callbacks.onUserMessage(currentInputTranscription.trim());
                    }
                    if (currentOutputTranscription.trim()) {
                        callbacks.onModelMessage(currentOutputTranscription.trim());
                    }
                    currentInputTranscription = '';
                    currentOutputTranscription = '';
                }

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContext.destination);
                    source.addEventListener('ended', () => sources.delete(source));
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(source);
                }

                if (message.serverContent?.interrupted) {
                    sources.forEach(source => source.stop());
                    sources.clear();
                    nextStartTime = 0;
                }
            },
            onerror: (e: ErrorEvent) => callbacks.onError(e.error),
            onclose: (e: CloseEvent) => {
                inputStream?.getTracks().forEach(track => track.stop());
                inputAudioContext?.close();
                outputAudioContext?.close();
                callbacks.onComplete();
            },
        },
    });

    return sessionPromise;
}