from superresolution import SuperResolution
import os

class Client:

    def __init__(self, id, audio_file):
        
        self.id = id
        self.audio_file = audio_file
    
    def query(self, output_rate=44100, quality="good"):

        hidden_features = None
        hidden_layers = None
        steps = None

        if quality == "good":
            hidden_features = 256
            hidden_layers = 4
            steps = 3000
        elif quality == "excellent":
            hidden_features = 512
            hidden_layers = 5
            steps = 2500
        elif quality == "perfect":
            hidden_features = 512
            hidden_layers = 6
            steps = 2500
        
        if not hidden_features or not hidden_layers or not steps:
            raise Exception("Error: Incorrect quality parameter")
        
        superResolution = SuperResolution(audio_file=self.audio_file, output_rate=output_rate)

        os.makedirs("result", exist_ok=True)
        superResolution.enhance(output_name=f"result/tmp_enhanced_audio_{self.id}.wav", hidden_features=hidden_features, hidden_layers=hidden_layers,
                                steps=steps, input_folder=f"output_segments_{self.id}", output_folder=f"enhanced_segments_{self.id}")

