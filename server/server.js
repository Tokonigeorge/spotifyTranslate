import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { TranslationServiceClient } from '@google-cloud/translate';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Google Cloud Translation client
const translationClient = new TranslationServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
});
// Endpoint to translate text using LibreTranslate
app.post('/api/translate', async (req, res) => {
  const { text, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const request = {
      parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`,
      contents: Array.isArray(text) ? text : [text],
      mimeType: 'text/plain',
      sourceLanguageCode: 'en',
      targetLanguageCode: targetLanguage,
    };

    const [response] = await translationClient.translateText(request);
    const translations = response.translations.map((t) => t.translatedText);

    res.json({
      translatedText: Array.isArray(text) ? translations : translations[0],
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Endpoint to initiate Spotify auth
app.get('/auth/spotify', (req, res) => {
  const { redirect_uri, state } = req.query;

  if (!process.env.SPOTIFY_CLIENT_ID) {
    console.error('SPOTIFY_CLIENT_ID is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const scope = 'user-read-currently-playing';
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}`;

  res.redirect(authUrl);
});

// Endpoint to search for lyrics
app.get('/api/lyrics/search', async (req, res) => {
  const { track, artist } = req.query;

  if (!process.env.GENIUS_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Genius API token not configured' });
  }

  try {
    const searchResponse = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(
        `${track} ${artist}`
      )}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`,
        },
      }
    );
    if (!searchResponse.ok) {
      throw new Error('Failed to search song');
    }

    const searchData = await searchResponse.json();
    const hit = searchData.response.hits[0]?.result;

    if (!hit) {
      return res.json(null);
    }
    // Fetch and scrape lyrics from the Genius page
    const lyricsResponse = await fetch(hit.url);
    const html = await lyricsResponse.text();

    // Extract lyrics from the HTML using regex
    const lyricsMatch = html.match(
      /<div[^>]*data-lyrics-container="true"[^>]*>([^<]*(?:<(?!\/div)[^<]*)*)<\/div>/g
    );

    const lyrics = lyricsMatch
      ? lyricsMatch
          .map((container) => {
            // Remove HTML tags but keep line breaks
            return container
              .replace(/<br\/?>/gi, '\n') // Replace <br> tags with newlines
              .replace(/<[^>]+>/g, '') // Remove all other HTML tags
              .trim();
          })
          .join('\n')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0) // Remove empty lines
      : null;

    res.json({
      id: hit.id,
      title: hit.title,
      artist: hit.primary_artist.name,
      url: hit.url,
      lyrics: lyrics,
      album_art: hit.song_art_image_url,
    });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(
    'SPOTIFY_CLIENT_ID is',
    process.env.SPOTIFY_CLIENT_ID ? 'set' : 'not set'
  );
});
