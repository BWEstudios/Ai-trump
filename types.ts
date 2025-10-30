export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    audioData?: Uint8Array;
    isAudioLoading?: boolean;
    sources?: GroundingSource[];
}

export interface GroundingSource {
    title: string;
    uri: string;
}

export enum Language {
    ENGLISH = 'en',
    JAPANESE = 'ja',
}