// Handle Spotify authentication and background tasks
// const REDIRECT_URI = chrome.identity.getRedirectURL();
const REDIRECT_URI =
  'https://hkjmddjpkjmmnhapealcokhehnoeoogk.chromiumapp.org/';
// const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = ['user-read-currently-playing'];
const SERVER_URL = 'http://localhost:3000';

let accessToken = null;
let currentTrackId = null;
let pollInterval = null;

// chrome.storage.local.get('accessToken', (result) => {
//   accessToken = result.accessToken;
// });

chrome.storage.local.get(['accessToken', 'tokenExpiration'], (result) => {
  if (result.accessToken && result.tokenExpiration) {
    const now = Date.now();
    if (now < result.tokenExpiration) {
      accessToken = result.accessToken;
      startTrackPolling();
    } else {
      // Token expired, clean up
      chrome.storage.local.remove([
        'accessToken',
        'tokenExpiration',
        'currentTrack',
      ]);
    }
  }
});

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
      const expiresIn = params.get('expires_in');

      // Calculate expiration time and store both token and expiration
      const expirationTime = Date.now() + parseInt(expiresIn) * 1000;
      await chrome.storage.local.set({
        accessToken,
        tokenExpiration: expirationTime,
      });

      startTrackPolling();
      return accessToken;
    }
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function checkCurrentTrack() {
  try {
    // Check token expiration before making the request
    const { tokenExpiration } = await chrome.storage.local.get(
      'tokenExpiration'
    );
    if (tokenExpiration && Date.now() >= tokenExpiration) {
      accessToken = null;
      await chrome.storage.local.remove([
        'accessToken',
        'tokenExpiration',
        'currentTrack',
      ]);
      stopTrackPolling();
      return null;
    }

    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.item) return null;

    const newTrackId = data.item.id;

    // If track has changed, notify popup and update storage
    if (newTrackId !== currentTrackId) {
      currentTrackId = newTrackId;
      const trackInfo = {
        name: data.item.name,
        artists: data.item.artists.map((artist) => artist.name),
        id: data.item.id,
      };

      await chrome.storage.local.set({ currentTrack: trackInfo });
      chrome.runtime.sendMessage({ type: 'trackChanged', track: trackInfo });
    }

    return data;
  } catch (error) {
    console.error('Error checking current track:', error);
    return null;
  }
}

function startTrackPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  pollInterval = setInterval(checkCurrentTrack, POLLING_INTERVAL);
}

function stopTrackPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getToken') {
    getAuthToken().then((token) => {
      sendResponse({ token });
    });
    return true;
  }

  // if (request.type === 'checkAuth') {
  //   sendResponse({ isAuthenticated: !!accessToken });
  //   return true;
  // }

  if (request.type === 'checkAuth') {
    // Check both token existence and expiration
    chrome.storage.local.get(['accessToken', 'tokenExpiration'], (result) => {
      const isValid =
        result.accessToken &&
        result.tokenExpiration &&
        Date.now() < result.tokenExpiration;
      sendResponse({ isAuthenticated: isValid });
    });
    return true;
  }

  if (request.type === 'getCurrentTrack') {
    checkCurrentTrack().then((track) => {
      sendResponse({ track });
    });
    return true;
  }
});

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.type === 'getToken') {
//     getAuthToken().then((token) => {
//       sendResponse({ token });
//     });
//     return true; // Required for async response
//   }

//   if (request.type === 'checkAuth') {
//     sendResponse({ isAuthenticated: !!accessToken });
//     return true;
//   }
// });
