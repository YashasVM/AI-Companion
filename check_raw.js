require('dotenv').config();
const axios = require('axios');

async function checkDirect() {
    const key = process.env.GEMINI_API_KEY;
    const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    console.log(`Testing URL: ${url.replace(key, "HIDDEN_KEY")}`);

    try {
        const response = await axios.post(url, {
            contents: [{
                parts: [{ text: "Hello" }]
            }]
        });
        console.log("Success: ", response.status);
        console.log(response.data);
    } catch (error) {
        console.log("Error Status:", error.response?.status);
        console.log("Error Data:", JSON.stringify(error.response?.data, null, 2));
    }
}

checkDirect();
