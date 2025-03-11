import {Content, GenerativeContentBlob, Part} from '@google/generative-ai';
import {
    IClientContentMessage,
    IdsField,
    ILiveConfig,
    ILiveIncomingMessage,
    IModelTurnMessage,
    IRealtimeInputMessage,
    ISetupMessage,
    IStreamingLog,
    IToolCall,
    IToolResponse,
    IToolResponseMessage
} from './interfaces';
import {base64ToArrayBuffer, blobToJSON} from './utils';

export interface IEventHandler {
    toolCall?: (data: IToolCall) => void;
    toolCancel?: (data: IdsField) => void;
    setupComplete?: (data: {}) => void;
    serverInterrupted?: () => void;
    serverTurnComplete?: () => void;
    serverAudio?: (data: ArrayBufferLike) => void;
    serverCommonContent?: (data: IModelTurnMessage) => void;
}

interface IMultimodalLiveServiceProps {
    url: string;
    apiKey: string;
    config: ILiveConfig;
    responseHandlers?: IEventHandler
    log?: (message: IStreamingLog) => void;
}

export class MultimodalLiveService {
    private ws: WebSocket | undefined;

    constructor(private props: IMultimodalLiveServiceProps) {
        // в оригинале конструктор был нужен для инициализации url
        // и конструктора эвентэмиттера
        // так что тут делаем пусто
    }

    /** эта функция в оригинале использовала переброску сообщений на шину данных **/
    log(type: string, message: IStreamingLog["message"]) {
        this.props.log?.({
            date: new Date(),
            type,
            message,
        });
    }

    /** cердце! по сути это функция! **/
    connect(): Promise<boolean> {
        const {url, config} = this.props;
        const ws = new WebSocket(url);
        this.ws = ws;

        const disConnect = () => {
            ws.close();
        }

        /** сообщения сокета кидаются на собственный дешифратор **/
        ws.addEventListener("message", async (evt: MessageEvent) => {
            if (evt.data instanceof Blob) {
                this.receive(evt.data).catch(console.warn)
            } else {
                console.log("non blob message", evt);
            }
        });

        /** затем следует промисификация ОТКРЫТИЯ СОКЕТА **/
        return new Promise((resolve, reject) => {
            const onError = (ev: Event) => {
                disConnect();
                const message = `Could not connect to "${this.props.url}"`;
                this.log(`server.${ev.type}`, message);
                reject(new Error(message));
            };
            ws.addEventListener("error", onError);
            ws.addEventListener("open", (ev: Event) => {
                this.log(`client.${ev.type}`, `connected to socket`);

                const setupMessage: ISetupMessage = {
                    setup: config,
                };
                this._sendDirect(setupMessage);
                this.log("client.send", "setup");

                ws.removeEventListener("error", onError);
                ws.addEventListener("close", (ev: CloseEvent) => {
                    console.log(ev);
                    disConnect();
                    let reason = ev.reason || "";
                    if (reason.toLowerCase().includes("error")) {
                        const prelude = "ERROR]";
                        const preludeIndex = reason.indexOf(prelude);
                        if (preludeIndex > 0) {
                            reason = reason.slice(
                                preludeIndex + prelude.length + 1,
                                Infinity,
                            );
                        }
                    }
                    this.log(
                        `server.${ev.type}`,
                        `disconnected ${reason ? `with reason: ${reason}` : ``}`,
                    );
                });
                resolve(true);
            });
        });
    }


    disconnect() {
        if (!this.ws) return false;
        this.ws.close();
        this.ws = undefined;
        this.log("client.close", `Disconnected`);
        return true;
    }

    /**
     * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
     */
    sendRealtimeInput(chunks: GenerativeContentBlob[]) {
        let hasAudio = false;
        let hasVideo = false;
        for (let i = 0; i < chunks.length; i++) {
            const ch = chunks[i];
            if (ch.mimeType.includes("audio")) {
                hasAudio = true;
            }
            if (ch.mimeType.includes("image")) {
                hasVideo = true;
            }
            if (hasAudio && hasVideo) {
                break;
            }
        }
        const message =
            hasAudio && hasVideo
                ? "audio + video"
                : hasAudio
                    ? "audio"
                    : hasVideo
                        ? "video"
                        : "unknown";

        const data: IRealtimeInputMessage = {
            realtimeInput: {
                mediaChunks: chunks,
            },
        };
        this._sendDirect(data);
        this.log(`client.realtimeInput`, message);
    }

    sendToolResponse(toolResponse: IToolResponse) {
        const message: IToolResponseMessage = {
            toolResponse,
        };

        this._sendDirect(message);
        this.log(`client.toolResponse`, message);
    }

    /**
     * send normal content parts such as { text }
     */
    send(parts: Part | Part[], turnComplete: boolean = true) {
        parts = Array.isArray(parts) ? parts : [parts];
        const content: Content = {
            role: "user",
            parts,
        };

        const clientContentRequest: IClientContentMessage = {
            clientContent: {
                turns: [content],
                turnComplete,
            },
        };

        this._sendDirect(clientContentRequest);
        this.log(`client.send`, clientContentRequest);
    }

    protected async receiveMessage(blob: Blob | unknown): Promise<ILiveIncomingMessage | undefined> {
        if (!(blob instanceof Blob)) {
            console.warn('not blob received');
            return;
        }

        try {
            return (await blobToJSON(blob)) as ILiveIncomingMessage;
        } catch (e) {
            console.warn('blobToJSON error', e);
        }
    }

    protected async receive(blob: Blob | unknown) {
        const message = await this.receiveMessage(blob);
        if (message == null) return;

        const {responseHandlers} = this.props;
        const {toolCall, toolCallCancellation, serverContent, setupComplete} = message;

        if (toolCall) {
            responseHandlers?.toolCall?.(toolCall);
            return;
        }
        if (toolCallCancellation) {
            responseHandlers?.toolCancel?.(toolCallCancellation);
            return;
        }
        if (setupComplete) {
            responseHandlers?.setupComplete?.(setupComplete);
            return;
        }

        if (serverContent) {
            if (serverContent.interrupted) {
                responseHandlers?.serverInterrupted?.();
                return;
            }
            if (serverContent.turnComplete) {
                responseHandlers?.serverTurnComplete?.();
            }

            if (serverContent.modelTurn) {
                let parts: Part[] = serverContent.modelTurn.parts;
                const audioParts: Part[] = [];
                const otherParts: Part[] = [];
                serverContent.modelTurn.parts.forEach(p => {
                    const isAudio = p.inlineData && p.inlineData.mimeType.startsWith("audio/pcm");
                    if (isAudio) {
                        audioParts.push(p);
                        return;
                    }
                    otherParts.push(p);
                })
                const base64s = audioParts.map((p) => p.inlineData?.data);

                base64s.forEach((b64) => {
                    if (b64) {
                        const data = base64ToArrayBuffer(b64);
                        responseHandlers?.serverAudio?.(data);
                    }
                });
                if (!otherParts.length) {
                    return;
                }

                parts = otherParts;

                const content: IModelTurnMessage = {modelTurn: {parts}};
                responseHandlers?.serverCommonContent?.(content);
            }
        } else {
            console.log("received unmatched message", message);
        }
    }

    /**
     *  used internally to send all messages
     *  don't use directly unless trying to send an unsupported message type
     */
    _sendDirect(request: object) {
        if (!this.ws) {
            throw new Error("WebSocket is not connected");
        }
        const str = JSON.stringify(request);
        this.ws.send(str);
    }

}
