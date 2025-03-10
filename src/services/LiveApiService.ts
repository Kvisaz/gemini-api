import {MultimodalLiveClient,} from "../lib/multimodal-live-client";
import {LiveConfig} from "../multimodal-live-types";
import {AudioStreamer} from "../lib/audio-streamer";
import {audioContext} from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

interface IApiArgs {
    url: string,
    apiKey: string
}

const defaultConfig: LiveConfig = {model: "models/gemini-2.0-flash-exp"};

export class LiveApiService {
    private readonly client: MultimodalLiveClient;
    private audioStreamer: AudioStreamer | undefined;
    private config: LiveConfig = defaultConfig;
    volume = 0;
    duration = 0;
    private _connected = false;

    get connected() {
        return this._connected;
    }

    private set connected(connected: boolean) {
        this._connected = connected;
    }

    constructor(private apiArgs: IApiArgs) {
        this.client = new MultimodalLiveClient(apiArgs);
        this.setupAudioStreamer()
            .then((audioStreamer) => this.subcribeToEvents(audioStreamer))
            .catch(console.warn);
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

    private subcribeToEvents(audioStreamer: AudioStreamer): () => void {
        const {client} = this;

        const onClose = () => this.connected = false;
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

    async connect(config: LiveConfig) {
        const {client, audioStreamer} = this;
        await client.connect(config);
        this.connected = true;
        console.log('client is Connected! for config', config);
        if (audioStreamer == null) {
            console.warn('audioStreamer==null');
            return;
        }
        await audioStreamer.resume();
    }

    disconnect() {
        const {client, audioStreamer} = this;
        this.connected = false;
        audioStreamer?.stop();
        client.disconnect();
    }

}
