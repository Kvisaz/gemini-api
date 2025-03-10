import {MultimodalLiveClient,} from "../lib/multimodal-live-client";
import {LiveConfig} from "../multimodal-live-types";
import {AudioStreamer} from "../lib/audio-streamer";
import {audioContext} from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

interface IApiArgs {
    url: string;
    apiKey: string;
    config: LiveConfig;
    onSetup?: (message: { error?: string }) => void;
}

export class LiveApiService {
    private readonly client: MultimodalLiveClient;
    private audioStreamer: AudioStreamer | undefined;
    private isConnected = false;
    volume = 0;
    duration = 0;


    constructor(private apiArgs: IApiArgs) {
        this.client = new MultimodalLiveClient(apiArgs);
        this.setupAudioStreamer()
            .then((audioStreamer) => this.subscribeToEvents(audioStreamer))
            .then(() => {
                apiArgs.onSetup?.({})
            })
            .catch(e => {
                apiArgs.onSetup?.({error: e.toString()});
            });
    }

    private async setupAudioStreamer() {
        const audioCtx = await audioContext({id: "audio-out"});
        const audioStreamer = new AudioStreamer(audioCtx);
        audioStreamer.onDurationUpdate = (duration) => {
            this.duration = duration;
        }
        audioStreamer.onComplete = () => {
            console.log('Audio playback completed. Total duration:', this.duration.toFixed(2), 'seconds');
        }

        await audioStreamer.addWorklet<any>("vumeter-out", VolMeterWorket, (ev: { data: { volume: number } }) => {
            this.volume = ev.data.volume;
        });
        return audioStreamer;
    }

    private subscribeToEvents(audioStreamer: AudioStreamer): () => void {
        const {client} = this;
        this.audioStreamer = audioStreamer;
        const onClose = () => this.isConnected = false;
        const stopAudioStreamer = () => audioStreamer.stop();
        const onAudio = (data: ArrayBuffer) =>
            audioStreamer.addPCM16(new Uint8Array(data));

        client
            .on("close", onClose)
            .on("interrupted", stopAudioStreamer)
            .on("audio", onAudio)
        //.on("setupcomplete", onSetupComplete);

        return () => {
            client
                .off("close", onClose)
                .off("interrupted", stopAudioStreamer)
                .off("audio", onAudio)
            //.off("setupcomplete", onSetupComplete);
        };
    }

    async connect() {
        const {client, audioStreamer, apiArgs} = this;
        await client.connect(apiArgs.config);
        this.isConnected = true;
        console.log('client is Connected! for config', apiArgs.config);
        if (audioStreamer == null) {
            console.warn('audioStreamer==null');
            return;
        }
        await audioStreamer.resume();
    }

    disconnect() {
        const {client, audioStreamer} = this;
        this.isConnected = false;
        audioStreamer?.stop();
        client.disconnect();
    }

    switchConnection() {
        if (this.isConnected) this.disconnect();
        else this.connect().catch(console.warn);
    }
}
