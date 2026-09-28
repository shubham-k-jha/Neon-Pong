# 🏓 Neon Pong

A polished, responsive arcade Pong game built from the original lightweight HTML/CSS/JavaScript project. The player is always at the **bottom**, the AI is always at the **top**, and the game works without a backend or external runtime dependencies.

## 🎮 Play Online

**[Play Neon Pong](https://shubham-k-jha.github.io/Neon-Pong/)**

## ✨ Features

- Bottom player paddle / top AI paddle
- Keyboard, mouse and touch controls
- Four AI difficulty levels: Easy, Medium, Hard, Expert
- Predictive AI with reaction delay and configurable accuracy
- Classic, Power-Up and Time Attack modes
- Target scores: 5, 7, 10 or 15
- Smooth canvas rendering with `requestAnimationFrame()`
- Paddle-angle physics and controlled progressive ball speed
- Rally / hit-combo tracking
- Ball trail, particles, glow and lightweight screen shake
- Optional Web Audio sound effects and arcade music toggle
- Optional Power-Ups: Speed, Shield, Slow Ball, Wide Paddle and Fireball
- Pause / resume / restart / main menu states
- Game-over statistics based only on calculated values
- Local high scores and preferences via `localStorage`
- Responsive desktop, tablet and mobile layout
- Touch-drag mobile paddle control
- Reduced-motion setting and visible keyboard focus states
- GitHub Pages compatible; no backend required

## 🎯 Controls

| Input | Action |
|---|---|
| `A` / `←` | Move player left |
| `D` / `→` | Move player right |
| `SPACE` | Pause / resume |
| Mouse | Move paddle horizontally |
| Touch | Drag horizontally in the arena |

## 🕹️ Game Modes

### Classic
Traditional Pong with no power-ups.

### Power-Up
Occasional temporary power-ups appear during rallies.

### Time Attack
Play for 60 seconds and maximize your score. Statistics are calculated from the match.

## 🤖 Difficulty

- **Easy** — slower reactions and larger prediction error
- **Medium** — balanced reaction and accuracy
- **Hard** — faster, more accurate prediction
- **Expert** — very fast and precise, while still using a reaction window and error margin

## ⚙️ Settings

- Sound effects ON/OFF
- Music ON/OFF
- Particles ON/OFF
- Screen shake ON/OFF
- Ball trail ON/OFF
- Reduced motion ON/OFF
- Reset local statistics

Preferences and records are stored locally in the browser using `localStorage`.

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- Canvas API
- Web Audio API
- Browser `localStorage`

No React, Vue, build step, backend, or external dependency is required.

## ▶️ How to Run Locally

1. Download or clone the repository.
2. Open `index.html` directly in a modern browser, or serve the folder with any static HTTP server.
3. Press **START GAME**.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## 🚀 GitHub Pages Deployment

1. Push the project to a GitHub repository.
2. Open **Settings → Pages**.
3. Select the `main` branch as the deployment source, or use the included GitHub Actions workflow.
4. Wait for the Pages deployment to complete.
5. Open the generated Pages URL.

The project uses relative asset paths, so it works when hosted from a repository subpath such as `/pong/`.

## 📁 Project Structure

```text
pong-main/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── game.js
├── .github/
│   └── workflows/
│       └── jekyll-gh-pages.yml
└── README.md
```

The original project was a single-file implementation. It has been kept lightweight while separating the stylesheet and game logic so the code is easier to maintain.

## 🔧 Future Improvements

- Optional online leaderboard with a backend
- More advanced AI profiles
- Additional cosmetic themes
- Local replay recording

## 📄 License

Use and modify the project according to the license of the repository it is forked from.
