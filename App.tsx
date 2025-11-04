import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

// Helper function to decode base64 string to Uint8Array
const decode = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper function to create a WAV file Blob from raw PCM data
const pcmToWav = (pcmData: Uint8Array, sampleRate: number, numChannels: number): Blob => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    const dataSize = pcmData.byteLength;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const fileSize = 36 + dataSize;

    writeString(0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([header, pcmData], { type: 'audio/wav' });
};


const LoaderIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const App: React.FC = () => {
    const [text, setText] = useState<string>('ہیلو دنیا، آپ کیسے ہیں؟');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const handleGenerateSpeech = useCallback(async () => {
        if (!text.trim()) {
            setError('Please enter some text to generate speech.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setAudioUrl(null);

        try {
            if (!process.env.API_KEY) {
                throw new Error("API key is not configured. Please set the API_KEY environment variable.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const prompt = `Say with a powerful and impactful voice in Urdu: ${text}`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
                const pcmData = decode(base64Audio);
                const wavBlob = pcmToWav(pcmData, 24000, 1); // Gemini TTS uses 24000Hz sample rate, mono channel
                const url = URL.createObjectURL(wavBlob);
                setAudioUrl(url);
            } else {
                throw new Error("No audio data received from the API.");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, [text]);

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 transform transition-all duration-500">
                <header className="text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-blue-400 to-purple-500">
                        Urdu Impactful Voice TTS
                    </h1>
                    <p className="text-gray-400 mt-2 text-lg">
                        Convert Urdu text into powerful, high-quality speech.
                    </p>
                </header>

                <div className="space-y-4">
                    <label htmlFor="text-input" className="block text-sm font-medium text-gray-300">
                        Enter your Urdu text below
                    </label>
                    <textarea
                        id="text-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="یہاں اپنا متن درج کریں..."
                        rows={6}
                        className="w-full bg-gray-700 border-2 border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-300 text-lg"
                        disabled={isLoading}
                    />
                </div>

                <button
                    onClick={handleGenerateSpeech}
                    disabled={isLoading || !text.trim()}
                    className="w-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 text-lg"
                >
                    {isLoading ? (
                        <>
                            <LoaderIcon />
                            Generating...
                        </>
                    ) : (
                        "Generate Speech"
                    )}
                </button>

                {error && (
                    <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                {audioUrl && !isLoading && (
                    <div className="mt-6 space-y-3">
                        <h3 className="text-xl font-semibold text-center">Generated Audio</h3>
                        <audio controls src={audioUrl} className="w-full">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}
            </div>
            <footer className="text-center text-gray-500 mt-8">
                <p>Powered by Gemini API</p>
            </footer>
        </div>
    );
};

export default App;
