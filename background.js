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
    // Handle disconnection
    port.onDisconnect.addListener(() => {
      console.log('Popup disconnected');
      popupPort = null;
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'songDataUpdate') {
    console.log('trigger too', request.songData);

    currentSongData = request?.songData;
    if (popupPort) {
      popupPort.postMessage({
        type: 'lyricsUpdate',
        songData: currentSongData,
      });
      console.log('I recieved a ping');
    }

    sendResponse({ success: true });
    // return true;
  }

  if (request.action === 'getCurrentSongData') {
    // Send the song data back to the popup script

    sendResponse({ songData: currentSongData });
  }

  return true;
});
