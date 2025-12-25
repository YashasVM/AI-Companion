# 🤖 AI Desktop Companion - User Manual

Congratulations! You have successfully built a fully functional AI Desktop Companion. Here is everything you need to know about using it.

## 🚀 How to Run
1. Open your terminal in `D:\AI-Companion`.
2. Run the start command:
   ```bash
   npm start
   ```
3. The companion will appear as a floating overlay on your desktop.

## 🎮 Controls

### 🎤 Voice Conversation
- **Click the Microphone Button** (bottom center) to start listening.
- **Speak naturally**. The listening indicator will wave 🌊.
- The companion will think 🤔 and then reply with **Voice** and a **Text Bubble**.

### 🖱️ Mouse Interaction
- **Click Through**: You can click on your desktop icons/wallpaper *through* the empty parts of the window.
- **Click Character**: Click the robot 🤖 to make it jump/interact.
- **Hover UI**: Hover over the bottom controls or top header to make them clickable.

## 🧠 Capabilities

### 1. Chat (Gemini 2.5 Flash)
Ask general questions, tell jokes, or just chat. The personality is set to be "witty and helpful".
> "Tell me a joke."
> "Who are you?"

### 2. Vision (Screen Capture) 👁️
Ask the companion to look at your screen.
> "What is on my screen?"
> "Do you see this image?"
> "Help me with this code on my screen."

### 3. Browser Automation 🌐
Ask the companion to open websites or search the web.
> "Open YouTube."
> "Search for weather in Tokyo."
> "Open Google."
*(A separate browser window will open to perform these tasks)*

## 🛠️ Customization
- **Character**: Edit `initPixi()` in `src/renderer.js` to change the robot's colors or shape.
- **Voice**: Change `ELEVEN_MODEL` or `voiceId` in `src/renderer.js`.
- **System Prompt**: Edit the `systemPrompt` variable in `processUserMessage` in `src/renderer.js` to change its personality.

## ⚠️ Troubleshooting
- **Mic not working?** Ensure your default system microphone is set.
- **Vision not working?** Sometimes screen capture requires system permissions (on Mac specifically, but on Windows usually fine).
- **Browser error?** Ensure you ran `npm install playwright`.

Enjoy your new AI friend! 🤖✨
