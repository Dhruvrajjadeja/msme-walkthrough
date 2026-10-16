# MSME Walkthrough

Exhibition walkthrough built with Three.js and Vite. Includes the pavilion model, six illuminated craft panels and detailed workshop windows, interactive craft screens, a double-sided atlas, an animated LED tree, and a circular India craft diorama.

Live walkthrough: https://dhruvrajjadeja.github.io/msme-walkthrough/

## Run Locally

Install Node.js 22 LTS or newer, then run from this directory:

```sh
npm ci
npm run dev -- --port 3000 --strictPort
```

Open http://localhost:3000/?view=entry. If port 3000 is occupied, stop the other server or choose another port.

## Production Build

```sh
npm run build
npm run preview -- --port 3000 --strictPort
```

The `dist` directory can be deployed to a static host. For a subdirectory deployment, pass its base path to Vite: `npm run build -- --base=/msme-walkthrough/`. The GitHub Actions workflow builds and publishes this automatically on pushes to `main`.

## Controls

- Orbit: drag and zoom to inspect the pavilion.
- Walk: WASD or arrow keys; mouse or touch drag to look around.
- Plan: sectional plan view and height control.
- Craft screens and both map screens open the interactive craft atlas.
- Entrance portrait screens cycle through introductory MSME information.

## Project Files

- `src/main.js`: viewer, navigation and collision handling.
- `src/pavilion-refinement.js`: curved panels, six forward-mounted craft screens, LED tree and map installation.
- `src/detailed-crafts.js`: workshop exhibit geometry and materials.
- `src/circular-diorama.js`: wooden India craft exhibit.
- `src/entrance.js`: entrance construction and information screens.
- `public/`: runtime models, artwork, textures and media.

The Blender working files, user reference PDFs, local screenshots, logs, credentials and dependency folders are deliberately excluded. The included GLB is sufficient to run the viewer without Blender. Runtime geometry refinements are implemented in JavaScript.

## Assets And Scope

Material attribution is retained in `public/materials/ATTRIBUTION.md`. Generated mural prompts are retained under `public/artwork`. Project-supplied models and illustrations are included for the walkthrough; no general redistribution license is asserted.

This is a real-time architectural visualization, not a general-purpose physics simulation. Walking uses Three.js capsule/Octree collision. The craft screens contain animated process indicators and interactive information, not documentary video footage.

## Current Revision

Only the six touchscreens mounted in the curved craft panels were moved forward by 180 mm. Their artwork, size, angle and interactions are unchanged. All other pavilion layout and appearance remains unchanged from the approved scene.
