import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TRANSLATION_API = process.env.TRANSLATION_API + '/single?client=gtx&dt=t';

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
    // // Split the response back into lines
    const translatedTexts = data[0] || [];
    const cleanedTranslatedTexts = translatedTexts.map((translation) => {
      // Ensure translation is valid
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
    throw new Error(`Translation failed`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
