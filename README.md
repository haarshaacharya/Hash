# Hash — Studio Video, Audio & Reel Editor

A modern, high-performance personal video downloader, MP3 audio extractor, and Reel Studio editor with a Flask backend and SaaS-grade web interface. It uses `yt-dlp` and `ffmpeg` to inspect, upscale, clean watermarks, and edit text on reels locally on your computer.

## ✨ Features
- **Reel Studio (Watermark & Logo Inpainter)**: Permanently remove channel logos, icons, and badges (e.g. corner logos like in the top-right) using smart FFmpeg `delogo` inpainting without leaving blur marks.
- **In-Reel Text Remover & Replacer**: Erase hardcoded quotes/text from reels (e.g. center quotes like *"This life or nothing."*) and optionally replace them with your own custom text, font size, and color.
- **Interactive Live Preview Canvas**: See exact removal and text bounding boxes right on the reel thumbnail with 1-click positioning presets or custom coordinate sliders.
- **Dual Format Support**: One-click toggle between **MP4 Video** and **MP3 Audio** extraction.
- **MP3 Studio Quality**: Choose from 320 kbps (Studio), 256 kbps (High Fidelity), 192 kbps (Standard), or 128 kbps (Compact).
- **Smart Stream Quality**: For MP4, choose from Original (Best Available), 1080p Full HD, 720p HD, and AI Lanczos-upscaled 2K (1440p).
- **Audio Control**: Option to download MP4 videos with sound or muted (no sound).
- **Modern Studio Interface**: Sleek dark/light theme switcher with glassmorphism and ambient glow effects.
- **Multi-Platform Support**: Instagram Reels, YouTube Videos & Shorts, Facebook Watch, and Pinterest Pins.
- **One-Click Clipboard**: Instant URL paste button and live platform auto-detection as you type.
- **Recent Session History**: Built-in history to re-load or review your downloaded MP4, MP3, and cleaned reels.
- **100% Private & Local**: Runs entirely on your local machine with zero external analytics or trackers.

## Requirements
- Python 3.10+
- Internet access
- FFmpeg (installed via `imageio-ffmpeg` or system FFmpeg)

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
