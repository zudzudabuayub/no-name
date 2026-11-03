"""
Сервер для скачивания видео прямо с вашего сайта.

Сайт на GitHub Pages не может сам запускать программы, поэтому скачивание делает этот
маленький сервер на основе yt-dlp (как в проекте nova-downloader). Сайт отправляет ему ссылку,
сервер скачивает видео и отдаёт готовый файл в браузер.

Переменные окружения:
  ACCESS_KEY        — ключ доступа (чтобы сервером не пользовались чужие). Обязательно задайте.
  ALLOWED_ORIGINS   — с каких сайтов можно обращаться, через запятую (по умолчанию все: *).
  MAX_FILESIZE_MB   — максимальный размер файла (по умолчанию 1024).
  JOB_TTL_MIN       — сколько минут хранить готовый файл (по умолчанию 20).
  MAX_WORKERS       — сколько видео качать одновременно (по умолчанию 2).
  YTDLP_COOKIES     — необязательно: cookies в формате Netscape (помогает, если YouTube блокирует сервер).
  ALLOW_PRIVATE     — 1, чтобы разрешить локальные адреса (только для тестов).
"""

from __future__ import annotations

import ipaddress
import os
import shutil
import socket
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlparse

import yt_dlp
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

ACCESS_KEY = os.environ.get("ACCESS_KEY", "").strip()
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MAX_FILESIZE = int(os.environ.get("MAX_FILESIZE_MB", "1024")) * 1024 * 1024
JOB_TTL = int(os.environ.get("JOB_TTL_MIN", "20")) * 60
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "2"))
ALLOW_PRIVATE = os.environ.get("ALLOW_PRIVATE") == "1"
WORK_DIR = Path(tempfile.gettempdir()) / "moi-sait-downloads"
WORK_DIR.mkdir(parents=True, exist_ok=True)

COOKIE_FILE: str | None = None
if os.environ.get("YTDLP_COOKIES", "").strip():
    COOKIE_FILE = str(WORK_DIR / "cookies.txt")
    Path(COOKIE_FILE).write_text(os.environ["YTDLP_COOKIES"].replace("\\n", "\n"), encoding="utf-8")

QUALITIES = {"best", "1080", "720", "480", "360", "audio"}

app = FastAPI(title="Мой сайт — сервер скачивания", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Access-Key"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)

executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()


# ---------- защита ----------

def check_key(request: Request) -> None:
    if not ACCESS_KEY:
        return
    given = request.headers.get("x-access-key") or request.query_params.get("key") or ""
    if given != ACCESS_KEY:
        raise HTTPException(status_code=401, detail="Неверный ключ доступа к серверу")


def validate_url(raw: str) -> str:
    url = (raw or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Неверная ссылка")
    if not ALLOW_PRIVATE:
        try:
            infos = socket.getaddrinfo(parsed.hostname, None)
        except socket.gaierror:
            raise HTTPException(status_code=400, detail="Сайт по ссылке не найден")
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                raise HTTPException(status_code=400, detail="Эта ссылка недоступна")
    return url


# ---------- yt-dlp ----------

def base_opts() -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "socket_timeout": 20,
        "retries": 3,
        "concurrent_fragment_downloads": 4,
        "windowsfilenames": True,
        "max_filesize": MAX_FILESIZE,
    }
    if COOKIE_FILE:
        opts["cookiefile"] = COOKIE_FILE
    return opts


def friendly_error(err: Exception) -> str:
    text = str(err)
    low = text.lower()
    if ("confirm you" in low and "bot" in low) or "sign in to confirm" in low:
        return "YouTube временно заблокировал сервер. Попробуйте позже или добавьте cookies (см. инструкцию)."
    if "private" in low:
        return "Видео приватное — скачать его нельзя."
    if "unsupported url" in low:
        return "Этот сайт не поддерживается."
    if "login" in low or "log in" in low or "cookies" in low:
        return "Сайт требует вход в аккаунт. Попробуйте другое видео или добавьте cookies."
    if "geo" in low or "not available in your country" in low:
        return "Видео недоступно в стране, где работает сервер."
    if "max-filesize" in low or "larger than" in low or "file is larger" in low:
        return "Файл слишком большой. Выберите качество пониже."
    if "requested format is not available" in low:
        return "Такое качество недоступно. Выберите другое."
    if "unable to download webpage" in low or "timed out" in low:
        return "Сайт не ответил. Попробуйте ещё раз."
    return "Не удалось скачать: " + text.replace("ERROR: ", "")[:300]


def format_for(quality: str) -> dict:
    if quality == "audio":
        return {
            "format": "bestaudio/best",
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
        }
    # Сначала разрешение (не выше выбранного), потом H.264 — его понимают все телефоны
    res = "res" if quality == "best" else f"res:{quality}"
    sort = [res, "vcodec:h264", "ext:mp4:m4a"]
    return {"format": "bv*+ba/b", "format_sort": sort, "merge_output_format": "mp4"}


def platform_name(info: dict) -> str:
    return (info.get("extractor_key") or info.get("extractor") or "").replace(":", " ")


class UrlBody(BaseModel):
    url: str


class JobBody(BaseModel):
    url: str
    quality: str = "720"


@app.get("/")
def root():
    return {"ok": True, "message": "Сервер скачивания работает. Укажите этот адрес в настройках сайта."}


@app.get("/api/health")
def health():
    return {"ok": True, "yt_dlp": yt_dlp.version.__version__, "auth": bool(ACCESS_KEY), "cookies": bool(COOKIE_FILE)}


@app.post("/api/info")
def info(body: UrlBody, request: Request):
    check_key(request)
    url = validate_url(body.url)
    try:
        with yt_dlp.YoutubeDL(base_opts()) as ydl:
            data = ydl.extract_info(url, download=False)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=friendly_error(e))
    if data.get("_type") == "playlist" and data.get("entries"):
        data = next((e for e in data["entries"] if e), data)
    formats = data.get("formats") or [data]
    heights = sorted({f.get("height") for f in formats if f.get("height") and f.get("vcodec") != "none"}, reverse=True)
    # vcodec == "none" — точно только звук; если кодек неизвестен, считаем, что видео есть
    has_video = any(f.get("vcodec") != "none" for f in formats)
    return {
        "title": data.get("title") or "Видео",
        "thumbnail": data.get("thumbnail"),
        "duration": data.get("duration"),
        "uploader": data.get("uploader") or data.get("channel"),
        "platform": platform_name(data),
        "heights": [h for h in heights if h <= 4320],
        "has_video": has_video,
        "webpage_url": data.get("webpage_url") or url,
    }


def run_job(job_id: str) -> None:
    job = jobs[job_id]
    out_dir = WORK_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    def on_progress(d: dict) -> None:
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            # видео и звук качаются отдельно — считаем общий прогресс по частям
            part = job.get("part", 0)
            pct = (done / total * 100) if total else 0
            job.update(status="downloading", progress=round(min(99, (part * 100 + pct) / job.get("parts", 1)), 1),
                       speed=d.get("speed"), eta=d.get("eta"))
        elif d.get("status") == "finished":
            job["part"] = job.get("part", 0) + 1

    def on_post(d: dict) -> None:
        if d.get("status") == "started":
            job.update(status="processing", progress=99)

    opts = base_opts()
    opts.update(format_for(job["quality"]))
    opts.update({
        "outtmpl": str(out_dir / "%(title).90B.%(ext)s"),
        "progress_hooks": [on_progress],
        "postprocessor_hooks": [on_post],
    })
    try:
        job["status"] = "downloading"
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(job["url"], download=False)
            if info.get("_type") == "playlist" and info.get("entries"):
                info = next((e for e in info["entries"] if e), info)
            fmts = info.get("requested_formats")
            job["parts"] = len(fmts) if fmts else 1
            job["title"] = info.get("title")
            ydl.process_info(info)
        files = [p for p in out_dir.iterdir() if p.is_file() and not p.name.endswith((".part", ".ytdl"))]
        if not files:
            raise RuntimeError("Файл не появился (возможно, он больше допустимого размера).")
        file = max(files, key=lambda p: p.stat().st_size)
        job.update(status="done", progress=100, file=str(file), filename=file.name, size=file.stat().st_size)
    except Exception as e:  # noqa: BLE001
        job.update(status="error", error=friendly_error(e))
        shutil.rmtree(out_dir, ignore_errors=True)


@app.post("/api/jobs")
def create_job(body: JobBody, request: Request):
    check_key(request)
    url = validate_url(body.url)
    if body.quality not in QUALITIES:
        raise HTTPException(status_code=400, detail="Неизвестное качество")
    job_id = uuid.uuid4().hex
    with jobs_lock:
        active = sum(1 for j in jobs.values() if j["status"] in ("queued", "downloading", "processing"))
        if active >= MAX_WORKERS * 3:
            raise HTTPException(status_code=429, detail="Сервер занят. Попробуйте через минуту.")
        jobs[job_id] = {"id": job_id, "url": url, "quality": body.quality, "status": "queued",
                        "progress": 0, "created": time.time()}
    executor.submit(run_job, job_id)
    return {"id": job_id}


def get_job(job_id: str) -> dict:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена или устарела")
    return job


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str, request: Request):
    check_key(request)
    job = get_job(job_id)
    return {k: job.get(k) for k in ("id", "status", "progress", "speed", "eta", "title", "filename", "size", "error")}


@app.get("/api/jobs/{job_id}/file")
def job_file(job_id: str, request: Request, inline: int = 0):
    check_key(request)
    job = get_job(job_id)
    if job.get("status") != "done" or not job.get("file") or not os.path.exists(job["file"]):
        raise HTTPException(status_code=409, detail="Файл ещё не готов")
    name = job["filename"]
    ascii_name = name.encode("ascii", "ignore").decode() or "video"
    ascii_name = ascii_name.replace('"', "")
    disposition = "inline" if inline else "attachment"
    headers = {"Content-Disposition": f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"}
    return FileResponse(job["file"], headers=headers)


@app.exception_handler(HTTPException)
def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


def cleanup_loop() -> None:
    while True:
        time.sleep(60)
        now = time.time()
        with jobs_lock:
            old = [k for k, j in jobs.items() if now - j["created"] > JOB_TTL and j["status"] in ("done", "error")]
            for k in old:
                jobs.pop(k, None)
        for k in old:
            shutil.rmtree(WORK_DIR / k, ignore_errors=True)


threading.Thread(target=cleanup_loop, daemon=True).start()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
