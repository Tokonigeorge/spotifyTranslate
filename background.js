// Handle Spotify authentication and background tasks
// const REDIRECT_URI = chrome.identity.getRedirectURL();

// import { fetchLyrics } from './src/services/lyrics';

export async function translateText(text, targetLanguage) {
  try {
    const response = await fetch(`${SERVER_URL}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLanguage,
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

async function fetchLyrics(trackName, artistName) {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/lyrics/search?track=${encodeURIComponent(
        trackName
      )}&artist=${encodeURIComponent(artistName)}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.lyrics) return null;

    return {
      lyrics: data.lyrics,
      url: data.url,
      title: data.title,
      artist: data.artist,
      albumArt: data.album_art,
    };
  } catch (error) {
    console.error('Error searching lyrics:', error);
    return null;
  }
}

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

    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (redirectUrl) {
      const hash = redirectUrl.split('#')[1];
      const params = new URLSearchParams(hash);
      accessToken = params.get('access_token');
      await checkCurrentTrack();
      return accessToken;
    }
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function checkCurrentTrack() {
  try {
    const response = await fetch(
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) return null;

    const currentTrack = await response.json();
    if (!currentTrack || !currentTrack.item) return null;

    if (currentTrack) {
      const trackInfo = {
        name: currentTrack.item?.name,
        artists: currentTrack.item?.artists?.map((artist) => artist.name),
        id: currentTrack.item?.id,
      };

      const lyricsInfo = await fetchLyrics(
        trackInfo.name,
        trackInfo.artists[0]
      );

      if (lyricsInfo) {
        trackInfo.lyrics = lyricsInfo.lyrics;
        trackInfo.lyricsUrl = lyricsInfo.url;
        trackInfo.albumArt = lyricsInfo.albumArt;
      }
      await chrome.storage.local.set({ currentTrack: trackInfo });
      return trackInfo;
    } else {
      await chrome.storage.local.remove('currentTrack');
      return null;
    }
  } catch (error) {
    console.error('Error checking current track:', error);
    return null;
  }
}

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
  console.log('trigger too');
  if (request.type === 'lyricSend') {
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

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.type === 'lyricSend') {
//     console.log('send 1');
//     chrome.runtime.sendMessage({
//       type: 'lyricsUpdate',
//       lyrics: request.lyrics,
//     });
//     sendResponse({ success: true });
//     return true;
//   }
//   if (request.type === 'getToken') {
//     getAuthToken().then((token) => {
//       sendResponse({ token });
//     });
//     return true;
//   }

//   if (request.type === 'checkAuth') {
//     sendResponse({ isAuthenticated: !!accessToken });
//     return true;
//   }

//   if (request.type === 'getCurrentTrack') {
//     checkCurrentTrack().then((track) => {
//       sendResponse({ track });
//     });
//     return true;
//   }
// });
