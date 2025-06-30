# Lifeboard - Your Interactive Reflection Space

Lifeboard is an interactive reflection space and powerful planning assistant. It seamlessly pulls from your digital history—conversations, activities, moods, and experiences—transforming each day into a personal newspaper. With AI assistance, you'll rediscover meaning in the everyday and take control of your future journey.

This project is currently in its Minimum Viable Product (MVP) stage, primarily targeting technical users comfortable with Docker, command-line interfaces, and configuration files.

## Vision

Lifeboard helps people discover patterns and insights in their own life data they wouldn't see otherwise, by organizing experiences around the critical dimensions of when and where they happened. For more, see the [Vision Statement](Foundational/lifeboard_vision_statement.md).

## Features (MVP)

*   **AI-Powered Life Exploration (Basic):**
    *   **Daily Summaries:** Template-based summaries at the top of each daily view.
    *   **Chat Interface:** A floating chat widget allowing basic interaction (echo mode or simple keyword responses for MVP).
*   **Calendar-Centric Interface:**
    *   **Monthly Calendar View:** Traditional calendar with indicators for days containing data.
    *   **Daily Newspaper View:** Displays aggregated data from various sources for a selected day.
*   **Data Ingestion (Local First):**
    *   **Automated Data Sources (via API):** Limitless, Bee.computer, Weather (OpenWeatherMap).
    *   **Manual Input:** Mood tracking via an API endpoint.
*   **Local-First Deployment:** Runs entirely on your machine using Docker.
*   **Configuration:** Via YAML and `.env` files.

For detailed product requirements, see the [PRD](Foundational/lifeboard_prd.md).

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   **Docker:** Required to run the application and its database. [Install Docker](https://docs.docker.com/get-docker/)
*   **Docker Compose:** Should be included with most Docker Desktop installations. Otherwise, [install Docker Compose](https://docs.docker.com/compose/install/).
*   **Node.js and npm:** Required for the backend and for running the frontend development server. We recommend using Node.js version 18.x or later. [Install Node.js](https://nodejs.org/)
*   **Git:** For cloning the repository.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository_url> # Replace <repository_url> with the actual URL
    cd lifeboard
    ```
    (If you've already cloned, ensure you are in the project's root directory.)

2.  **Configuration:**
    *   **Environment Variables:** Copy the template `.env.template` to a new file named `.env` in the project root:
        ```bash
        cp .env.template .env
        ```
        Open `.env` and fill in your details:
        *   `DB_USERNAME` and `DB_PASSWORD`: Choose a username and a secure password for your PostgreSQL database. These will be used by Docker Compose to set up the database.
        *   `LIMITLESS_API_KEY`, `BEE_API_KEY`, `WEATHER_API_KEY`: Obtain API keys from the respective services if you want to pull data from them. For initial testing without these, the application will run but those data sources will be skipped or show errors during sync.
        *   `MEM0_API_KEY`: (Optional for MVP) If you intend to explore AI features beyond the basic template/echo modes.
    *   **Application Configuration:** Review `config/lifeboard.config.yml` (it will be created from `config/lifeboard.config.yml.template` if not present, but it's better to copy and customize).
        *   The `database` section should generally work with Docker Compose defaults if `DATABASE_URL` is set in `.env` (as it is in the provided `docker-compose.yml`).
        *   Update `dataSources.weather.location` to your desired city for weather data.
        *   Adjust `syncInterval` for data sources as needed.

3.  **Build and Run with Docker Compose:**
    This is the recommended way to run the application for the MVP. From the project root:
    ```bash
    docker-compose up --build -d
    ```
    *   `--build`: Forces Docker Compose to rebuild the images (e.g., if you changed `Dockerfile` or backend/frontend dependencies in `package.json`).
    *   `-d`: Runs the containers in detached mode (in the background).
    *   This command will:
        *   Build the Docker image for the backend.
        *   Build the Docker image for the frontend (serving static files via Nginx).
        *   Start a PostgreSQL database container. The `init.sql` script will run on the first startup to create the necessary tables.
        *   Start the backend Node.js server container.
        *   Start the Nginx container to serve the frontend.

    *   To view logs:
        ```bash
        docker-compose logs -f lifeboard-backend
        docker-compose logs -f lifeboard-frontend
        docker-compose logs -f database
        ```
    *   To stop the application:
        ```bash
        docker-compose down
        ```
        To stop and remove volumes (like the database data, use with caution): `docker-compose down -v`

4.  **Accessing the Application:**
    *   **Frontend:** Open your web browser and navigate to `http://localhost:3001` (or the port you mapped for `lifeboard-frontend` in `docker-compose.yml`).
    *   **Backend API (for direct interaction/testing):** Accessible at `http://localhost:3000`. Health check: `http://localhost:3000/health`.

### Development Mode (Alternative for active frontend development)

If you want to actively develop the frontend with hot-reloading:

1.  **Start Backend & Database with Docker Compose:**
    Ensure the backend and database are running (from project root):
    ```bash
    docker-compose up --build -d lifeboard-backend database
    ```
    (This command specifically starts only the backend and database services).

2.  **Run Frontend Development Server:**
    *   Navigate to the frontend directory:
        ```bash
        cd src/frontend
        ```
    *   Install dependencies (if you haven't or they changed):
        ```bash
        npm install
        ```
    *   Start the React development server:
        ```bash
        npm start
        ```
    *   This will typically open the application at `http://localhost:3001` (check your terminal output). The `proxy` setting in `src/frontend/package.json` will forward API requests from the frontend dev server to `http://localhost:3000` (your backend).

### Using the Application (MVP)

*   **Calendar View:** The application opens to a monthly calendar. Days with data will have indicators.
*   **Daily View:** Click on a day to see the "Daily Newspaper" for that date, showing data from configured sources.
*   **Chat:** A floating chat widget is available for basic interaction (echo/basic keyword mode).
*   **Data Ingestion:**
    *   **Mood:** Add mood entries via API: `POST http://localhost:3000/api/data/mood` with JSON body:
        ```json
        {
          "date": "YYYY-MM-DD",
          "mood_score": 7,
          "mood_text": "Feeling good",
          "notes": "Productive day coding Lifeboard!"
        }
        ```
    *   **Automated Sources (Limitless, Bee, Weather):**
        *   These sync automatically based on `syncInterval` in `lifeboard.config.yml` (e.g., "1h", "30m"). Cron expressions are also supported.
        *   You can manually trigger a sync via API: `POST http://localhost:3000/api/data/sync/{source_name}` (e.g., `limitless`, `bee`, `weather`).
        *   Example: `curl -X POST http://localhost:3000/api/data/sync/weather`
        *   Ensure API keys are correctly set in `.env` for these sources to work.

## Technology Stack (MVP)

*   **Backend:** Node.js, Express.js
*   **Frontend:** React
*   **Database:** PostgreSQL
*   **Deployment:** Docker, Docker Compose
*   **AI (Basic):** Template-based summaries, simple chat responses. (Full AI integration with mem0/LangChain is planned for future).

## Contributing

This project is open source from the start. Contributions are welcome! Please refer to future `CONTRIBUTING.md` guidelines (to be created).

## License

This project is licensed under the [MIT License](LICENSE).