import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client using either Vertex AI (Google Cloud) or general API Key
// We default to Vertex AI for the "SovereignAI" project vision if running in GCP.
export function getGeminiClient(): GoogleGenAI {
    const isVertex = process.env.USE_VERTEX_AI === 'true';

    if (isVertex) {
        return new GoogleGenAI({
            vertexai: {
                project: process.env.GOOGLE_CLOUD_PROJECT || 'sovereign-ai',
                location: process.env.GOOGLE_CLOUD_LOCATION || 'europe-west4',
            } as any
        });
    }

    // Fallback to standard API key (e.g. for local dev without gcloud auth)
    return new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });
}
