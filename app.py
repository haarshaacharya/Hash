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
            # For portrait/reels, the standard resolution identifier is min(h, w)
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


@app.post("/api/download")
def download():
    data = request.get_json(silent=True) or {}

    url = str(data.get("url", "")).strip()
    media_format = str(data.get("format", "mp4")).lower()  # "mp4" or "mp3"
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

            # Check if yt-dlp created the mp3
            mp3_candidates = [
                p for p in DOWNLOADS.glob(f"{job}*.mp3")
                if p.is_file() and p.stat().st_size > 0
            ]

            file_path = None
            if mp3_candidates:
                file_path = max(mp3_candidates, key=lambda p: p.stat().st_size)
            else:
                # If not converted yet, find any downloaded file for this job
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

                # Convert to MP3 using ffmpeg
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

    # Resilient format selectors that support both horizontal videos and vertical reels
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
        # Video without sound / muted stream
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

        # Automatic fallback retry if a strict selector wasn't available
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
            # If FFmpeg is available, perform Lanczos 2K scaling
            if ffmpeg_exe:
                upscaled_path = DOWNLOADS / f"{job}_2k.mp4"

                # Landscape: 2560x1440, Portrait/Reels: 1440x2560
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
            # User requested video WITHOUT sound: cleanly strip audio track using FFmpeg stream copy
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
