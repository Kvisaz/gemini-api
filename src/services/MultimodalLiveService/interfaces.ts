import type {Content, FunctionCall, GenerationConfig, GenerativeContentBlob, Part, Tool} from '@google/generative-ai';

export type IdsField = { ids: string[] };
export type PartsField = { parts: Part[] };

export interface ILiveFunctionCall extends FunctionCall {
    name: string;
    args: object;
    id: string;
}

export interface ILiveFunctionResponse {
    response: object;
    id: string;
}

export interface IModelTurnMessage {
    modelTurn: PartsField;
}



export interface ILiveConfig {
    model: string;
    systemInstruction?: PartsField;
    generationConfig?: Partial<ILiveGenerationConfig>;
    tools?: Array<Tool | { googleSearch: {} } | { codeExecution: {} }>;
}

export interface ILiveGenerationConfig extends GenerationConfig {
    responseModalities: "text" | "audio" | "image";
    speechConfig?: {
        voiceConfig?: {
            prebuiltVoiceConfig?: {
                voiceName: "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede" | string;
            };
        };
    };
}


export interface IServerContent {
    modelTurn?: PartsField;
    turnComplete?: boolean;
    interrupted?: true
}

export interface ILiveIncomingMessage {
    toolCallCancellation?: IdsField;
    toolCall?: IToolCall;
    serverContent?: IServerContent;
    setupComplete?: {}
}


export interface IRealtimeInputMessage {
    realtimeInput: {
        mediaChunks: GenerativeContentBlob[];
    };
}

export interface IToolCall {
    functionCalls: ILiveFunctionCall[];
}

export interface IToolResponse {
    functionResponses: ILiveFunctionResponse[];
}

export interface IToolResponseMessage {
    toolResponse: IToolResponse;
}


export interface IClientContentMessage {
    clientContent: {
        turns: Content[];
        turnComplete: boolean;
    };
}

export interface ISetupMessage {
    setup: ILiveConfig;
}

export interface IStreamingLog {
    date: Date;
    type: string;
    count?: number;
    message: string | LiveOutgoingMessage | ILiveIncomingMessage;
}

export interface IClientContentMessage {
    clientContent: {
        turns: Content[];
        turnComplete: boolean;
    };
}

export type LiveOutgoingMessage =
    | ISetupMessage
    | IClientContentMessage
    | IRealtimeInputMessage
    | IToolResponseMessage;
