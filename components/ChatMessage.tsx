import React from 'react';
import { type ChatMessage } from '../types';
import { SpeakerIcon, LoadingIcon } from './Icons';
import { TRUMP_PROFILE_PICTURE } from '../assets';

interface ChatMessageProps {
    message: ChatMessage;
    onPlayAudio?: (audioData: Uint8Array) => void;
}

const UserMessage: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex justify-end">
        <div className="bg-yellow-500 text-gray-900 font-medium rounded-l-lg rounded-br-lg p-3 max-w-lg">
            {text}
        </div>
    </div>
);

const AudioButton: React.FC<{ message: ChatMessage; onPlayAudio?: (audioData: Uint8Array) => void; }> = ({ message, onPlayAudio }) => {
    if (message.isAudioLoading) {
        return (
            <div className="flex items-center space-x-2 mt-3 bg-gray-600 text-gray-300 px-3 py-1 rounded-full text-sm font-bold cursor-wait">
               <LoadingIcon />
               <span>Generating Voice...</span>
            </div>
        );
    }

    if (message.audioData && onPlayAudio) {
        return (
            <button 
                onClick={() => onPlayAudio(message.audioData!)} 
                className="flex items-center space-x-2 mt-3 bg-yellow-500 text-gray-900 px-3 py-1 rounded-full hover:bg-yellow-400 transition-colors text-sm font-bold"
                aria-label="Play audio message"
            >
               <SpeakerIcon />
               <span>Play Voice</span>
            </button>
        );
    }

    return null;
}

const ModelMessage: React.FC<{ message: ChatMessage; onPlayAudio?: (audioData: Uint8Array) => void; }> = ({ message, onPlayAudio }) => (
    <div className="flex justify-start items-start space-x-3">
        <img src={TRUMP_PROFILE_PICTURE} alt="Donald Trump" className="w-10 h-10 rounded-full border-2 border-yellow-500 object-cover"/>
        <div className="flex flex-col space-y-2 max-w-lg">
            <div className="bg-gray-700 text-white rounded-r-lg rounded-bl-lg p-3">
                <p>{message.text}</p>
                <AudioButton message={message} onPlayAudio={onPlayAudio} />
            </div>
            {message.sources && message.sources.length > 0 && (
                <div className="text-xs text-gray-400">
                    <h4 className="font-bold mb-1">Sources:</h4>
                    <ul className="space-y-1 list-disc list-inside">
                        {message.sources.map((source, index) => (
                            <li key={index}>
                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 underline truncate">
                                    {source.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    </div>
);

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, onPlayAudio }) => {
    return message.role === 'user' 
        ? <UserMessage text={message.text} /> 
        : <ModelMessage message={message} onPlayAudio={onPlayAudio} />;
};