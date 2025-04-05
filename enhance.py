import torch.nn.functional as F
from torch.utils.data import DataLoader
import numpy as np
from models.siren import AudioFile, Siren
import torch
from scipy.io import wavfile
from process import delete_directory
from pathlib import Path
import copy

def enhance(output_rate=44100, hidden_features=512, hidden_layers=5, steps=10000, input_folder="output_segments", output_folder="enhanced_segments"):

    directory = Path(input_folder)

    for file in directory.iterdir():
        if file.is_file():

            # print(file)
                    
            bach_audio = AudioFile(file)
            
            dataloader = DataLoader(bach_audio, shuffle=False, batch_size=1, pin_memory=True, num_workers=0)
            
            # Note that we increase the frequency of the first layer to match the higher frequencies of the
            # audio signal. Equivalently, we could also increase the range of the input coordinates.
            audio_siren = Siren(in_features=1, out_features=1, hidden_features=hidden_features, 
                                hidden_layers=hidden_layers, first_omega_0=3000, outermost_linear=True)
            audio_siren.cuda()
            
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            
            audio_siren.to(device)
            
            model_input, ground_truth = next(iter(dataloader))
            model_input, ground_truth = model_input.to(device), ground_truth.to(device)
            
            total_steps = steps
            steps_til_summary = 100
            
            optim = torch.optim.Adam(lr=1e-4, params=audio_siren.parameters())
            
            model_input, ground_truth = next(iter(dataloader))
            model_input, ground_truth = model_input.cuda(), ground_truth.cuda()
            
            best_loss = float('inf')
            best_model_state = None
            
            # Training loop
            for step in range(total_steps):
                model_output, coords = audio_siren(model_input)
                loss = F.mse_loss(model_output, ground_truth)
                
                if not step % steps_til_summary:
                    print("Step %d, Total loss %0.6f" % (step, loss))
                        
                # Check for the best model based on loss
                if loss < best_loss:
                    best_loss = loss
                    best_model_state = copy.deepcopy(audio_siren.state_dict())  # Store only the state_dict
                
                # Optimization step
                optim.zero_grad()
                loss.backward()
                optim.step()
            
            # After training, load the best model state directly into the model
            audio_siren.load_state_dict(best_model_state)  # Load the state_dict directly
            audio_siren.eval()
            
            # Load original audio to get sample rate and duration
            input_rate, audio_data = wavfile.read(file)
            audio_data = audio_data.astype(np.float32)
            audio_data = audio_data / np.max(np.abs(audio_data))  # Normalize to [-1, 1]
            
            # output_rate = 96000
            
            # Calculate duration of the audio in seconds
            duration = len(audio_data) / input_rate
            # Calculate the number of samples for the higher output rate
            num_output_samples = int(duration * output_rate)
            
            # Generate high-resolution time points for the new sample rate
            high_res_timepoints = torch.linspace(-1, 1, num_output_samples).unsqueeze(-1).to(device)
            
            # Get model predictions for high-resolution output
            with torch.no_grad():
                high_res_output, _ = audio_siren(high_res_timepoints)
                high_res_output = high_res_output.squeeze().cpu().numpy()
            
            # Convert to int16 format for WAV
            output_audio = (high_res_output * 32767).astype(np.int16)
            
            # Save the enhanced audio at the higher sample rate
            output_dir = Path(output_folder)
            output_dir.mkdir(parents=True, exist_ok=True)
            reconstructed_wav_filename = output_dir / f"enhanced_{file.name}"
            wavfile.write(reconstructed_wav_filename, output_rate, output_audio)
            
            print(f"Enhanced audio saved to {reconstructed_wav_filename} at {output_rate} Hz")
    
    delete_directory(input_folder)
