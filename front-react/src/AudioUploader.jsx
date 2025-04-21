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
  const [fileName, setFileName] = useState('');

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
        waveColor: '#4A6CF7',
        progressColor: '#0EA5E9',
        height: 80,
        responsive: true,
        barWidth: 2,
        barGap: 3,
        barRadius: 2,
        cursorColor: '#0EA5E9',
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
      setFileName(file.name);
  
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
        waveColor: '#10B981',
        progressColor: '#059669',
        height: 80,
        responsive: true,
        barWidth: 2,
        barGap: 3,
        barRadius: 2,
        cursorColor: '#059669',
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
    <div className="app-container">
      <div className="header">
        <h1>Audio Enhancer</h1>
        <p className="subtitle">Improve your audio quality with AI-powered enhancement</p>
      </div>

      {!audioFile ? (
        <div className="upload-section">
          <div
            className="drop-zone"
            onClick={() => fileInputRef.current.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p className="upload-text">Click or drag an audio file here</p>
            <p className="upload-hint">Supported formats: MP3, WAV, FLAC, OGG</p>
            <input
              type="file"
              accept="audio/*"
              ref={fileInputRef}
              onChange={handleChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      ) : (
        <div className="workflow-container">
          <div className="workflow-section">
            <div className="section-header">
              <h2>1. Original Audio</h2>
              <div className="file-info">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 18.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
                  <path d="M15 2H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9"></path>
                  <path d="M15 2v6h6"></path>
                </svg>
                <span className="file-name">{fileName}</span>
              </div>
            </div>

            <div className="audio-player">
              <button onClick={togglePlay} className="play-button">
                {isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                )}
              </button>
              <div ref={waveRef} className="waveform-container" />
            </div>
          </div>

          <div className="workflow-section">
            <div className="section-header">
              <h2>2. Enhancement Settings</h2>
            </div>

            <div className="enhancement-settings">
              <div className="setting-group">
                <h3>Quality Level</h3>
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
              </div>

              <div className="setting-group">
                <h3>Output Sampling Rate: <span className="rate-value">{samplingRate} Hz</span></h3>
                <div className="slider-section">
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
              </div>

              <button className="enhance-btn" onClick={handleEnhance} disabled={isEnhancing}>
                {isEnhancing ? 'Enhancing...' : 'Enhance Audio'}
              </button>
            </div>
          </div>

          {isEnhancing && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Enhancing your audio...</p>
              <p className="loading-subtext">This may take a moment depending on file size and selected quality</p>
            </div>
          )}

          {enhancedAudioBlob && (
            <div className="workflow-section result-section">
              <div className="section-header">
                <h2>3. Enhanced Audio</h2>
              </div>
              <div className="audio-player enhanced-player">
                <button onClick={toggleEnhancedPlay} className="play-button">
                  {isEnhancedPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  )}
                </button>
                <div ref={enhancedWaveRef} className="waveform-container" />
              </div>

              <button
                onClick={() => {
                  const url = window.URL.createObjectURL(enhancedAudioBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'enhanced_' + fileName || 'enhanced_audio.wav';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                }}
                className="download-btn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download Enhanced Audio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioUploader;