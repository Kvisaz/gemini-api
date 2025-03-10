export const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
    throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

export const API_HOST = "generativelanguage.googleapis.com";
export const API_URI = `wss://${API_HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
