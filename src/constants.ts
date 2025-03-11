import {functionDeclarations} from './functionDeclarations';
import {LiveConfig} from './multimodal-live-types';

export const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
if (typeof API_KEY !== "string") {
    throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

export const API_HOST = "generativelanguage.googleapis.com";
export const API_WEBSOCKET_URI = `wss://${API_HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

export const API_CONFIG: LiveConfig = {
    model: "models/gemini-2.0-flash-exp",
    generationConfig: {
        responseModalities: "audio",
        speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: "Aoede"}},
        },
    },
    systemInstruction: {
        parts: [
            {
                text: 'You are my helpful assistant. Any time I ask you for a graph call the "render_altair" function I have provided you. Dont ask for additional information just make your best judgement.',
            },
        ],
    },
    tools: [
        {googleSearch: {}},
        {functionDeclarations},
    ],
}
