const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const logger = require('../../utils/logger');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '../../../../config/lifeboard.config.yml');
const TEMPLATE_CONFIG_PATH = path.join(__dirname, '../../../../config/lifeboard.config.yml.template');

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath || DEFAULT_CONFIG_PATH;
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn(`Configuration file not found at ${this.configPath}. Attempting to use template.`);
        if (fs.existsSync(TEMPLATE_CONFIG_PATH)) {
          // In a real scenario, you might copy the template to the expected path
          // For now, we'll just log and proceed with a default or empty config.
          // Or, for MVP, we can attempt to load directly from template for now,
          // with a strong recommendation for the user to create their own.
          logger.info(`Using template configuration from ${TEMPLATE_CONFIG_PATH}. Please create a lifeboard.config.yml.`);
          this.configPath = TEMPLATE_CONFIG_PATH; // Use template if main config is missing
        } else {
          logger.error(`Template configuration file also not found at ${TEMPLATE_CONFIG_PATH}. Proceeding with minimal default configuration.`);
          this.config = this.getDefaults(); // Fallback to hardcoded defaults
          return;
        }
      }

      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      let loadedConfig = yaml.load(fileContents);

      // Basic variable substitution from environment variables
      // This is a simplified version. A more robust solution might use a templating engine
      // or iterate through all string values.
      loadedConfig = this.substituteEnvVars(loadedConfig);

      this.config = { ...this.getDefaults(), ...loadedConfig }; // Merge with defaults
      logger.info(`Configuration loaded successfully from ${this.configPath}`);

    } catch (error) {
      logger.error(`Failed to load or parse configuration from ${this.configPath}: ${error.message}`, { stack: error.stack });
      logger.warn('Falling back to default configuration.');
      this.config = this.getDefaults();
    }
  }

  substituteEnvVars(config) {
    // Simple substitution for values like "${VAR_NAME}"
    const substitute = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/\$\{(.*?)\}/g, (match, envVarName) => {
            return process.env[envVarName] || match; // Replace if env var exists, otherwise keep original
          });
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          substitute(obj[key]); // Recurse for nested objects
        }
      }
    };
    substitute(config);
    return config;
  }

  getDefaults() {
    // Define some hardcoded defaults in case the config file is missing or corrupted
    return {
      database: {
        type: "postgresql",
        host: "localhost", // This will be overridden by docker-compose usually
        port: 5432,
        database: "lifeboard",
        username: "user",
        password: "password",
        ssl: false,
      },
      dataSources: {},
      ai: {
        provider: "mem0", // Placeholder
        config: {},
        prompts: {
          dailySummary: "Default summary prompt."
        }
      },
      server: {
        port: process.env.PORT || 3000,
        cors: {
          origin: ["http://localhost:3001"] // Default frontend
        }
      },
      logging: {
        level: "info",
        file: "./logs/lifeboard.log",
        console: true
      },
      mvp_settings: {
        ai_chat_mode: "echo",
        daily_summary_mode: "template"
      }
    };
  }

  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    return value !== undefined ? value : defaultValue;
  }

  getEffectiveConfig() {
    return this.config;
  }
}

// Singleton instance
// The path can be made configurable via an environment variable if needed
const configManagerInstance = new ConfigManager(process.env.LIFEBOARD_CONFIG_PATH);

module.exports = configManagerInstance;
