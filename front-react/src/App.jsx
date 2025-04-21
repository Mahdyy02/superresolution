import React from 'react';
import AudioUploader from './AudioUploader';

window.addEventListener("beforeunload", () => {
  navigator.sendBeacon("/cancel"); 
});

const App = () => {
  return (
    <div>
      <AudioUploader />
    </div>
  );
};

export default App;
