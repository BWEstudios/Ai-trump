import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type ChatMessage, Language } from './types';
import { ChatMessageComponent } from './components/ChatMessage';
import { LanguageSelector } from './components/LanguageSelector';
import { MicButton } from './components/MicButton';
import { SendIcon, LoadingIcon } from './components/Icons';
import { startLiveConversation, generateTextResponse, generateSpeech } from './services/gemini';
import { getSystemInstruction } from './constants';
import { TRUMP_PROFILE_PICTURE } from './assets';
import { decodeAudioData } from './utils/audio';

type LiveSession = Awaited<ReturnType<typeof startLiveConversation>>;

const App: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [language, setLanguage] = useState<Language>(Language.ENGLISH);
    const [isRecording, setIsRecording] = useState(false);
    const [isTextLoading, setIsTextLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const liveSessionRef = useRef<LiveSession | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(() => {
        // Initialize AudioContext
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return () => {
            audioContextRef.current?.close();
        };
    }, []);
    
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Add initial welcome message
        setMessages([{
            id: 'init',
            role: 'model',
            text: "They're telling me, you know, that you can talk to me. It's true. I'm here. You can type, you can use the microphone. It's going to be tremendous, believe me.",
        }]);
    }, []);


    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
        if (isRecording) {
            handleToggleRecording();
        }
        setMessages([{
            id: 'init-lang-change',
            role: 'model',
            text: lang === Language.JAPANESE 
                ? "よし、日本語で話そう。素晴らしいことになるぞ、信じてくれ。" 
                : "Alright, we're speaking English. It's going to be great, believe me.",
        }]);
    };

    const handlePlayAudio = async (audioData: Uint8Array) => {
        const audioContext = audioContextRef.current;
        if (!audioContext) return;
    
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    
        try {
            const audioBuffer = await decodeAudioData(audioData, audioContext, 24000, 1);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
        } catch (e) {
            console.error("Failed to play audio", e);
            setError("Failed to play the voice. A sad thing, very sad.");
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isTextLoading || isRecording) return;
    
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: inputValue,
        };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');
        setIsTextLoading(true);
        setError(null);
    
        let modelMessageId = (Date.now() + 1).toString();
    
        try {
            const { text, sources } = await generateTextResponse(currentInput, getSystemInstruction(language));
            
            // Show text response immediately with audio loading indicator
            const modelMessageWithoutAudio: ChatMessage = {
                id: modelMessageId,
                role: 'model',
                text: text,
                sources: sources,
                isAudioLoading: true,
            };
            setMessages(prev => [...prev, modelMessageWithoutAudio]);
            setIsTextLoading(false);
            
            // Generate and then play audio
            const audioData = await generateSpeech(text, language);
            
            // Update message with audio data and remove loading state
            setMessages(prev => prev.map(msg => 
                msg.id === modelMessageId 
                ? { ...msg, audioData: audioData, isAudioLoading: false } 
                : msg
            ));
            
            // Auto-play the audio
            handlePlayAudio(audioData);
    
        } catch (err) {
            console.error(err);
            const errorMsg = 'We have a problem. A big problem. Something went wrong, it\'s a disaster, really.';
            setError(errorMsg);
            setMessages(prev => [...prev, { id: 'error-' + Date.now(), role: 'model', text: errorMsg }]);
            setIsTextLoading(false);
        }
    };
    
    const handleToggleRecording = useCallback(async () => {
        if (isTextLoading) return;

        if (isRecording) {
            liveSessionRef.current?.close();
            liveSessionRef.current = null;
            setIsRecording(false);
        } else {
            setError(null);
            setIsRecording(true);
            try {
                const session = await startLiveConversation({
                    systemInstruction: getSystemInstruction(language),
                    language,
                    onUserMessage: (text) => setMessages(prev => [...prev, { id: 'user-' + Date.now(), role: 'user', text }]),
                    onModelMessage: (text) => setMessages(prev => [...prev, { id: 'model-' + Date.now(), role: 'model', text }]),
                    onComplete: () => {
                        setIsRecording(false);
                        liveSessionRef.current = null;
                    },
                    onError: (err) => {
                         console.error(err);
                         const errorMsg = 'We have a problem with the microphone. A big problem. It\'s a disaster, really.';
                         setError(errorMsg);
                         setMessages(prev => [...prev, { id: 'error-' + Date.now(), role: 'model', text: errorMsg }]);
                         setIsRecording(false);
                         liveSessionRef.current = null;
                    }
                });
                liveSessionRef.current = session;
            } catch(err) {
                 console.error(err);
                 const errorMsg = 'Failed to start the recording. Could be a permissions issue. Very sad!';
                 setError(errorMsg);
                 setMessages(prev => [...prev, { id: 'error-' + Date.now(), role: 'model', text: errorMsg }]);
                 setIsRecording(false);
            }
        }
    }, [isRecording, isTextLoading, language]);
    
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
            <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-lg">
                <div className="flex items-center space-x-4">
                    <img src={TRUMP_PROFILE_PICTURE} alt="Donald Trump" className="w-12 h-12 rounded-full border-2 border-yellow-500 object-cover"/>
                    <div>
                        <h1 className="text-xl font-bold text-white">AI Donald Trump</h1>
                        <p className="text-sm text-gray-400">Making Chat Great Again</p>
                    </div>
                </div>
                <LanguageSelector selectedLanguage={language} onLanguageChange={handleLanguageChange} />
            </header>

            <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.map((msg) => (
                    <ChatMessageComponent key={msg.id} message={msg} onPlayAudio={handlePlayAudio} />
                ))}
                {isTextLoading && (
                     <div className="flex justify-start items-center space-x-3">
                        <img src={TRUMP_PROFILE_PICTURE} alt="Donald Trump" className="w-10 h-10 rounded-full border-2 border-yellow-500 object-cover opacity-0"/>
                        <div className="bg-gray-700 p-3 rounded-lg flex items-center space-x-2">
                           <LoadingIcon />
                           <span className="text-gray-300 italic">The best words are coming...</span>
                        </div>
                    </div>
                )}
            </main>

            <footer className="p-4 bg-gray-800 border-t border-gray-700">
                {error && <p className="text-red-500 text-center text-sm mb-2">{error}</p>}
                <div className="max-w-3xl mx-auto flex items-center space-x-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask me anything. It'll be huge."
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-full py-3 px-5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
                        disabled={isRecording || isTextLoading}
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isRecording || isTextLoading}
                        className="bg-yellow-500 text-gray-900 font-bold p-3 rounded-full hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                       <SendIcon />
                    </button>
                    <MicButton isRecording={isRecording} onToggleRecording={handleToggleRecording} disabled={isTextLoading}/>
                </div>
            </footer>
        </div>
    );
};

export default App;