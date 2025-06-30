const winston = require('winston');
const path = require('path');

// Determine log file path from environment or config, default to 'logs/lifeboard.log'
// This basic version doesn't use the full ConfigManager yet, as that's also being set up.
// For now, we can use an environment variable or a simple default.
const LOG_FILE_PATH = process.env.LOG_FILE || path.join(__dirname, '../../../logs/lifeboard.log'); // Adjust path as needed
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Ensure logs directory exists (basic check, ideally handled by startup script or Docker volume mount)
const fs = require('fs');
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Log the full stack trace
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lifeboard-backend' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: LOG_FILE_PATH })
  ]
});

// If not in production, also log to the `console` with a simpler format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Stream interface for morgan logging (optional)
// logger.stream = {
//   write: function(message, encoding) {
//     logger.info(message.trim());
//   },
// };

module.exports = logger;
