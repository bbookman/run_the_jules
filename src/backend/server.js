const express = require('express');
const logger = require('./utils/logger');
const config = require('./services/storage/ConfigManager');

const app = express();
// Use port from config, fallback to environment variable, then default
const PORT = config.get('server.port', process.env.PORT || 3000);

// Middleware
app.use(express.json()); // For parsing application/json

// Basic Route
app.get('/', (req, res) => {
  res.send('Lifeboard Backend is running!');
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  // Basic health check, can be expanded later
  // For example, check DB connection status
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString(), version: config.get('version', 'N/A') });
});

// Placeholder for future routes
const calendarRoutes = require('./api/routes/calendar');
const chatRoutes = require('./api/routes/chat');
const dataRoutes = require('./api/routes/data');

app.use('/api/calendar', calendarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/data', dataRoutes);


// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body // Be cautious logging request bodies if they contain sensitive info
  });
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Something broke!',
      // Optionally include stack in development
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// Handle 404 for routes not found
app.use((req, res, next) => {
  res.status(404).json({ error: { message: `Not Found - ${req.method} ${req.originalUrl}` } });
});


app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Current environment: ${process.env.NODE_ENV || 'development'}`);
  // logger.debug('Effective configuration:', config.getEffectiveConfig()); // Use debug level for verbose logs
});

module.exports = app; // For potential testing
