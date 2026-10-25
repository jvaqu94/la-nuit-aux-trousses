"""Ancienne méthode d’adaptation des mondes à partir du thème fourni.

Le menu, les cinq compositions dédiées de monde et les cinq stingers de boss
sont des ressources fixes : ce script historique ne les réencode pas.
Dépendances de production : pip install numpy scipy soundfile lameenc
Aucune de ces bibliothèques n’est nécessaire pour jouer les MP3 fournis.
"""
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt
import lameenc

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio'
SOURCE = OUT / 'nuitsorc-loop.mp3'
SR = 44100
ENCODER_DELAY = 1105
TEMPO = 105.46875
BODY_START = .22058957
BAR = 240 / TEMPO
SECTION = 4 * BAR

# Chaque index désigne quatre mesures du thème. Les montages utilisent des
# sections différentes. Le lecteur applique ensuite tempo/tonalité ensemble,
# sans phase vocoder stéréo : les canaux restent parfaitement cohérents.
SPECS = [
    dict(id='forest', title='Murmures de bruyère', sections=[0, 1, 2, 3, 4, 5], tempo=1.0, width=1.08, reverb=.04),
    dict(id='cemetery', title='Cloches de l’oubli', sections=[8, 9, 0, 1, 4, 6], tempo=.88, width=1.15, lowpass=7600, reverb=.13),
    dict(id='castle', title='Valse carmin', sections=[4, 1, 2, 3, 5, 7], tempo=1.02, width=1.04, highpass=42, reverb=.09),
    dict(id='marsh', title='Rondes des limons', sections=[8, 0, 9, 5, 1, 6], tempo=.94, width=1.18, lowpass=9200, chorus=.075, reverb=.06),
    dict(id='lanterns', title='Farandole des ombres', sections=[5, 6, 7, 3, 4, 2], tempo=1.08, width=1.06, highpass=38, reverb=.025),
]


def join_sections(source, spec):
    result = None
    crossfade = int(.025 * SR)
    for index in spec['sections']:
        start = int(round((BODY_START + index * SECTION) * SR))
        stop = int(round((BODY_START + (index + 1) * SECTION) * SR))
        segment = source[start:stop]
        if result is None:
            result = segment.copy()
            continue
        fade = min(crossfade, len(result), len(segment))
        weight = np.linspace(0, np.pi / 2, fade, endpoint=True)
        blend = result[-fade:] * np.cos(weight)[:, None] + segment[:fade] * np.sin(weight)[:, None]
        result = np.concatenate([result[:-fade], blend, segment[fade:]], axis=0)
    return result


def circular_reverb(dry, seed, amount):
    if not amount:
        return dry
    rng = np.random.default_rng(seed)
    n = len(dry)
    size = min(n, int(1.35 * SR))
    t = np.arange(size) / SR
    impulse = rng.normal(0, 1, size) * np.exp(-t * 4.5) * .045
    impulse[0] = 0
    for delay, gain in [(.029, .55), (.061, .38), (.113, .24), (.173, .16)]:
        impulse[int(delay * SR)] += gain
    frequencies = np.fft.rfftfreq(n, 1 / SR)
    response = np.fft.rfft(impulse, n) * ((frequencies > 140) & (frequencies < 8500))
    wet = np.empty_like(dry)
    for channel in range(2):
        wet[:, channel] = np.fft.irfft(np.fft.rfft(dry[:, channel]) * response, n)
    dry_rms = max(float(np.sqrt(np.mean(dry ** 2))), 1e-8)
    wet_rms = max(float(np.sqrt(np.mean(wet ** 2))), 1e-8)
    return dry + wet * (dry_rms / wet_rms * amount)


def seamless(samples, seconds=.18):
    """Raccorde la queue et le début sans ajouter de silence à la boucle."""
    fade = min(int(seconds * SR), len(samples) // 4)
    weight = np.linspace(0, np.pi / 2, fade)
    result = samples[:-fade].copy()
    result[:fade] = samples[:fade] * np.sin(weight)[:, None] + samples[-fade:] * np.cos(weight)[:, None]
    return result


def master(samples):
    samples = samples - np.mean(samples, axis=0, keepdims=True)
    rms = float(np.sqrt(np.mean(samples ** 2)))
    samples = samples * (.168 / max(rms, 1e-8))
    peak = float(np.max(np.abs(samples)))
    if peak > .94:
        samples = samples * (.94 / peak)
    return samples


def compose(source, spec):
    remix = join_sections(source, spec)

    if spec.get('highpass'):
        sos = butter(2, spec['highpass'], btype='highpass', fs=SR, output='sos')
        remix = sosfilt(sos, remix, axis=0)
    if spec.get('lowpass'):
        sos = butter(2, spec['lowpass'], btype='lowpass', fs=SR, output='sos')
        remix = sosfilt(sos, remix, axis=0)

    middle = np.mean(remix, axis=1)
    side = (remix[:, 0] - remix[:, 1]) * .5 * spec['width']
    remix = np.column_stack([middle + side, middle - side])
    if spec.get('chorus'):
        dry = remix.copy()
        remix[:, 0] += np.roll(dry[:, 1], int(.019 * SR)) * spec['chorus']
        remix[:, 1] += np.roll(dry[:, 0], int(.027 * SR)) * spec['chorus']
    remix = circular_reverb(remix, 9100 + SPECS.index(spec), spec.get('reverb', 0))
    return master(seamless(remix))


def encode_mp3(path, samples):
    pcm = (np.clip(samples, -1, 1) * 32767).astype('<i2')
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(192)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(2)
    encoder.set_quality(2)
    path.write_bytes(encoder.encode(pcm.tobytes()) + encoder.flush())


def main():
    if not SOURCE.exists():
        raise SystemExit('Ajoutez audio/nuitsorc-loop.mp3 avant de régénérer les mondes.')
    source, rate = sf.read(SOURCE, dtype='float64', always_2d=True)
    if rate != SR or source.shape[1] != 2:
        raise SystemExit('Le thème doit être stéréo à 44,1 kHz.')
    source = source[ENCODER_DELAY:]
    for spec in SPECS:
        samples = compose(source, spec)
        path = OUT / f"{spec['id']}.mp3"
        encode_mp3(path, samples)
        print(f"{spec['id']:10} {len(samples):8} échantillons  {len(samples)/(SR*spec['tempo']):6.3f} s au tempo  "
              f"{path.stat().st_size/1024:6.0f} Kio  {spec['title']}")
    print('Menu, arrivée du boss et arrivées ordinaires conservés sans réencodage.')


if __name__ == '__main__':
    main()
