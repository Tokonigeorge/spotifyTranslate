let popupPort = null;
let currentSongData = null;

// Listen for connection from popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPort = port;
    console.log('Popup connected');

    if (currentSongData) {
      popupPort.postMessage({
        type: 'lyricsUpdate',
        songData: currentSongData,
      });
    }

    port.onDisconnect.addListener(() => {
      console.log('Popup disconnected');
      popupPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'songDataUpdate') {
    currentSongData = request?.songData;
    console.log('currentsongdata', currentSongData);
    if (popupPort) {
      popupPort.postMessage({
        type: 'lyricsUpdate',
        songData: currentSongData,
      });
    }

    sendResponse({ success: true });
  }

  if (request.action === 'getCurrentSongData') {
    // Send the song data back to the popup script

    sendResponse({ songData: currentSongData });
  }

  return true;
});
