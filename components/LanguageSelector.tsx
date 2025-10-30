
import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
    selectedLanguage: Language;
    onLanguageChange: (language: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedLanguage, onLanguageChange }) => {
    const baseClasses = "px-4 py-2 text-sm font-bold transition-colors";
    const activeClasses = "bg-yellow-500 text-gray-900";
    const inactiveClasses = "bg-gray-700 text-white hover:bg-gray-600";

    return (
        <div className="flex rounded-lg overflow-hidden border border-gray-600">
            <button
                onClick={() => onLanguageChange(Language.ENGLISH)}
                className={`${baseClasses} ${selectedLanguage === Language.ENGLISH ? activeClasses : inactiveClasses}`}
            >
                EN
            </button>
            <button
                onClick={() => onLanguageChange(Language.JAPANESE)}
                className={`${baseClasses} ${selectedLanguage === Language.JAPANESE ? activeClasses : inactiveClasses}`}
            >
                JA
            </button>
        </div>
    );
};
