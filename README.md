# The Rabbits Den Slot Game

This project contains the frontend (Svelte/Vite) and backend (Python Flask) for "The Rabbits Den" slot game, designed to integrate with the Stake-Engine.

## Project Structure

- `web-sdk/apps/the-rabbits-den`: Frontend Svelte application.
- `math-sdk`: Python Flask application for game logic.
- `optimization_program`: Placeholder for Rust-based high-performance calculations (if needed).
- `stake-engine-integration`: Placeholder for Stake-Engine specific configurations or SDKs.

## Setup and Running

### 1. Backend Setup (math-sdk)

Navigate to the `math-sdk` directory and install the Python dependencies:

```bash
cd TheRabbitsDen/math-sdk
pip install -r requirements.txt
```

To run the backend server:

```bash
python app.py
```

The backend will run on `http://localhost:5000`.

### 2. Frontend Setup (web-sdk/apps/the-rabbits-den)

Navigate to the frontend application directory and install the Node.js dependencies:

```bash
cd TheRabbitsDen/web-sdk/apps/the-rabbits-den
npm install
```

To run the frontend development server:

```bash
npm run dev
```

The frontend will typically run on `http://localhost:5173` (or another available port).

### 3. Assets

Place your game assets (images, sounds, etc.) in the `TheRabbitsDen/web-sdk/apps/the-rabbits-den/src/assets` directory.

## Stake-Engine Integration

**Note:** The current implementation includes placeholder logic for the Stake-Engine integration. You will need to replace this with actual API calls and logic based on the Stake-Engine's documentation.

- **Frontend (`web-sdk/apps/the-rabbits-den/src/lib/SlotGame.svelte`):** Look for `TODO` comments related to `Stake-Engine` integration in the `spin` function.
- **Backend (`math-sdk/app.py`):** The `spin` function currently has placeholder logic. This is where you would integrate with the Stake-Engine's API for real betting, result generation, and verification.
