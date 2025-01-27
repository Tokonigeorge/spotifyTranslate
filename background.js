//leave as is, connect to port, don't send message to popup though
//store in memory
//have a scheckcurrentsongdata that gets triggered when the popup asks for data
let popupPort = null; // To keep track of the connected popup
// let lastLyrics = [];
// let lastSongData = null;

let currentSongData = null;
// Listen for connection from popup
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPort = port; // Save the connection for later use
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

// Example: Listen for data updates from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'songDataUpdate') {
    console.log('trigger too', request.songData);
    // Send the updated lyrics to the popup if it's connected
    currentSongData = request?.songData;
    if (popupPort) {
      // lastSongData = currentSongData;

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
    console.log('im running bg', currentSongData);
    // Send the song data back to the popup script

    sendResponse({ songData: currentSongData });
  }

  return true;
});
