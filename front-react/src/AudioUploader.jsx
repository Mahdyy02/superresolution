import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './AudioUploader.css';

import playImage from './assets/play.png';
import pauseImage from './assets/pause.png';

const AudioUploader = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveRef = useRef(null);
  const wavesurfer = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedQuality, setSelectedQuality] = useState('Good');
  const [rateIndex, setRateIndex] = useState(0);
  const [samplingRate, setSamplingRate] = useState(44100);
  const rateOptions = [16000, 22050, 44100, 96000, 128000];
  const [enhancedAudioBlob, setEnhancedAudioBlob] = useState(null);
  const enhancedWaveRef = useRef(null);
  const enhancedWavesurfer = useRef(null);
  const [isEnhancedPlaying, setIsEnhancedPlaying] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => {
    setRateIndex(rateOptions.indexOf(samplingRate));
  }, [samplingRate]);

  useEffect(() => {
    if (audioFile && waveRef.current) {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
  
      wavesurfer.current = WaveSurfer.create({
        container: waveRef.current,
        waveColor: '#ccc',
        progressColor: '#007bff',
        height: 80,
        responsive: true,
        barWidth: 2,
      });
  
      wavesurfer.current.load(URL.createObjectURL(audioFile));
  
      wavesurfer.current.on('finish', () => {
        setIsPlaying(false);
      });
    }
  
    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioFile]);  

  const handleFile = (file) => {
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
  
      const formData = new FormData();
      formData.append('file', file);
  
      fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          console.log("Upload successful:", data);
        })
        .catch(err => {
          console.error("Upload failed:", err);
        });
    }
  };  

  useEffect(() => {
    if (enhancedAudioBlob && enhancedWaveRef.current) {
      if (enhancedWavesurfer.current) {
        enhancedWavesurfer.current.destroy();
      }
  
      enhancedWavesurfer.current = WaveSurfer.create({
        container: enhancedWaveRef.current,
        waveColor: '#ccc',
        progressColor: '#28a745',
        height: 80,
        responsive: true,
        barWidth: 2,
      });
  
      const url = URL.createObjectURL(enhancedAudioBlob);
      enhancedWavesurfer.current.load(url);
  
      enhancedWavesurfer.current.on('finish', () => {
        setIsEnhancedPlaying(false);
      });
  
      return () => {
        if (enhancedWavesurfer.current) {
          enhancedWavesurfer.current.destroy();
        }
      };
    }
  }, [enhancedAudioBlob]);  

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const togglePlay = () => {
    if (wavesurfer.current) {
      const isAtEnd =
        Math.abs(wavesurfer.current.getCurrentTime() - wavesurfer.current.getDuration()) < 0.1;

      if (isPlaying) {
        wavesurfer.current.pause();
        setIsPlaying(false);
      } else {
        if (isAtEnd) {
          wavesurfer.current.seekTo(0);
        }
        wavesurfer.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleEnhancedPlay = () => {
    if (enhancedWavesurfer.current) {
      const isAtEnd =
        Math.abs(enhancedWavesurfer.current.getCurrentTime() - enhancedWavesurfer.current.getDuration()) < 0.1;
  
      if (isEnhancedPlaying) {
        enhancedWavesurfer.current.pause();
        setIsEnhancedPlaying(false);
      } else {
        if (isAtEnd) {
          enhancedWavesurfer.current.seekTo(0);
        }
        enhancedWavesurfer.current.play();
        setIsEnhancedPlaying(true);
      }
    }
  };  

  const handleEnhance = async () => {
    console.log("Enhancement started.");
  
    if (enhancedWavesurfer.current) {
      console.log("Destroying previous enhanced waveform.");
      enhancedWavesurfer.current.destroy();
      enhancedWavesurfer.current = null;
    }
  
    setEnhancedAudioBlob(null);
    setIsEnhancedPlaying(false);
    setIsEnhancing(true);
  
    const formData = new FormData();
    formData.append('quality', selectedQuality);
    formData.append('output_rate', samplingRate);
  
    console.log("FormData prepared:", {
      quality: selectedQuality,
      output_rate: samplingRate
    });
  
    try {
      console.log("Sending enhancement request to backend...");
      const response = await fetch('http://localhost:8000/enhance', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
  
      console.log("Response status:", response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error("Server responded with an error page:", text);
        throw new Error(`Server error (${response.status})`);
      }
  
      const data = await response.json();
      console.log("Received response JSON from backend:", data);
  
      if (!data.check_status_url || !data.download_url) {
        throw new Error("Incomplete response from server. Missing check_status_url or download_url.");
      }
  
      const statusUrl = `http://localhost:8000${data.check_status_url}`;
      const downloadUrl = `http://localhost:8000${data.download_url}`;
  
      const checkStatus = async () => {
        const maxTries = 1000;
        let tries = 0;
  
        console.log("Polling status at:", statusUrl);
  
        while (tries < maxTries) {
          const statusResponse = await fetch(statusUrl);
          const status = await statusResponse.json();
          console.log(`Status check #${tries + 1}:`, status);
  
          if (status.ready === true) {
            console.log("Enhancement complete.");
            return true;
          } else if (status.status === "failed") {
            throw new Error("Enhancement failed.");
          }
  
          await new Promise(resolve => setTimeout(resolve, 2000));
          tries++;
        }
  
        throw new Error("Enhancement timed out.");
      };
  
      await checkStatus();
  
      console.log("Downloading enhanced audio from:", downloadUrl);
      const audioBlob = await fetch(downloadUrl).then(r => r.blob());
      console.log("Audio blob downloaded. Size:", audioBlob.size);
  
      setEnhancedAudioBlob(audioBlob);
      setIsEnhancing(false);
      console.log("Enhancement process completed and UI updated.");
  
    } catch (err) {
      console.error("Enhancement error:", err);
      setIsEnhancing(false);
    }
  };
        
  return (
    <div className="uploader-container">
      {!audioFile ? (
        <div
          className="drop-zone"
          onClick={() => fileInputRef.current.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p>Click or drag an audio file here</p>
          <input
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <>
          <div className="audio-player">
            <button onClick={togglePlay} className="play-button">
              <img
                src={isPlaying ? pauseImage : playImage}
                alt={isPlaying ? 'Pause' : 'Play'}
              />
            </button>

            <div ref={waveRef} className="waveform-container" />
          </div>

          <div className="enhancement-section">
            <h3>Select Quality</h3>
            <div className="quality-options">
              {['Good', 'Excellent', 'Perfect'].map((option) => (
                <label
                  key={option}
                  className={`radio-option ${selectedQuality === option ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={option}
                    checked={selectedQuality === option}
                    onChange={() => setSelectedQuality(option)}
                  />
                  {option}
                </label>
              ))}
            </div>

            <div className="slider-section">
              <h3>Output Sampling Rate: {samplingRate} Hz</h3>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={rateIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  setRateIndex(idx);
                  setSamplingRate(rateOptions[idx]);
                }}
              />
              <div className="rate-labels">
                {rateOptions.map((rate, idx) => (
                  <span key={rate} className={idx === rateIndex ? 'active-rate' : ''}>{rate}</span>
                ))}
              </div>
            </div>

            <button className="enhance-btn" onClick={handleEnhance}>
              Enhance
            </button>

            {enhancedAudioBlob && (
              <>
                <div className="audio-player">
                  <button onClick={toggleEnhancedPlay} className="play-button">
                    <img
                      src={isEnhancedPlaying ? pauseImage : playImage}
                      alt={isEnhancedPlaying ? 'Pause' : 'Play'}
                    />
                  </button>
                  <div ref={enhancedWaveRef} className="waveform-container" />
                </div>

                <button
                  onClick={() => {
                    const url = window.URL.createObjectURL(enhancedAudioBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'enhanced_audio.wav';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  }}
                  className="enhance-btn"
                >
                  Download Enhanced Audio
                </button>
              </>
            )}

            {isEnhancing && (
              <div className="loading-container">
                <img src="src\loading.gif" alt="Enhancing..." className="loading-gif" />
                <p>Enhancing audio...</p>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default AudioUploader;