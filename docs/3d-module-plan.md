# 3D board: plan for the graphics module

The module, as the subject states it:

> **Major: Implement advanced 3D graphics using a library like Three.js or Babylon.js.**
> - Create an immersive 3D environment.
> - Implement advanced rendering techniques.
> - Ensure smooth performance and user interaction.

This document has two parts: an overview of where the prototype stands and what is missing, then a two-week plan to finish it.

---

## Part 1: Overview

### What exists

A prototype on the `mock/3d-board` branch, in `apps/web/src/match/GomokuBoard3D.tsx`.

- **Stack:** Three.js through react-three-fiber, with drei (helpers) and react-three/postprocessing (effects).
- **Plugs into the existing page:** the 3D board takes the same props as the 2D one (`state`, `onPlay`, `preview`). The socket, the match page, refusal messages and the game engine are untouched. A 2D / 3D toggle on the match page switches between them, and the choice is remembered per browser.
- **Loaded only when needed:** the 3D code is its own download (about 370 KB compressed), fetched only when someone picks 3D.
- **What it does today:**
  - wooden board on a dark table, orbiting camera, zoom
  - clicking an intersection plays a move, with a see-through preview stone on your turn
  - glossy stones (physically based materials), soft shadows, environment lighting for reflections
  - new stones drop in, a ring flashes on the last move
  - on a win, the line glows (bloom) and the other stones darken
  - ambient occlusion and a vignette
  - drop, flash and pulse are off when the system asks for reduced motion

### What is missing, by requirement

**Immersive environment**
- Real surfaces: wood grain, rounded board edges, engraved grid lines, a textured table.
- A scene around the board: stone bowls, a lamp, a dim room or backdrop instead of black.
- A camera that tells the story: each player sees the board from their side, a short fly-in when the match opens, a move toward the winning line at the end, a reset button.
- Sound: a wooden click when a stone lands.
- Players in the scene: names and whose turn it is next to each side of the board.

**Advanced rendering techniques**
- A custom shader for the win, for example an energy line connecting the winning stones. This is the clearest proof of "advanced" rather than "used the library's defaults".
- Reflections on a polished table.
- Tone mapping and colour management tuned so terracotta and sage match the 2D board.
- Subtle depth of field: the board sharp, the background soft.
- A graphics settings panel with a toggle per effect. It doubles as the evaluation demo: switch each technique off and on and explain it.

**Smooth performance and interaction**
- Instanced stones: two instanced meshes (one per colour) instead of up to 225 separate objects.
- Render on demand: today it redraws every frame even when nothing moves.
- Automatic quality: measure the frame rate and drop expensive effects on slow machines.
- A frame-rate overlay in development, and a 60 fps target on a modest laptop.
- Touch support (tap to place with a confirm step, pinch to zoom) and a keyboard way to play.
- Fallback to the 2D board when WebGL is missing or lost, and clean resizing.

**Parity with the 2D board**
- Every 2D behaviour checked in 3D: refusal messages, draw, finished matches, spectator view, rejoin after a missed move. The logic is shared, so this is mostly testing.

### Risks

- **Performance on evaluators' machines.** Post-processing is the expensive part. Automatic quality and the settings panel are the safety net.
- **Scope creep.** Visual polish has no natural end. The plan puts the measurable work (performance) first and keeps a clear definition of done.
- **Root-owned Vite cache.** After the containers have run, changing packages can make `make up` fail on `apps/web/node_modules/.vite`, which the web container writes as root. Delete it through Docker:
  `docker run --rm -v "$PWD/apps/web/node_modules:/nm" alpine rm -rf /nm/.vite`

### Definition of done

- **Immersive environment:** the board sits in a scene (table, bowls, light, backdrop), each player sees it from their side, the camera opens and closes the match, and stones make a sound.
- **Advanced rendering:** physically based materials, soft shadows, environment lighting, ambient occlusion, bloom, reflections, depth of field and one custom shader, each switchable in the settings panel.
- **Smooth performance:** 60 fps on a modest laptop at the default quality, automatic quality reduction below that, no rendering while idle.
- **Interaction:** mouse, touch and keyboard can all play. A drag never places a stone. The 2D board takes over when WebGL is unavailable.
- **Parity:** everything the 2D board shows, the 3D board shows.

---

## Part 2: Two-week plan

Ten working days for one person. Each day ends with something that works and can be merged or demoed.

### Week 1: foundation, performance, surfaces

**Day 1: from prototype to feature**
- Create a real feature branch from the prototype.
- Split `GomokuBoard3D.tsx` into `Board`, `Stones`, `Effects`, `Scene` and a settings module.
- Detect WebGL and fall back to the 2D board without it.
- Unit tests for the click-to-intersection maths.
- *Done when:* same behaviour as the prototype, in clean files, with tests passing.

**Day 2: performance core**
- Replace the individual stones with two instanced meshes.
- Switch to render on demand: redraw only on camera moves, new stones and running animations.
- Free GPU resources when the board unmounts.
- Add a frame-rate overlay in development and record a baseline on a modest laptop.
- *Done when:* the board uses no GPU while idle, and the baseline numbers are written down.

**Day 3: automatic quality and settings**
- Add automatic quality: lower the resolution and switch off ambient occlusion when the frame rate drops.
- Build the graphics settings panel: quality preset plus a toggle per effect, remembered per browser.
- *Done when:* forcing a slow machine (browser throttling) drops the quality by itself, and every effect can be toggled.

**Day 4: real surfaces**
- Wood-grain board with rounded edges, engraved grid lines, textured table.
- Use compressed textures to keep the download small.
- Tune tone mapping and colour management so the stones match the 2D colours.
- *Done when:* side by side with the 2D board, the stone colours match, and the board reads as wood.

**Day 5: the scene and the camera**
- Stone bowls, an overhead lamp, a dim backdrop.
- Each player sees the board from their side, and spectators get a neutral view.
- Add a reset-camera button.
- End-of-week check: frame rate on the modest laptop still at target.
- *Done when:* the board sits in a scene, and Ada and Linus each look at it from their own side.

### Week 2: advanced rendering, interaction, polish

**Day 6: custom win shader**
- Write a shader for the win, for example an energy line through the winning stones, driven by `winningLine` from the shared engine.
- Make it switchable in the settings panel.
- *Done when:* winning shows the custom effect, and turning it off falls back to the current glow.

**Day 7: reflections and depth of field**
- Polished table with reflections.
- Subtle depth of field.
- Both wired into the settings panel and automatic quality.
- *Done when:* both effects can be toggled, and automatic quality drops them on slow machines.

**Day 8: storytelling**
- Camera fly-in when a match opens, and a move toward the winning line at the end.
- Wooden click sound when a stone lands, with a mute toggle.
- Player names and whose turn it is shown next to each side of the board.
- *Done when:* a full game, from opening the page to the win, feels like one continuous scene.

**Day 9: interaction and parity**
- Touch: tap to place with a confirm step, pinch to zoom.
- Keyboard: move a cursor over the intersections and place with Enter.
- Handle resizing and a lost WebGL context.
- Go through the parity checklist: refusal messages, draw, finished match, spectator, rejoin after a missed move.
- *Done when:* every item on the checklist works in 3D, by mouse, touch and keyboard.

**Day 10: verification and hand-off**
- Test in the browsers the subject requires (at least the latest Chrome) and in Firefox.
- Final performance pass against the day 2 baseline. Check the download size.
- Write a short evaluation script: what to show, in what order, which toggles demonstrate which technique.
- Open the PR.
- *Done when:* the definition of done above is met, and the PR is up.

### If time runs short

Keep days 1–3, 4, 6 and 9: clean code, performance, automatic quality, the settings panel, real surfaces, the custom shader and parity. Those cover all three requirements. Days 5, 7 and 8 add polish and can shrink: a simpler scene, reflections without depth of field, no fly-in.
