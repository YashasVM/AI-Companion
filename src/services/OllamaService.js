const fetch = require('node-fetch');

class OllamaService {
    constructor(baseUrl = 'http://127.0.0.1:11434', model = 'llama3.1:8b') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.model = model;
    }

    async chat({ prompt, systemPrompt = '', imageBase64 = null }) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        const userMessage = {
            role: 'user',
            content: prompt || ''
        };

        if (imageBase64) {
            userMessage.images = [imageBase64];
        }

        messages.push(userMessage);

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                stream: false,
                options: {
                    temperature: 0.3
                },
                messages
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Ollama request failed (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data?.message?.content || '';
    }
}

module.exports = OllamaService;
