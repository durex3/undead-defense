"""Generate deterministic, short original SFX without changing existing audio assets."""
from pathlib import Path
import json
import math
import random
import struct
import uuid
import wave

OUT = Path(__file__).resolve().parents[1] / "assets/resources/audio"
RATE = 22050
SPECS = {"evolution": .72, "combo_fire": .18, "combo_ice": .22, "combo_water": .30, "meteor": .28}
TAU = math.tau


def sample(name, t, duration, rng):
    u = t / duration
    attack = min(1, t / .006)
    tail = min(1, (duration - t) / .015)
    envelope = attack * tail * (1 - u) ** 1.8
    noise = rng.uniform(-1, 1)
    if name == "evolution":
        value = .12 * math.sin(TAU * (160 * t + 100 * t * t)) * (1 - u)
        for i, frequency in enumerate([440, 554.37, 659.25, 880]):
            age = t - i * .085
            if age >= 0:
                bell = math.exp(-age * 7) * min(1, age / .005)
                value += .23 * bell * (math.sin(TAU * frequency * age) + .2 * math.sin(TAU * frequency * 2 * age))
        return value * attack * tail
    if name == "combo_fire":
        return envelope * (.22 * math.sin(TAU * (1900 * t - 3000 * t * t)) + .25 * noise + .16 * math.sin(TAU * 160 * t))
    if name == "combo_ice":
        return envelope * (.24 * math.sin(TAU * 1850 * t) + .16 * math.sin(TAU * 2770 * t) + .16 * noise * math.exp(-t * 30))
    if name == "combo_water":
        return envelope * (.34 * math.sin(TAU * (420 * t + 480 * t * t)) + .12 * math.sin(TAU * 840 * t))
    return envelope * (.45 * math.sin(TAU * (90 * t - 70 * t * t)) + .20 * noise * math.exp(-t * 18))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, duration in SPECS.items():
        rng = random.Random("ashen-feedback-v1-" + name)
        samples = [sample(name, i / RATE, duration, rng) for i in range(round(RATE * duration))]
        peak = max(abs(s) for s in samples)
        gain = min(1, .62 / max(.001, peak))
        pcm = b"".join(struct.pack("<h", round(s * gain * 32767)) for s in samples)
        with wave.open(str(OUT / (name + ".wav")), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(pcm)
        meta = {"ver": "1.0.0", "importer": "audio-clip", "imported": True,
                "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, "ashen-survivors/audio/" + name)),
                "files": [".json", ".wav"], "subMetas": {}, "userData": {"downloadMode": 0}}
        (OUT / (name + ".wav.meta")).write_text(json.dumps(meta, indent=2) + "\n")
        print(f"{name}: {len(samples) / RATE:.2f}s, peak {peak * gain:.3f}, {len(pcm)} bytes")


if __name__ == "__main__":
    main()
