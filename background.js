// Handle Spotify authentication and background tasks
// const REDIRECT_URI = chrome.identity.getRedirectURL();
const REDIRECT_URI =
  'https://hkjmddjpkjmmnhapealcokhehnoeoogk.chromiumapp.org/';
// const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = ['user-read-currently-playing'];
const SERVER_URL = 'http://localhost:3000';

let accessToken = null;

async function getAuthToken() {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `${SERVER_URL}/auth/spotify?redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&state=${state}`;

    console.log('Auth URL:', REDIRECT_URI, authUrl, 'wee'); // Debug log

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    console.log('Redirect URL:', redirectUrl); // Debug log

    if (redirectUrl) {
      const hash = redirectUrl.split('#')[1];
      const params = new URLSearchParams(hash);
      accessToken = params.get('access_token');
      return accessToken;
    }
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getToken') {
    getAuthToken().then((token) => {
      sendResponse({ token });
    });
    return true; // Required for async response
  }

  if (request.type === 'checkAuth') {
    sendResponse({ isAuthenticated: !!accessToken });
    return true;
  }
});
