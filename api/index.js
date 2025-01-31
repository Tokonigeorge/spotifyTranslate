import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import helmet from 'helmet';

dotenv.config();

const allowedOrigins = [
  'chrome-extension://your-extension-id',
  'https://your-frontend-url.com',
];

const app = express();
// app.use(cors());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin === undefined) {
        // Allow requests with no origin (e.g., Postman, curl)
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  })
);
app.use(express.json());
app.use(helmet());

const TRANSLATION_API = process.env.TRANSLATION_API + '/single?client=gtx&dt=t';

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Endpoint to translate text
app.post('/api/translate', async (req, res) => {
  const { text, targetLanguage } = req.body;

  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const textArray = Array.isArray(text) ? text : [text];
    const combinedText = textArray.join('\n');
    const response = await fetch(
      `${TRANSLATION_API}&sl=auto&tl=${targetLanguage}&q=${encodeURIComponent(
        combinedText
      )}`
    );
    if (!response.ok) {
      throw new Error(`Translation failed with status: ${response.status}`);
    }

    const data = await response.json();
    const translatedTexts = data[0] || [];
    const cleanedTranslatedTexts = translatedTexts.map((translation) => {
      if (Array.isArray(translation) && translation[0]) {
        return translation[0].trim();
      }
      return '';
    });

    res.json({
      translatedText: cleanedTranslatedTexts,
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/api`);
});

export default app;
