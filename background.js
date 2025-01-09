// Handle Spotify authentication and background tasks
let accessToken = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getToken') {
    sendResponse({ token: accessToken });
  }
});
