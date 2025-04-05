import os
from pydub import AudioSegment
from pathlib import Path
import numpy as np
from scipy.io import wavfile
import re
import shutil


def delete_directory(path):
    if os.path.exists(path) and os.path.isdir(path):
        shutil.rmtree(path)
        print(f"Deleted: {path}")
    else:
        print(f"Directory does not exist: {path}")


def segment_audio(audio_file, segment_duration=1000, output_dir="output_segments"):

    # Load the WAV file
    audio = AudioSegment.from_wav(audio_file)

    # Define segment duration
    segment_duration = 1000 # in ms
    total_length = len(audio)

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Split and save segments
    for i, start in enumerate(range(0, total_length, segment_duration)):
        segment = audio[start:start + segment_duration]
        segment.export(f"{output_dir}/segment_{i+1}.wav", format="wav")

    print(f"Audio split into {i+1} segments and saved in '{output_dir}'")


def concat_audio(output_path="enhanced_segments", output_file_name="enhanced_audio.wav"):

    # Define the directory with enhanced segments
    enhanced_dir = Path(output_path)

    enhanced_files = sorted(
        enhanced_dir.glob("*.wav"),
        key=lambda x: int(re.search(r'\d+', x.stem).group()) if re.search(r'\d+', x.stem) else float('inf')
    )

    # List to store audio data
    audio_segments = []

    # Read each file and append its audio data
    for file in enhanced_files:
        rate, data = wavfile.read(file)
        audio_segments.append(data)

    # Concatenate all audio segments into a single array
    concatenated_audio = np.concatenate(audio_segments)

    # Define the output file
    output_file = Path(output_file_name)

    # Save the concatenated audio
    wavfile.write(output_file, rate, concatenated_audio)

    print(f"Concatenated audio saved to {output_file}")
    delete_directory(output_path)

