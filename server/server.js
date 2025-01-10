import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint to initiate Spotify auth
app.get('/auth/spotify', (req, res) => {
  const { redirect_uri, state } = req.query;
  console.log(redirect_uri, state, 'wahala');
  if (!process.env.SPOTIFY_CLIENT_ID) {
    console.error('SPOTIFY_CLIENT_ID is not set in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const scope = 'user-read-currently-playing';
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${redirect_uri}&scope=${scope}&state=${state}`;

  console.log('Redirecting to:', authUrl); // Debug log
  res.redirect(authUrl);
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
