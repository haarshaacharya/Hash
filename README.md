# Hash — Studio Video & Audio Downloader

A modern, high-performance personal video and MP3 audio downloader with a Flask backend and a modern SaaS-grade web interface. It uses `yt-dlp` and `ffmpeg` to inspect, upscale, and download supported media URLs locally on your computer in both MP4 Video and MP3 Audio formats.

## ✨ Features
- **Dual Format Support**: One-click toggle between **MP4 Video** and **MP3 Audio** extraction.
- **MP3 Studio Quality**: Choose from 320 kbps (Studio), 256 kbps (High Fidelity), 192 kbps (Standard), or 128 kbps (Compact).
- **Smart Stream Quality**: For MP4, choose from Original (Best Available), 1080p Full HD, 720p HD, and AI Lanczos-upscaled 2K (1440p).
- **Audio Control**: Option to download MP4 videos with sound or muted (no sound).
- **Modern Studio Interface**: Sleek dark/light theme switcher with glassmorphism and ambient glow effects.
- **Multi-Platform Support**: Instagram Reels, YouTube Videos & Shorts, Facebook Watch, and Pinterest Pins.
- **One-Click Clipboard**: Instant URL paste button and live platform auto-detection as you type.
- **Recent Session History**: Built-in history to re-load or review your downloaded MP4 and MP3 files.
- **100% Private & Local**: Runs entirely on your local machine with zero external analytics or trackers.

## Requirements
- Python 3.10+
- Internet access
- FFmpeg recommended for merging video/audio streams and 2K upscaling (`python -m pip install imageio-ffmpeg` or system FFmpeg)

## Run on Windows
1. Open PowerShell or Command Prompt in this folder.
2. Create and activate a virtual environment (recommended):
   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
4. Start the app:
   ```bash
   python app.py
   ```
5. Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Run on macOS/Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```
Then open [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Offline UI Preview
You can directly open `preview.html` in any browser to inspect the complete front-end design without starting the Python server.
