"""Deal or Dud narrator service: turns a line of text into speech with one of the two host voices (Chatterbox).

The game server starts this by itself when it has been set up (npm run voice:setup), and stops it on exit.
To run it by hand: <narrator home>/venv/{Scripts/python.exe | bin/python} voice_server.py

Listens on 127.0.0.1:5123 (VOICE_PORT to change). Only this computer can reach it; the game server proxies to it.
Uses an NVIDIA GPU (CUDA) or Apple silicon (MPS) when present, otherwise the CPU (slow).
  GET /health                      -> {"ok": true, "voices": [...]}
  GET /speak?voice=adam&text=...   -> audio/wav (16-bit mono), cached on disk so a repeated line is instant.
"""
import hashlib
import io
import json
import os
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("VOICE_PORT", "5123"))
# Rendered lines are kept outside the repo, next to the Python environment (see voiceService.ts).
CACHE = os.environ.get("VOICE_CACHE") or os.path.join(os.path.expanduser("~"), ".blue-stage", "narrator", "cache")
# Voice name -> reference clip it is cloned from (Kokoro am_adam and bm_george, picked by the user).
VOICES = {"adam": os.path.join(HERE, "refs", "am_adam.wav"), "george": os.path.join(HERE, "refs", "bm_george.wav")}
SETTINGS = dict(exaggeration=0.45, cfg_weight=0.5, temperature=0.7)
# Bump when SETTINGS, refs or post-processing change so old cached clips are not reused.
CACHE_VERSION = "v2"
# Chatterbox sometimes rambles past the text or cuts it short; takes outside this length range are re-rolled.
MAX_TAKES = 4
MAX_TEXT = 300

os.makedirs(CACHE, exist_ok=True)
print("Loading the voice model (first start takes a minute)...", flush=True)
DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using {DEVICE}", flush=True)
model = ChatterboxTTS.from_pretrained(device=DEVICE)
conds = {}
for name, ref in VOICES.items():
    model.prepare_conditionals(ref, exaggeration=SETTINGS["exaggeration"])
    conds[name] = model.conds
gpu = threading.Lock()


def trim(wav: np.ndarray, sr: int) -> np.ndarray:
    loud = np.flatnonzero(np.abs(wav) > 0.01)
    return wav[max(0, loud[0] - int(sr * 0.03)): loud[-1] + int(sr * 0.08)] if loud.size else wav


def plausible_seconds(text: str) -> tuple[float, float, float]:
    """(shortest, expected, longest) believable length of a spoken line, from its word count."""
    words = max(1, len(text.split()))
    return 0.16 * words + 0.2, 0.3 * words + 0.3, 0.55 * words + 0.8


def finish(wav: np.ndarray, sr: int) -> bytes:
    """Evens out loudness, adds a short tail, and encodes 16-bit WAV. Expects trimmed audio."""
    rms = float(np.sqrt(np.mean(wav ** 2))) or 1e-6
    wav = wav * min(10 ** (-18 / 20) / rms, 0.89 / (float(np.max(np.abs(wav))) or 1e-6))
    wav = np.concatenate([wav, np.zeros(int(sr * 0.15), dtype=wav.dtype)])
    out = io.BytesIO()
    with wave.open(out, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(sr)
        file.writeframes((np.clip(wav, -1, 1) * 32767).astype("<i2").tobytes())
    return out.getvalue()


def speak(voice: str, text: str) -> bytes:
    key = hashlib.sha1(f"{CACHE_VERSION}|{voice}|{text}".encode()).hexdigest()
    path = os.path.join(CACHE, f"{key}.wav")
    if os.path.exists(path):
        with open(path, "rb") as file:
            return file.read()
    with gpu:
        if os.path.exists(path):  # another request made it while this one waited
            with open(path, "rb") as file:
                return file.read()
        model.conds = conds[voice]
        shortest, expected, longest = plausible_seconds(text)
        best, best_miss = None, float("inf")
        for take in range(MAX_TAKES):
            torch.manual_seed(int(key[:8], 16) + take)
            wav = trim(model.generate(text, **SETTINGS).squeeze(0).cpu().numpy(), model.sr)
            seconds = len(wav) / model.sr
            if shortest <= seconds <= longest:
                best = wav
                break
            print(f"  take {take + 1} is {seconds:.2f}s, expected about {expected:.2f}s; trying again", flush=True)
            if abs(seconds - expected) < best_miss:
                best, best_miss = wav, abs(seconds - expected)
        data = finish(best, model.sr)
        with open(path + ".tmp", "wb") as file:
            file.write(data)
        os.replace(path + ".tmp", path)
        return data


class Handler(BaseHTTPRequestHandler):
    def send(self, status: int, body: bytes, kind: str) -> None:
        self.send_response(status)
        self.send_header("content-type", kind)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        if url.path == "/health":
            self.send(200, json.dumps({"ok": True, "voices": list(VOICES)}).encode(), "application/json")
            return
        if url.path != "/speak":
            self.send(404, b'{"error":"not found"}', "application/json")
            return
        query = parse_qs(url.query)
        voice = query.get("voice", [""])[0]
        text = " ".join(query.get("text", [""])[0].split())
        if voice not in VOICES or not text or len(text) > MAX_TEXT:
            self.send(400, b'{"error":"bad voice or text"}', "application/json")
            return
        try:
            self.send(200, speak(voice, text), "audio/wav")
        except Exception as error:  # keep serving after a bad line
            print("speak failed:", repr(error), flush=True)
            self.send(500, b'{"error":"speech failed"}', "application/json")

    def log_message(self, fmt, *args):  # quieter console: one line per spoken request
        if "/speak" in self.path:
            print(self.address_string(), self.path[:120], flush=True)


print(f"Narrator ready on http://127.0.0.1:{PORT} (voices: {', '.join(VOICES)})", flush=True)
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
