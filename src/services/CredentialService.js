const Store = require('electron-store');
const fs = require('fs');
const path = require('path');
// [FIX] Explicit path for production (.env is in app root, CredentialService is in src/services/)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class CredentialService {
    constructor() {
        this.store = new Store({
            encryptionKey: 'ai-companion-secure-storage', // Basic obfuscation
            name: 'user-credentials'
        });
    }

    /**
     * Initialize credentials from .env if available (migration/dev mode)
     */
    async loadCredentials() {
        // 1. Try to load from Store first
        let geminiKey = this.store.get('google_api_key');

        // 2. Fallback to process.env
        const envGemini = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

        // --- GEMINI LOGIC ---
        let usingDefaultGemini = false;
        // If stored key matches .env key (from old migration), treat as default
        if (geminiKey && geminiKey === envGemini) {
            usingDefaultGemini = true;
            this.store.delete('google_api_key');
            geminiKey = envGemini;
        }
        else if (!geminiKey && envGemini) {
            geminiKey = envGemini;
            usingDefaultGemini = true;
        }

        // 3. Inject back into process.env so the rest of the app works seamlessly
        if (geminiKey) {
            process.env.GOOGLE_API_KEY = geminiKey;
            process.env.GEMINI_API_KEY = geminiKey;
        }

        // --- VOICE LOGIC ---
        let geminiVoice = this.store.get('gemini_voice_name') || "Puck";
        process.env.GEMINI_VOICE_NAME = geminiVoice;

        // --- PROVIDER LOGIC ---
        const llmProvider = this.store.get('llm_provider') || process.env.LLM_PROVIDER || 'gemini';
        const ollamaBaseUrl = this.store.get('ollama_base_url') || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        const ollamaModel = this.store.get('ollama_model') || process.env.OLLAMA_MODEL || 'llama3.1:8b';

        process.env.LLM_PROVIDER = llmProvider;
        process.env.OLLAMA_BASE_URL = ollamaBaseUrl;
        process.env.OLLAMA_MODEL = ollamaModel;

        const hasOllamaConfig = !!(ollamaBaseUrl && ollamaModel);
        const isComplete = llmProvider === 'ollama' ? hasOllamaConfig : !!geminiKey;

        return {
            geminiKey,
            usingDefaultGemini,
            geminiVoice, // [NEW] Return voice
            llmProvider,
            ollamaBaseUrl,
            ollamaModel,
            isComplete
        };
    }

    saveCredentials({ geminiKey, geminiVoice, llmProvider, ollamaBaseUrl, ollamaModel }) {
        if (geminiKey) this.store.set('google_api_key', geminiKey);
        else if (geminiKey === '') this.store.delete('google_api_key');

        if (geminiVoice) this.store.set('gemini_voice_name', geminiVoice);
        if (llmProvider) this.store.set('llm_provider', llmProvider);
        if (ollamaBaseUrl) this.store.set('ollama_base_url', ollamaBaseUrl);
        if (ollamaModel) this.store.set('ollama_model', ollamaModel);

        // Update current session
        if (geminiKey) {
            process.env.GOOGLE_API_KEY = geminiKey;
            process.env.GEMINI_API_KEY = geminiKey;
        }
        if (geminiVoice) {
            process.env.GEMINI_VOICE_NAME = geminiVoice;
        }
        if (llmProvider) {
            process.env.LLM_PROVIDER = llmProvider;
        }
        if (ollamaBaseUrl) {
            process.env.OLLAMA_BASE_URL = ollamaBaseUrl;
        }
        if (ollamaModel) {
            process.env.OLLAMA_MODEL = ollamaModel;
        }
    }

    clearCredentials() {
        this.store.delete('google_api_key');
        this.store.delete('gemini_voice_name');
        this.store.delete('llm_provider');
        this.store.delete('ollama_base_url');
        this.store.delete('ollama_model');
        this.store.delete('eleven_api_key');
        this.store.delete('eleven_voice_id');
    }
}

module.exports = new CredentialService();
