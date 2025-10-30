
import React from 'react';
import { MicIcon } from './Icons';

interface MicButtonProps {
    isRecording: boolean;
    onToggleRecording: () => void;
    disabled: boolean;
}

export const MicButton: React.FC<MicButtonProps> = ({ isRecording, onToggleRecording, disabled }) => {
    const recordingClasses = "bg-red-600 animate-pulse";
    const idleClasses = "bg-yellow-500";
    const hoverClasses = "hover:bg-red-500";

    return (
        <button
            onClick={onToggleRecording}
            disabled={disabled}
            className={`text-gray-900 font-bold p-3 rounded-full transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed ${isRecording ? recordingClasses : `${idleClasses} ${hoverClasses}`}`}
        >
            <MicIcon />
        </button>
    );
};
