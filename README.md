# Iron Front

HTML5 canvas run-and-gun prototype with mobile controls, five missions plus the final boss, generated backgrounds, sprite animations, weapons, power-ups, drones, cyborg guards, boss phases, audio, death sequence, and victory screen.

## Run

Serve this folder over HTTP, for example:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `index.html` in the browser. Audio starts after user interaction.

## Structure

- `index.html` — game shell and UI markup
- `css/style.css` — all styling and responsive rules
- `js/game.js` — game loop, missions, input, combat, audio, and transitions
- `assets/` — final, referenced artwork and audio
- `victory.html` — final boss victory screen

## Controls

Desktop: A/D or arrows, W/up to jump, Space to fire, R to restart.
Mobile: on-screen controls appear only on detected mobile/touch devices and are hidden on the title screen.
