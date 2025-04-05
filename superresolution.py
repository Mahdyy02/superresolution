from enhance import enhance
from process import segment_audio, concat_audio
from clearvoice import ClearVoice

class SuperResolution:

    def __init__(self, audio_file, output_rate=44100):

        self.audio = audio_file
        self.output_rate = output_rate
    
    def enhance(self, output_name="enhanced_audio.wav"):

        myClearVoice = ClearVoice(task='speech_enhancement', model_names=['MossFormer2_SE_48K'])
        segment_audio(self.audio)
        enhance(output_rate=self.output_rate, hidden_features=256, hidden_layers=4, steps=1000)
        concat_audio(output_file_name=output_name)

        for _ in range(5):
            output_wav = myClearVoice(input_path=output_name)

        myClearVoice.write(output_wav, output_path=output_name)


######################################################################

superResolution = SuperResolution("hello.wav", output_rate=96000)
superResolution.enhance(output_name="enhanced_hello.wav")