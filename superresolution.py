from enhance import enhance
from process import segment_audio, concat_audio
from clearvoice import ClearVoice
import os

class SuperResolution:

    def __init__(self, audio_file, output_rate=44100):

        self.audio = audio_file
        self.output_rate = output_rate
    
    def enhance(self, output_name="enhanced_audio.wav", hidden_features=256, hidden_layers=4, steps=1000,
                      input_folder="output_segments", output_folder="enhanced_segments"):

        myClearVoice = ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])

        segment_audio(self.audio, output_dir=input_folder)

        enhance(output_rate=self.output_rate, hidden_features=hidden_features, hidden_layers=hidden_layers, 
                steps=steps, input_folder=input_folder, output_folder=output_folder)
        concat_audio(output_file_name=output_name, output_path=output_folder)

        for _ in range(5):
            output_wav = myClearVoice(input_path=output_name)
        
        myClearVoice.write(output_wav, output_path=output_name.replace("tmp_", ""))
        os.remove(output_name)