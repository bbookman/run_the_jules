const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../services/storage/ConfigManager');
const AIProvider = require('../../services/ai/AIProvider');

// POST /api/chat/message
router.post('/message', async (req, res, next) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    logger.info(`Chat message received: "${message}"`, { context });

    // const chatMode = config.get('mvp_settings.ai_chat_mode', 'echo'); // AIProvider will handle mode logic

    // Delegate chat processing to AIProvider
    // AIProvider's chat method will internally check mvp_settings.ai_chat_mode
    // and use the appropriate logic (echo, basic_keyword, or actual AI if configured).
    const aiChatResponse = await AIProvider.chat(message, context);

    res.json({
      response: aiChatResponse.text,
      sources: aiChatResponse.sources,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error(`Error processing chat message: ${error.message}`, { stack: error.stack, body: req.body });
    next(error);
  }
});

module.exports = router;
