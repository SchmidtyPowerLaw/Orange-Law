#!/usr/bin/env python3
"""Original 125 BPM tech-house bed for the Bitcoin History reel.

Legally distinct composition. Not a cover, interpolation, or sample of
Endor (or any other) recording. No vocals, no copyrighted hooks.
"""
from __future__ import annotations

import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
BPM = 125.0
BEAT = 60.0 / BPM
BARS = 48  # ~92.16s — covers the ~64s reel plus tail
DUR = BARS * 4 * BEAT
N = int(SR * DUR)
T = np.arange(N, dtype=np.float64) / SR
RNG = np.random.default_rng(20260913)


def midi(n: float) -> float:
    return 440.0 * (2 ** ((n - 69) / 12.0))


def exp_env(n: int, decay: float) -> np.ndarray:
    return np.exp(-np.arange(n, dtype=np.float64) / (SR * decay))


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    aa, dd, rr = int(a * SR), int(d * SR), int(r * SR)
    ss = max(0, n - aa - dd - rr)
    parts = []
    if aa:
        parts.append(np.linspace(0, 1, aa, endpoint=False))
    if dd:
        parts.append(np.linspace(1, s, dd, endpoint=False))
    if ss:
        parts.append(np.full(ss, s))
    if rr:
        parts.append(np.linspace(s, 0, min(rr, n - (aa + dd + ss)), endpoint=True))
    env = np.concatenate(parts) if parts else np.zeros(n)
    if len(env) < n:
        env = np.pad(env, (0, n - len(env)))
    return env[:n]


def place(buf: np.ndarray, start: int, sig: np.ndarray, gain: float = 1.0) -> None:
    if start >= len(buf) or start < 0:
        return
    end = min(len(buf), start + len(sig))
    buf[start:end] += sig[: end - start] * gain


def lowpass(sig: np.ndarray, cutoff: float, q: float = 0.7) -> np.ndarray:
    """Hann FIR lowpass. cutoff in Hz. `q` unused (kept for call-site compat)."""
    del q
    x = np.asarray(sig, dtype=np.float64)
    if x.size == 0:
        return x
    length = max(5, int(SR / max(40.0, cutoff)))
    if length % 2 == 0:
        length += 1
    length = min(length, max(5, x.size // 2 * 2 + 1))
    kernel = np.hanning(length)
    kernel /= kernel.sum()
    return np.convolve(x, kernel, mode="same")


def highpass(sig: np.ndarray, cutoff: float) -> np.ndarray:
    x = np.asarray(sig, dtype=np.float64)
    return x - lowpass(x, cutoff)


def tanh_sat(sig: np.ndarray, drive: float) -> np.ndarray:
    return np.tanh(sig * drive) / np.tanh(drive)


# --- voices -----------------------------------------------------------------

def kick(n: int) -> np.ndarray:
    tt = np.arange(n) / SR
    freq = 175 * np.exp(-tt * 28) + 42
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    body *= np.exp(-tt * 4.4)
    click = np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 90) * 0.22
    thump = np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 8) * 0.35
    sig = body + click + thump
    return tanh_sat(sig * 1.35, 1.6)


def clap(n: int) -> np.ndarray:
    noise = RNG.standard_normal(n)
    # stacked bursts like a house clap
    e = np.zeros(n)
    for delay, amp, dec in ((0, 1.0, 0.045), (int(0.012 * SR), 0.7, 0.05), (int(0.024 * SR), 0.45, 0.07)):
        env = exp_env(n, dec)
        if delay:
            env = np.pad(env, (delay, 0))[:n] * 0
            env = np.zeros(n)
            env[delay:] = exp_env(n - delay, dec)
        e += env * amp
    band = lowpass(highpass(noise, 800), 4200, q=1.1)
    return band * e * 0.55


def hat(n: int, open_: bool) -> np.ndarray:
    noise = RNG.standard_normal(n)
    hp = highpass(noise, 7000 if not open_ else 5000)
    decay = 0.22 if open_ else 0.028
    return hp * exp_env(n, decay) * (0.16 if open_ else 0.09)


def ride(n: int) -> np.ndarray:
    tt = np.arange(n) / SR
    noise = highpass(RNG.standard_normal(n), 9000)
    metal = np.sin(2 * np.pi * 7800 * tt) * np.exp(-tt * 14) * 0.08
    return (noise * exp_env(n, 0.18) * 0.07) + metal


def bass_note(freq: float, n: int, cutoff: float) -> np.ndarray:
    tt = np.arange(n) / SR
    env = adsr(n, 0.006, 0.08, 0.72, 0.06)
    sq = np.sign(np.sin(2 * np.pi * freq * tt + 0.04 * np.sin(2 * np.pi * 1.5 * tt)))
    sine = np.sin(2 * np.pi * freq * tt)
    sub = np.sin(2 * np.pi * (freq * 0.5) * tt) * 0.55
    raw = 0.55 * sine + 0.28 * sq + sub
    return lowpass(raw, cutoff, q=1.15) * env * 0.78


def saw(freq: float, n: int, detune: float = 0.0) -> np.ndarray:
    tt = np.arange(n) / SR
    f = freq * (2 ** (detune / 1200.0))
    phase = (f * tt) % 1.0
    return 2.0 * phase - 1.0


def chord_stab(freqs: list[float], n: int, cutoff: float) -> np.ndarray:
    sig = np.zeros(n)
    env = adsr(n, 0.004, 0.12, 0.28, 0.18)
    for f in freqs:
        sig += saw(f, n, -7) * 0.33
        sig += saw(f, n, 9) * 0.33
        sig += np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.2
    sig = lowpass(sig, cutoff, q=1.3)
    return tanh_sat(sig * env * 0.42, 1.2)


def pluck(freq: float, n: int) -> np.ndarray:
    """Short analog-pluck hook note — original riff, not a vocal line."""
    tt = np.arange(n) / SR
    env = np.minimum(1.0, tt / 0.004) * np.exp(-tt * 7.5)
    sig = saw(freq, n) * 0.45 + np.sin(2 * np.pi * freq * tt) * 0.55
    sig += 0.12 * saw(freq * 2, n, 6)
    return lowpass(sig, 2800, q=0.9) * env * 0.34


def noise_sweep(n: int, up: bool) -> np.ndarray:
    white = RNG.standard_normal(n)
    brown = np.cumsum(white)
    brown /= np.max(np.abs(brown)) or 1.0
    tt = np.arange(n) / max(n - 1, 1)
    if up:
        env = tt**1.4
        mix = (1 - tt) * brown + tt * white
    else:
        env = (1 - tt) ** 1.1
        mix = tt * brown + (1 - tt) * white
    return highpass(mix, 300) * env * 0.22


# --- arrangement ------------------------------------------------------------
# Original 8-bar loop in A minor / C mixolydian house: Am – F – C – G
# Bass riff (16ths, own rhythm — not a transcription of any commercial track)

L = np.zeros(N)
R = np.zeros(N)

kick_s = kick(int(SR * 0.48))
clap_s = clap(int(SR * 0.32))
hat_c = hat(int(SR * 0.10), False)
hat_o = hat(int(SR * 0.30), True)
ride_s = ride(int(SR * 0.22))

# bass pattern per bar (steps of 1/8): root, rest, fifth, root, rest, octave, fifth, rest
# degrees relative to current chord root midi
BASS_STEPS = [0, None, 7, 0, None, 12, 7, None]

# original hook (midi relative to A3=57) — pentatonic hops, not a vocal melody
HOOK = [0, 3, 7, 10, 7, 3, 0, -2]  # A C E G E C A G

chords = [
    [midi(57), midi(60), midi(64), midi(67)],  # Am7
    [midi(53), midi(57), midi(60), midi(65)],  # Fmaj
    [midi(48), midi(52), midi(55), midi(60)],  # C
    [midi(55), midi(59), midi(62), midi(67)],  # G
]
roots = [midi(33), midi(29), midi(24), midi(31)]  # A1 F1 C1 G1
root_midi = [33, 29, 24, 31]

beats_total = BARS * 4
eighths = BARS * 8

# filter-open over the first 16 bars, close a bit in the break, reopen
def section_cut(bar: int) -> float:
    if bar < 4:
        return 280 + bar * 40
    if bar < 16:
        return 420 + (bar - 4) * 90
    if 32 <= bar < 36:
        return 380  # break
    if bar >= 36:
        return 1400 + min(800, (bar - 36) * 60)
    return 1400


for b in range(beats_total):
    t0 = b * BEAT
    i0 = int(t0 * SR)
    bar = b // 4
    beat_in = b % 4
    chord_i = (bar // 2) % 4
    intro = bar < 4
    break_ = 32 <= bar < 36
    outro = bar >= BARS - 4

    # kick every beat except a couple of skip-kicks in the break
    if not (break_ and beat_in == 3):
        k = kick_s * (0.62 if intro else 1.0)
        place(L, i0, k, 1.0)
        place(R, i0, k, 1.0)

    if not intro and not break_ and beat_in in (1, 3):
        place(L, i0, clap_s, 0.92)
        place(R, i0, clap_s, 1.0)  # slight L/R offset feel via gain
        place(R, i0 + 40, clap_s, 0.18)

    # closed hats on 8ths; opens on the last offbeat
    place(L, i0, hat_c, 0.85)
    place(R, i0, hat_c, 0.9)
    off = i0 + int(0.5 * BEAT * SR)
    place(L, off, hat_c, 0.55)
    place(R, off, hat_c, 0.7)
    if beat_in == 3 and not intro:
        place(L, off, hat_o, 0.9)
        place(R, off, hat_o, 1.0)

    if bar >= 8 and not break_ and beat_in == 0:
        place(L, i0, ride_s, 0.7)
        place(R, i0, ride_s, 0.85)

    # bass on 8ths
    if bar >= 2 and not (intro and bar < 2):
        cut = section_cut(bar)
        for s, deg in enumerate(BASS_STEPS):
            if deg is None:
                continue
            # 8th index inside this beat (2 eighths per beat)
            if s // 2 != beat_in:
                continue
            if s % 2 == 1 and beat_in == 0 and bar % 4 == 3:
                continue
            f = midi(root_midi[chord_i] + deg)
            dur_n = int(SR * BEAT * 0.46)
            note = bass_note(f, dur_n, cutoff=cut)
            start = int((b + (s % 2) * 0.5) * BEAT * SR)
            place(L, start, note, 0.95)
            place(R, start, note, 0.9)

    # chord stabs on downbeats of even bars after intro
    if bar >= 8 and not break_ and beat_in == 0 and bar % 2 == 0:
        stab = chord_stab(chords[chord_i], int(SR * 0.62), cutoff=section_cut(bar) + 400)
        place(L, i0, stab, 0.85)
        place(R, i0 + 70, stab, 0.9)

    # original hook plucks — bars 16–32 and 36–end, on off-beat 8ths
    if (16 <= bar < 32 or bar >= 36) and not outro:
        if beat_in in (0, 2):
            deg = HOOK[(bar + beat_in) % len(HOOK)]
            note = pluck(midi(69 + deg), int(SR * 0.28))  # A4-centred
            start = i0 + int(0.5 * BEAT * SR)
            place(L, start, note, 0.7)
            place(R, start + 90, note, 0.85)

# risers into bar 16 and bar 36
rise_n = int(SR * BEAT * 8)
place(L, int(8 * 4 * BEAT * SR), noise_sweep(rise_n, True), 1.0)
place(R, int(8 * 4 * BEAT * SR), noise_sweep(rise_n, True), 1.0)
place(L, int(28 * 4 * BEAT * SR), noise_sweep(int(SR * BEAT * 16), True), 1.05)
place(R, int(28 * 4 * BEAT * SR), noise_sweep(int(SR * BEAT * 16), True), 1.05)

# crash-ish noise at drops
crash = noise_sweep(int(SR * 1.8), False)
for drop_bar in (8, 16, 36):
    i = int(drop_bar * 4 * BEAT * SR)
    place(L, i, crash, 0.7)
    place(R, i, crash, 0.75)

# sidechain duck everything except a dry kick copy — approximate by ducking full mix
mix_l = L.copy()
mix_r = R.copy()
duck = np.ones(N)
for b in range(beats_total):
    i0 = int(b * BEAT * SR)
    n = int(0.16 * SR)
    end = min(N, i0 + n)
    # exponential pump
    x = np.linspace(0, 1, end - i0)
    duck[i0:end] *= 0.42 + 0.58 * (1 - np.exp(-x * 6))
mix_l *= duck
mix_r *= duck
# re-layer a drier kick so the pump doesn't swallow transients
for b in range(beats_total):
    bar = b // 4
    beat_in = b % 4
    if 32 <= bar < 36 and beat_in == 3:
        continue
    i0 = int(b * BEAT * SR)
    k = kick_s * (0.28 if bar < 4 else 0.38)
    place(mix_l, i0, k, 1.0)
    place(mix_r, i0, k, 1.0)

# master: fade, highpass rumble, saturate, peak
fade_in = np.minimum(1.0, T / 0.04)
fade_out = np.minimum(1.0, (DUR - T) / 4.0)
mix_l *= fade_in * fade_out
mix_r *= fade_in * fade_out
mix_l = highpass(mix_l, 28)
mix_r = highpass(mix_r, 28)
mix_l = tanh_sat(mix_l, 1.25)
mix_r = tanh_sat(mix_r, 1.25)
peak = max(np.max(np.abs(mix_l)), np.max(np.abs(mix_r)), 1e-9)
mix_l = np.clip(mix_l / peak * 0.89, -1, 1)
mix_r = np.clip(mix_r / peak * 0.89, -1, 1)

# interleaved stereo int16
stereo = np.empty(N * 2, dtype=np.int16)
stereo[0::2] = (mix_l * 32767).astype(np.int16)
stereo[1::2] = (mix_r * 32767).astype(np.int16)

wav_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
with wave.open(wav_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())

out_dir = "/workspace/public/audio"
os.makedirs(out_dir, exist_ok=True)
mp3 = os.path.join(out_dir, "bitcoin-history.mp3")
subprocess.check_call(
    ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-q:a", "3", mp3],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
os.unlink(wav_path)
print("wrote", mp3, "bytes", os.path.getsize(mp3), "dur", round(DUR, 1))
