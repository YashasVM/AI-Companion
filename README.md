# AI Desktop Companion (Glitch)

An AI companion that lives on your desktop, understands context from your screen, and can execute real actions.
Maintained by `YashasVM`.

<p align="center">
  <img src="./assets/anim.gif" width="70%" />
</p>

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.2-green.svg)](#)
[![Platform](https://img.shields.io/badge/platform-Windows-darkgrey.svg)](#)

---

## What It Does

Glitch combines:
- screen understanding (vision),
- voice interaction,
- automation (mouse, keyboard, shell, app launch),
- and a desktop overlay interface with character interaction.

It is basically the assistant that escaped the browser tab and now pays rent on your desktop.

---

## Screenshots

### Desktop Overlay
<p align="center">
  <img src="./assets/overlay.png" width="80%">
</p>

### Modes
<p align="center">
  <img src="./assets/modes.png" width="70%">
</p>

### Agent Panel
<p align="center">
  <img src="./assets/agent.png" width="80%">
</p>

### Developer Workflow
<p align="center">
  <img src="./assets/developer.png" width="80%">
</p>

### Notes and Summaries
<p align="center">
  <img src="./assets/Notepad.png" width="80%">
</p>

### Web Search Automation
<p align="center">
  <img src="./assets/googleSearch.png" width="80%">
</p>

### Character System
<p align="center">
  <img src="./assets/character.png" width="60%">
</p>

---

## Demo

- Full demo (Vimeo): https://vimeo.com/1150677379  
- Landing page: https://ai-desktop-companion-glitch.vercel.app/

---

## 1) Quick Start (For Non-Technical Users)

If you just want to install and use the app:

1. Download the Windows installer (`.exe`):  
   **Direct download:**  
   https://github.com/YashasVM/AI-Companion/releases/latest/download/AI%20Desktop%20Companion%20Setup%201.0.1.exe
2. Run the installer.
3. Launch **AI Desktop Companion**.
4. In setup, choose provider:
   - `Gemini` (cloud, full voice + realtime flow), or
   - `Ollama` (local LLM option).
5. Start using:
   - `Mic` for voice mode,
   - `Vision` to allow screen understanding,
   - `Agent` for autonomous tasks.

### Minimum Requirements

- Windows 10/11
- Microphone (recommended)
- Internet for Gemini mode
- Optional: local Ollama install for offline/local mode

---

## 2) Advanced Setup (For Developers)

### Tech Stack

- Electron
- Bun (runtime/package manager)
- Google Gemini SDK + Gemini Live
- Optional Ollama local provider
- `@nut-tree-fork/nut-js` + Python bridge for low-level input automation

### Prerequisites

- Bun: https://bun.sh/
- Python 3.8+
- Optional: Ollama (if using local model): https://ollama.com/

### Installation

```bash
git clone https://github.com/YashasVM/AI-Companion.git
cd AI-Companion
bun install
pip install -r requirements.txt
```

### Run

```bash
bun run start
```

### Useful Bun Commands

```bash
bun run start       # Run app
bun run dev         # Run with Electron dev flag
bun run build:win   # Build Windows installer (.exe)
```

### Environment Variables

Configuration can be done in the setup wizard or with `.env`:

```env
# Provider: gemini | ollama
LLM_PROVIDER=gemini

# Gemini
GOOGLE_API_KEY=your_gemini_key
GEMINI_VOICE_NAME=Puck

# Ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

### Project Structure

```txt
ai-companion/
├── src/
│   ├── ai/                 # Agent logic
│   ├── services/           # AI/automation/input/capture services
│   ├── renderer.js         # Frontend runtime
│   ├── main.js             # Electron main process
│   └── setup-wizard.html   # Onboarding UI
├── assets/                 # Images, media
├── dist/                   # Build output
└── package.json
```

### Build Output

After `bun run build:win`, installer is generated in:

```txt
dist/AI Desktop Companion Setup 1.0.1.exe
```

### Troubleshooting

- If automation fails:
  - Reinstall Python dependencies:
    `pip install -r requirements.txt`
- If Ollama mode does not respond:
  - Ensure Ollama is running (`ollama serve`)
  - Ensure selected model exists (`ollama list`)
- If voice mode is unavailable:
  - Switch provider to `Gemini` (realtime voice path currently tied to Gemini).

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License. See [LICENSE](LICENSE).

---
---
@@ -282,3 +294,6 @@ This project is licensed under the [MIT License](LICENSE).
<p align="center">
  Made with ❤️ by Kirthan NB & Rohith M
</p>
---
