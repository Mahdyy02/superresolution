import React from 'react';
import AudioUploader from './AudioUploader';

window.addEventListener("beforeunload", () => {
  navigator.sendBeacon("/cancel"); 
});

const App = () => {
  return (
    <div>
      <h1 style={{ textAlign: 'center' }}>SuperResolution</h1>
      <AudioUploader />
    </div>
  );
};

export default App;
