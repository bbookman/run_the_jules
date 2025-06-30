#!/bin/bash
# Lifeboard MVP Installation Helper Script (for technical users)

set -e # Exit immediately if a command exits with a non-zero status.

echo "🚀 Starting Lifeboard MVP Setup..."

# --- Configuration Check & Creation ---
echo "------------------------------------"
echo "1. Configuring Environment (.env)..."
if [ -f ".env" ]; then
  echo "   ✅ '.env' file already exists. Please ensure it's correctly configured."
else
  if [ -f ".env.template" ]; then
    cp .env.template .env
    echo "   ✅ '.env.template' copied to '.env'."
    echo "   ⚠️  ACTION REQUIRED: Please edit the '.env' file with your database credentials and API keys."
  else
    echo "   ❌ ERROR: '.env.template' not found. Cannot create '.env'. Please ensure the template exists."
    exit 1
  fi
fi

echo "------------------------------------"
echo "2. Configuring Application (config/lifeboard.config.yml)..."
CONFIG_DIR="config"
CONFIG_FILE_TEMPLATE="${CONFIG_DIR}/lifeboard.config.yml.template"
CONFIG_FILE="${CONFIG_DIR}/lifeboard.config.yml"

if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    echo "   ✅ Created directory '$CONFIG_DIR'."
fi

if [ -f "$CONFIG_FILE" ]; then
  echo "   ✅ '${CONFIG_FILE}' already exists. Review it for any necessary adjustments (e.g., weather location)."
else
  if [ -f "$CONFIG_FILE_TEMPLATE" ]; then
    cp "$CONFIG_FILE_TEMPLATE" "$CONFIG_FILE"
    echo "   ✅ '${CONFIG_FILE_TEMPLATE}' copied to '${CONFIG_FILE}'."
    echo "   ⚠️  ACTION REQUIRED: Review '${CONFIG_FILE}', especially 'dataSources.weather.location'."
  else
    echo "   ❌ ERROR: '${CONFIG_FILE_TEMPLATE}' not found. Cannot create '${CONFIG_FILE}'."
    # Consider if the app can run with pure defaults from ConfigManager.js if template is missing
    # For now, let's make it a strong recommendation or error.
    # exit 1
     echo "   ⚠️  Warning: Template config missing. Application will use internal defaults which might not be optimal."
  fi
fi
echo "   Ensure API keys in '.env' are set for data sources you enable in '${CONFIG_FILE}'."


# --- Docker Check ---
echo "------------------------------------"
echo "3. Checking Docker and Docker Compose..."
if ! command -v docker &> /dev/null; then
  echo "   ❌ ERROR: Docker could not be found. Please install Docker."
  echo "   See: https://docs.docker.com/get-docker/"
  exit 1
else
  echo "   ✅ Docker found: $(docker --version)"
fi

if ! command -v docker-compose &> /dev/null; then
  # Docker Compose V2 might be 'docker compose' (with a space)
  if ! docker compose version &> /dev/null; then
    echo "   ❌ ERROR: Docker Compose could not be found. Please install Docker Compose."
    echo "   See: https://docs.docker.com/compose/install/"
    exit 1
  else
     echo "   ✅ Docker Compose (V2 plugin) found: $(docker compose version)"
  fi
else
  echo "   ✅ Docker Compose (V1 standalone) found: $(docker-compose --version)"
fi


# --- Initial Docker Operations (Optional: Pre-pull images or DB init) ---
# For MVP, docker-compose up will handle this.
# Could add:
# echo "------------------------------------"
# echo "4. Initializing Database Volume (if not exists)..."
# docker volume create --name=lifeboard_postgres_data > /dev/null 2>&1 || true # Create if not exists
# echo "   ✅ Database volume 'lifeboard_postgres_data' ensured."

echo "------------------------------------"
echo "4. Building and Starting Application with Docker Compose..."
echo "   This might take a few minutes the first time..."
# Check if docker-compose uses a space or hyphen
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker compose"
else
  DOCKER_COMPOSE_CMD="docker-compose"
fi

# Attempt to build and run
if $DOCKER_COMPOSE_CMD up --build -d; then
  echo "   ✅ Docker containers started successfully (backend, frontend, database)."
else
  echo "   ❌ ERROR: Docker Compose failed to start containers. Please check the output above for errors."
  echo "   Common issues:"
  echo "     - Ports 3000, 3001, or 5432 might be in use by other applications."
  echo "     - Errors in Dockerfile or docker-compose.yml."
  echo "     - Insufficient system resources."
  exit 1
fi

echo "------------------------------------"
echo "🎉 Lifeboard Setup Steps Completed!"
echo ""
echo "➡️  Access the Lifeboard frontend at: http://localhost:3001"
echo "➡️  The backend API is available at: http://localhost:3000"
echo "    (Health check: http://localhost:3000/health)"
echo ""
echo "💡 Next Steps:"
echo "   - If you haven't yet, **edit '.env' and '${CONFIG_FILE}'** with your API keys and preferences."
echo "   - After editing config, you might need to restart the backend container if it was already running:"
echo "     \`$DOCKER_COMPOSE_CMD restart lifeboard-backend\`"
echo "   - Populate data:"
echo "     - Add mood: \`curl -X POST -H \"Content-Type: application/json\" -d '{\"date\":\"YYYY-MM-DD\",\"mood_score\":7}' http://localhost:3000/api/data/mood\`"
echo "     - Trigger syncs: \`curl -X POST http://localhost:3000/api/data/sync/weather\` (replace 'weather' with 'limitless' or 'bee' if keys are set)"
echo "   - View logs: \`$DOCKER_COMPOSE_CMD logs -f lifeboard-backend\` or \`$DOCKER_COMPOSE_CMD logs -f lifeboard-frontend\`"
echo ""
echo "To stop Lifeboard: \`$DOCKER_COMPOSE_CMD down\`"
echo "To stop and remove data volumes (use with caution!): \`$DOCKER_COMPOSE_CMD down -v\`"
echo "------------------------------------"

# Make this script executable: chmod +x install.sh
# Run it: ./install.sh
