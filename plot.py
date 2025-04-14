import numpy as np
import matplotlib.pyplot as plt
from scipy.io import wavfile

# Load audio
fs_orig, original = wavfile.read("original.wav")
fs_corr, corrupted = wavfile.read("corrupted.wav")
fs_enh, enhanced = wavfile.read("enhanced.wav")

# Convert to mono if stereo
if original.ndim > 1:
    original = original[:, 0]
if corrupted.ndim > 1:
    corrupted = corrupted[:, 0]
if enhanced.ndim > 1:
    enhanced = enhanced[:, 0]

# Define skip and window durations
skip_ms = 200
window_ms = 2.27

# Convert to sample indices
start_orig = int(fs_orig * skip_ms / 1000)
end_orig = start_orig + 50

start_enh = int(fs_enh * skip_ms / 1000)
end_enh = start_enh + 218

# Extract segments
original_seg = original[start_orig:end_orig]
corrupted_seg = corrupted[start_orig:end_orig]
enhanced_seg = enhanced[start_enh:end_enh]

# Normalize to [-1, 1]
def normalize(x):
    return 2 * (x - np.min(x)) / (np.max(x) - np.min(x)) - 1

original_norm = normalize(original_seg)
corrupted_norm = normalize(corrupted_seg)
enhanced_norm = normalize(enhanced_seg)

# Time axes
time_orig = np.linspace(skip_ms, skip_ms + window_ms, 50)
time_enh = np.linspace(skip_ms, skip_ms + window_ms, 218)

# Plot
plt.figure(figsize=(10, 5))
plt.plot(time_orig, original_norm, label="Original", linewidth=2)
plt.plot(time_orig, corrupted_norm, label="Corrupted", linestyle='dashed')
plt.plot(time_enh, enhanced_norm, label="Enhanced", linestyle='dotted')
plt.title("Audio Segments")
plt.xlabel("Time (ms)")
plt.ylabel("Normalized Amplitude")
plt.ylim(-1.1, 1.1)
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()
