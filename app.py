from flask import Flask, render_template, request, jsonify, send_file
from urllib.parse import urlparse
from pathlib import Path
import subprocess
import sys
import uuid
import json
import shutil
import re

app = Flask(__name__)

ROOT = Path(__file__).resolve().parent
DOWNLOADS = ROOT / "downloads"
DOWNLOADS.mkdir(exist_ok=True)

ALLOWED_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
    "instagram.com", "www.instagram.com",
    "facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch",
    "pinterest.com", "www.pinterest.com", "m.pinterest.com", "pin.it"
}


def valid_url(raw):
    try:
        parsed = urlparse(raw.strip())
        host = (parsed.hostname or "").lower()

        return (
            parsed.scheme in ("http", "https")
            and any(
                host == domain or host.endswith("." + domain)
                for domain in ALLOWED_HOSTS
            )
        )
    except Exception:
        return False


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/info")
def info():
    data = request.get_json(silent=True) or {}
    url = str(data.get("url", "")).strip()

    if not valid_url(url):
        return jsonify(error="Enter a valid Instagram, Facebook, YouTube, or Pinterest URL."), 400

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        "--skip-download",
        url
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60
        )

        if result.returncode != 0:
            raw_err = (result.stderr or "").strip()
            if "login" in raw_err.lower() or "private" in raw_err.lower():
                err_msg = "This video is private or restricted. Only public videos can be fetched."
            else:
                err_msg = "Could not fetch video info. Please verify the URL and try again."
            return jsonify(error=err_msg), 422

        obj = json.loads(result.stdout)

        formats = []
        seen = set()

        for item in obj.get("formats", []):
            if not item.get("url") or item.get("vcodec") in (None, "none"):
                continue

            h = item.get("height")
            w = item.get("width")
            effective_res = min(h, w) if (h and w) else (h or w)
            if not effective_res:
                continue

            if effective_res not in seen:
                formats.append({
                    "height": effective_res,
                    "label": f"{effective_res}p"
                })
                seen.add(effective_res)

        formats.sort(key=lambda item: item["height"], reverse=True)

        return jsonify({
            "title": obj.get("title") or "Video",
            "thumbnail": obj.get("thumbnail"),
            "duration": obj.get("duration"),
            "formats": formats,
            "platform": obj.get("extractor_key") or "Video source"
        })

    except subprocess.TimeoutExpired:
        return jsonify(error="The website took too long to respond. Try again."), 504

    except Exception as exc:
        return jsonify(error=f"Could not process URL: {exc}"), 500


def find_ffmpeg():
    ffmpeg_exe = None
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass

    if not ffmpeg_exe:
        ffmpeg_exe = shutil.which("ffmpeg")

    if not ffmpeg_exe:
        common_paths = [
            Path(sys.executable).parent / "ffmpeg.exe",
            Path(sys.executable).parent / "Scripts" / "ffmpeg.exe",
            Path(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
            Path(r"C:\tools\ffmpeg\bin\ffmpeg.exe"),
        ]
        for p in common_paths:
            if p.exists():
                ffmpeg_exe = str(p)
                break

    return ffmpeg_exe


def get_video_dimensions(file_path, ffmpeg_exe):
    """Probes exact video resolution (width, height) using FFmpeg stream metadata."""
    try:
        res = subprocess.run([ffmpeg_exe, "-i", str(file_path)], capture_output=True, text=True)
        match = re.search(r",\s*(\d{2,5})x(\d{2,5})", res.stderr)
        if match:
            return int(match.group(1)), int(match.group(2))
    except Exception:
        pass
    return 1080, 1920


def get_font_file():
    """Locates a universal system font for FFmpeg drawtext."""
    candidates = [
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\calibri.ttf"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Helvetica.ttc")
    ]
    for c in candidates:
        if c.exists():
            return str(c).replace("\\", "/")
    return None


@app.post("/api/download")
def download():
    data = request.get_json(silent=True) or {}

    url = str(data.get("url", "")).strip()
    media_format = str(data.get("format", "mp4")).lower()  # "mp4", "mp3", or "edit"
    quality = str(data.get("quality", "best")).lower()
    audio = str(data.get("audio", "with")).lower()
    audio_quality = str(data.get("audio_quality", "320")).lower()  # "320", "256", "192", "128"
    raw_title = str(data.get("title", "")).strip()
    with_sound = audio != "without"

    if not valid_url(url):
        return jsonify(error="Enter a valid supported video URL."), 400

    ffmpeg_exe = find_ffmpeg()
    job = uuid.uuid4().hex

    # Clean title for safe and readable file naming
    clean_title = re.sub(r'[\\/*?:"<>|]', "", raw_title).strip()
    clean_title = re.sub(r"\s+", " ", clean_title)[:80]

    # =========================================================
    # REEL STUDIO / WATERMARK & TEXT EDIT WORKFLOW
    # =========================================================
    if media_format in ("edit", "clean"):
        if not ffmpeg_exe:
            return jsonify(error="FFmpeg is required for watermark removal and reel editing. Please install FFmpeg or run: pip install imageio-ffmpeg"), 500

        # Parse logo removal options
        logo_enabled = bool(data.get("logo_enabled", True))
        logo_x_pct = float(data.get("logo_x_pct", 76))
        logo_y_pct = float(data.get("logo_y_pct", 5))
        logo_w_pct = float(data.get("logo_w_pct", 20))
        logo_h_pct = float(data.get("logo_h_pct", 10))
        logo_method = str(data.get("logo_method", "delogo")).lower()

        # Parse text removal / replace options (default: compact tight box)
        text_enabled = bool(data.get("text_enabled", False))
        text_x_pct = float(data.get("text_x_pct", 36))
        text_y_pct = float(data.get("text_y_pct", 48))
        text_w_pct = float(data.get("text_w_pct", 28))
        text_h_pct = float(data.get("text_h_pct", 6))
        text_method = str(data.get("text_method", "delogo")).lower()
        text_action = str(data.get("text_action", "erase")).lower()  # "erase" or "replace"
        new_text = str(data.get("new_text", "")).strip()
        text_color = str(data.get("text_color", "white")).lower()
        text_size = int(data.get("text_size", 34))

        output = str(DOWNLOADS / f"{job}.%(ext)s")
        selector = "bestvideo+bestaudio/best"

        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--no-warnings",
            "--no-playlist",
            "--restrict-filenames",
            "--ffmpeg-location", ffmpeg_exe,
            "-f", selector,
            "--merge-output-format", "mp4",
            "-o", output,
            url
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                raw_err = (result.stderr or "").strip()
                if "login" in raw_err.lower() or "private" in raw_err.lower():
                    msg = "This video is private or restricted. Only public videos can be edited."
                else:
                    msg = "Failed to download reel for editing. Please verify the URL."
                return jsonify(error=msg), 422

            candidates = [
                p for p in DOWNLOADS.glob(f"{job}.*")
                if p.is_file() and p.suffix not in (".part", ".ytdl")
            ]
            if not candidates:
                return jsonify(error="Downloaded video file was not found."), 500

            source_file = max(candidates, key=lambda p: p.stat().st_size)
            vid_w, vid_h = get_video_dimensions(source_file, ffmpeg_exe)

            # Build multi-stage filter pipeline with filter_complex
            fc_steps = []
            curr_tag = "0:v"
            step_idx = 0

            # 1. Logo / Watermark Filter Step
            if logo_enabled:
                lx = int(vid_w * (logo_x_pct / 100.0))
                ly = int(vid_h * (logo_y_pct / 100.0))
                lw = int(vid_w * (logo_w_pct / 100.0))
                lh = int(vid_h * (logo_h_pct / 100.0))

                # Clamping for safe processing
                lx = max(2, min(lx, vid_w - 6))
                ly = max(2, min(ly, vid_h - 6))
                lw = max(4, min(lw, vid_w - lx - 2))
                lh = max(4, min(lh, vid_h - ly - 2))

                step_idx += 1
                next_tag = f"v{step_idx}"

                if logo_method == "blur":
                    # Soft frosted blur (prevents horizontal smearing)
                    fc_steps.append(
                        f"[{curr_tag}]split[base{step_idx}][crop{step_idx}];"
                        f"[crop{step_idx}]crop={lw}:{lh}:{lx}:{ly},boxblur=12:3[bl{step_idx}];"
                        f"[base{step_idx}][bl{step_idx}]overlay={lx}:{ly}[{next_tag}]"
                    )
                elif logo_method == "mask":
                    # Dark clean cover box
                    fc_steps.append(f"[{curr_tag}]drawbox=x={lx}:y={ly}:w={lw}:h={lh}:color=black@0.9:t=fill[{next_tag}]")
                else:
                    # Smart delogo inpaint
                    fc_steps.append(f"[{curr_tag}]delogo=x={lx}:y={ly}:w={lw}:h={lh}[{next_tag}]")

                curr_tag = next_tag

            # 2. Text Removal / Replacement Filter Step
            if text_enabled:
                tx = int(vid_w * (text_x_pct / 100.0))
                ty = int(vid_h * (text_y_pct / 100.0))
                tw = int(vid_w * (text_w_pct / 100.0))
                th = int(vid_h * (text_h_pct / 100.0))

                tx = max(2, min(tx, vid_w - 6))
                ty = max(2, min(ty, vid_h - 6))
                tw = max(4, min(tw, vid_w - tx - 2))
                th = max(4, min(th, vid_h - ty - 2))

                step_idx += 1
                next_tag = f"v{step_idx}"

                if text_method == "blur":
                    # Soft frosted blur over text area
                    fc_steps.append(
                        f"[{curr_tag}]split[base{step_idx}][crop{step_idx}];"
                        f"[crop{step_idx}]crop={tw}:{th}:{tx}:{ty},boxblur=12:3[bl{step_idx}];"
                        f"[base{step_idx}][bl{step_idx}]overlay={tx}:{ty}[{next_tag}]"
                    )
                elif text_method == "mask":
                    fc_steps.append(f"[{curr_tag}]drawbox=x={tx}:y={ty}:w={tw}:h={th}:color=black@0.9:t=fill[{next_tag}]")
                else:
                    # Delogo inpainting (when box is tight around text, inpainting is seamless)
                    fc_steps.append(f"[{curr_tag}]delogo=x={tx}:y={ty}:w={tw}:h={th}[{next_tag}]")

                curr_tag = next_tag

                # Overlay replacement custom text if specified
                if text_action == "replace" and new_text:
                    step_idx += 1
                    next_tag = f"v{step_idx}"
                    safe_text = new_text.replace("'", "").replace(":", "\\:").replace("\\", "")
                    font_path = get_font_file()
                    font_opt = f":fontfile='{font_path}'" if font_path else ""
                    scaled_size = max(16, int(text_size * (vid_w / 1080.0)))
                    text_y_pos = ty + (th // 2) - (scaled_size // 2)
                    fc_steps.append(
                        f"[{curr_tag}]drawtext=text='{safe_text}'{font_opt}:fontcolor={text_color}:fontsize={scaled_size}:x=(w-text_w)/2:y={text_y_pos}[{next_tag}]"
                    )
                    curr_tag = next_tag

            cleaned_path = DOWNLOADS / f"{job}_cleaned.mp4"
            ffmpeg_cmd = [
                ffmpeg_exe,
                "-y",
                "-i", str(source_file),
            ]

            if fc_steps:
                filter_complex_str = ";".join(fc_steps)
                ffmpeg_cmd.extend([
                    "-filter_complex", filter_complex_str,
                    "-map", f"[{curr_tag}]",
                    "-map", "0:a?"
                ])

            ffmpeg_cmd.extend([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "19",
                "-c:a", "copy",
                "-movflags", "+faststart",
                str(cleaned_path)
            ])

            conv_res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)

            # Cleanup source download to save disk space
            try:
                source_file.unlink(missing_ok=True)
            except Exception:
                pass

            if conv_res.returncode != 0 or not cleaned_path.exists() or cleaned_path.stat().st_size == 0:
                raw_err = (conv_res.stderr or "").strip()
                return jsonify(error="Editing filters could not be applied. Try adjusting coordinates."), 500

            download_name = f"{clean_title}_clean.mp4" if clean_title else "reel_clean.mp4"
            return send_file(
                cleaned_path,
                as_attachment=True,
                download_name=download_name,
                mimetype="video/mp4"
            )

        except subprocess.TimeoutExpired:
            return jsonify(error="Reel editing timed out. Try a shorter video."), 504
        except Exception as exc:
            return jsonify(error=f"Reel editing failed: {exc}"), 500

    # =========================================================
    # MP3 AUDIO DOWNLOAD WORKFLOW
    # =========================================================
    if media_format == "mp3":
        bitrate_map = {"320": "320k", "256": "256k", "192": "192k", "128": "128k"}
        target_bitrate = bitrate_map.get(audio_quality, "320k")
        output = str(DOWNLOADS / f"{job}.%(ext)s")

        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--no-warnings",
            "--no-playlist",
            "--restrict-filenames",
            "-f", "bestaudio/best",
        ]

        if ffmpeg_exe:
            cmd.extend([
                "--ffmpeg-location", ffmpeg_exe,
                "-x",
                "--audio-format", "mp3",
                "--audio-quality", target_bitrate,
            ])

        cmd.extend(["-o", output, url])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            mp3_candidates = [
                p for p in DOWNLOADS.glob(f"{job}*.mp3")
                if p.is_file() and p.stat().st_size > 0
            ]

            file_path = None
            if mp3_candidates:
                file_path = max(mp3_candidates, key=lambda p: p.stat().st_size)
            else:
                all_candidates = [
                    p for p in DOWNLOADS.glob(f"{job}.*")
                    if p.is_file() and p.suffix not in (".part", ".ytdl")
                ]

                if not all_candidates:
                    raw_err = (result.stderr or "").strip()
                    if "private" in raw_err.lower() or "login" in raw_err.lower():
                        msg = "This video is private or restricted. Only public videos can be downloaded."
                    else:
                        msg = "Download could not be completed. The media may be restricted or unavailable."
                    return jsonify(error=msg), 422

                source_audio = max(all_candidates, key=lambda p: p.stat().st_size)

                if ffmpeg_exe:
                    converted_mp3 = DOWNLOADS / f"{job}_converted.mp3"
                    ffmpeg_cmd = [
                        ffmpeg_exe,
                        "-y",
                        "-i", str(source_audio),
                        "-vn",
                        "-c:a", "libmp3lame",
                        "-b:a", target_bitrate,
                        str(converted_mp3)
                    ]
                    conv_res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=180)
                    if conv_res.returncode == 0 and converted_mp3.exists() and converted_mp3.stat().st_size > 0:
                        file_path = converted_mp3
                        try:
                            source_audio.unlink(missing_ok=True)
                        except Exception:
                            pass
                else:
                    return jsonify(
                        error="FFmpeg is required to convert to MP3 format. Run: pip install imageio-ffmpeg"
                    ), 500

            if not file_path or not file_path.exists():
                return jsonify(error="Audio conversion could not produce an MP3 file."), 500

            if clean_title:
                download_name = f"{clean_title}.mp3"
            else:
                download_name = f"audio_{audio_quality}k.mp3"

            return send_file(
                file_path,
                as_attachment=True,
                download_name=download_name,
                mimetype="audio/mpeg"
            )

        except subprocess.TimeoutExpired:
            return jsonify(error="Audio download timed out. Try again with a shorter track."), 504
        except Exception as exc:
            return jsonify(error=f"MP3 Download failed: {exc}"), 500

    # =========================================================
    # MP4 VIDEO DOWNLOAD WORKFLOW
    # =========================================================
    upscale_to_2k = quality in ("1440", "2k")

    if with_sound:
        if quality == "720":
            selector = (
                "bestvideo[height<=720]+bestaudio/bestvideo[width<=720]+bestaudio/"
                "best[height<=720]/best[width<=720]/bestvideo+bestaudio/best"
            )
        elif quality == "1080":
            selector = (
                "bestvideo[height<=1080]+bestaudio/bestvideo[width<=1080]+bestaudio/"
                "best[height<=1080]/best[width<=1080]/bestvideo+bestaudio/best"
            )
        elif upscale_to_2k:
            selector = (
                "bestvideo[height<=1080]+bestaudio/bestvideo[width<=1080]+bestaudio/"
                "best[height<=1080]/best[width<=1080]/bestvideo+bestaudio/best"
            )
        else:
            selector = "bestvideo+bestaudio/best"
        fallback_selector = "bestvideo+bestaudio/best"
    else:
        if quality == "720":
            selector = (
                "bestvideo[height<=720]/bestvideo[width<=720]/"
                "best[height<=720]/best[width<=720]/bestvideo/best"
            )
        elif quality == "1080":
            selector = (
                "bestvideo[height<=1080]/bestvideo[width<=1080]/"
                "best[height<=1080]/best[width<=1080]/bestvideo/best"
            )
        elif upscale_to_2k:
            selector = (
                "bestvideo[height<=1080]/bestvideo[width<=1080]/"
                "best[height<=1080]/best[width<=1080]/bestvideo/best"
            )
        else:
            selector = "bestvideo/best"
        fallback_selector = "bestvideo/best"

    output = str(DOWNLOADS / f"{job}.%(ext)s")

    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-warnings",
        "--no-playlist",
        "--restrict-filenames",
    ]
    if ffmpeg_exe:
        cmd.extend(["--ffmpeg-location", ffmpeg_exe])

    cmd.extend([
        "-f", selector,
        "--merge-output-format", "mp4",
        "-o", output,
        url
    ])

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300
        )

        if result.returncode != 0 and selector != fallback_selector:
            fallback_cmd = [
                sys.executable, "-m", "yt_dlp",
                "--no-warnings",
                "--no-playlist",
                "--restrict-filenames",
            ]
            if ffmpeg_exe:
                fallback_cmd.extend(["--ffmpeg-location", ffmpeg_exe])

            fallback_cmd.extend([
                "-f", fallback_selector,
                "--merge-output-format", "mp4",
                "-o", output,
                url
            ])
            result = subprocess.run(
                fallback_cmd, capture_output=True, text=True, timeout=300
            )

        if result.returncode != 0:
            raw_err = (result.stderr or "").strip()
            if "Requested format is not available" in raw_err:
                msg = "The selected resolution is not available for this link. Try selecting 'Original'."
            elif "private" in raw_err.lower() or "login" in raw_err.lower():
                msg = "This video is private or restricted. Only public videos can be downloaded."
            else:
                msg = "Download could not be completed. The video may be private or restricted."
            return jsonify(error=msg), 422

        candidates = [
            path for path in DOWNLOADS.glob(job + ".*")
            if path.is_file()
            and path.suffix not in (".part", ".ytdl")
        ]

        if not candidates:
            return jsonify(error="No downloaded video file was found."), 500

        file_path = max(candidates, key=lambda path: path.stat().st_size)

        if upscale_to_2k:
            if ffmpeg_exe:
                upscaled_path = DOWNLOADS / f"{job}_2k.mp4"
                scale_filter = (
                    "scale="
                    "if(gte(iw,ih),2560,-2):"
                    "if(gte(iw,ih),-2,2560):"
                    "flags=lanczos,"
                    "unsharp=5:5:0.35:3:3:0"
                )

                ffmpeg_cmd = [
                    ffmpeg_exe,
                    "-y",
                    "-i", str(file_path),
                    "-vf", scale_filter,
                    "-c:v", "libx264",
                    "-preset", "medium",
                    "-crf", "18",
                ]
                if with_sound:
                    ffmpeg_cmd.extend(["-c:a", "aac", "-b:a", "192k"])
                else:
                    ffmpeg_cmd.append("-an")

                ffmpeg_cmd.extend(["-movflags", "+faststart", str(upscaled_path)])

                try:
                    converted = subprocess.run(
                        ffmpeg_cmd,
                        capture_output=True,
                        text=True,
                        timeout=600
                    )
                    if converted.returncode == 0 and upscaled_path.exists() and upscaled_path.stat().st_size > 0:
                        file_path = upscaled_path
                except Exception:
                    pass
        elif not with_sound:
            if ffmpeg_exe:
                muted_path = DOWNLOADS / f"{job}_muted{file_path.suffix}"
                ffmpeg_cmd = [
                    ffmpeg_exe,
                    "-y",
                    "-i", str(file_path),
                    "-c:v", "copy",
                    "-an",
                    "-movflags", "+faststart",
                    str(muted_path)
                ]
                try:
                    converted = subprocess.run(
                        ffmpeg_cmd,
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
                    if converted.returncode == 0 and muted_path.exists() and muted_path.stat().st_size > 0:
                        file_path = muted_path
                except Exception:
                    pass

        sound_suffix = "" if with_sound else "_no_sound"
        quality_suffix = f"_{quality}p" if quality in ("720", "1080") else ("_2K" if upscale_to_2k else "")
        if clean_title:
            download_name = f"{clean_title}{quality_suffix}{sound_suffix}.mp4"
        elif upscale_to_2k and file_path.stem.endswith("_2k"):
            download_name = f"video_2K{sound_suffix}.mp4"
        elif not with_sound and file_path.stem.endswith("_muted"):
            download_name = f"video_no_sound{file_path.suffix}"
        else:
            download_name = f"video{sound_suffix}{file_path.suffix}"

        return send_file(
            file_path,
            as_attachment=True,
            download_name=download_name,
            mimetype="video/mp4"
        )

    except subprocess.TimeoutExpired:
        return jsonify(error="Download timed out. Try a shorter video."), 504

    except Exception as exc:
        return jsonify(error=f"Download failed: {exc}"), 500


if __name__ == "__main__":
    print("Open http://127.0.0.1:5000 in your browser")
    app.run(host="127.0.0.1", port=5000, debug=True)
