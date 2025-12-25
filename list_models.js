require('dotenv').config();
const axios = require('axios');

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    console.log("Listing models...");

    try {
        const response = await axios.get(url);
        console.log("Available Models:");
        const models = response.data.models;
        models.forEach(m => {
            console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
        });
    } catch (error) {
        console.log("Error Status:", error.response?.status);
        console.log("Error Data:", JSON.stringify(error.response?.data, null, 2));
    }
}

listModels();
