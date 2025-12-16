# Lauff Angular

An Angular single‑page application (SPA) aimed at creating a playful environment where kids can learn to code. The project favors clean code, small focused classes/components, composition over inheritance, and DRY principles.

## Overview
- Stack: TypeScript + Angular 18
- Build tooling: Angular CLI (@angular/cli), @angular-devkit/build-angular
- Package manager: npm (package-lock.json present)
- Entry points:
  - `src/main.ts` (bootstrap)
  - `src/index.html` (HTML shell)
  - Global styles: `src/styles.scss`
  - Assets served from `src/assets/**`
- Output: production build emitted to `dist/lauff-angular/`

Some domain models and stage rendering utilities live under `src/app/core/models` and `src/app/features/stage`, e.g. canvas drawing for stage items and HTML-backed game items.

## Requirements
- Node.js 18 LTS or 20+
- npm 9/10+
- A modern browser (Chrome, Edge, Firefox, Safari)

Optional:
- Angular CLI installed globally (`npm i -g @angular/cli`), though the local CLI in devDependencies is sufficient via npm scripts.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the dev server:
   ```bash
   npm start
   ```
   Then open http://localhost:4200/ in your browser. The app will reload on file changes.

3. Run tests:
   ```bash
   npm test
   ```

## Scripts
Defined in `package.json`:
- `npm start` → `ng serve`
- `npm run build` → `ng build`
- `npm run watch` → `ng build --watch --configuration development`
- `npm test` → `ng test` (Karma + Jasmine)

## Build
- Development build (default configuration):
  ```bash
  npm run build
  ```
- Production build:
  ```bash
  npx ng build --configuration production
  ```
  Artifacts are output to `dist/lauff-angular/`.

To serve a production build locally, use any static server, for example:
```bash
npx http-server dist/lauff-angular -p 8080
```

## Project Structure (high level)
```
.
├─ angular.json                 # Angular workspace & project config
├─ package.json                 # Scripts & deps
├─ package-lock.json
├─ tsconfig.json                # TS compiler options
├─ tsconfig.app.json            # App-specific TS config
├─ src/
│  ├─ index.html               # App shell
│  ├─ main.ts                  # Bootstrap entry point
│  ├─ styles.scss              # Global styles
│  ├─ assets/
│  │  └─ examples/
│  │     └─ map.example.json   # Example map
│  └─ app/
│     ├─ core/
│     │  └─ models/
│     │     ├─ canvas-geometry.ts
│     │     ├─ point.ts
│     │     ├─ pose.ts
│     │     └─ game-items/
│     │        ├─ stage-item.ts
│     │        └─ stage-items.ts
│     └─ features/
│        └─ stage/
│           └─ components/
│              └─ html-game-item/
│                 ├─ html-game-item.component.ts
│                 ├─ html-game-item.component.html
│                 └─ html-game-item.component.scss
└─ dist/                        # Build output (generated)
```

## Environment Variables & Configuration
- Angular environment files (e.g., `environment.ts`) are not present in the provided listing. If runtime configuration or API endpoints are needed, add them under `src/environments/` and wire them in `angular.json`.
- No required environment variables are currently documented.
- TODO: Document any API base URLs, feature flags, or auth configuration if/when introduced.

## Testing
- Unit tests: Jasmine + Karma via `npm test`.
- The Karma configuration is managed by the Angular CLI tooling. Chrome is used via `karma-chrome-launcher`.
- Add new specs alongside components/services (`*.spec.ts`).

## Development Notes
- Follow clean code practices: small, focused classes and methods; prefer composition over inheritance; avoid duplication (DRY).
- Canvas-based rendering exists in models such as `StageItem` (`src/app/core/models/game-items/stage-item.ts`). These leverage grid geometry utilities and design/pose models.

## Linting & Formatting
- TODO: No linter configuration found (e.g., ESLint config). If linting is desired, add ESLint and document related scripts.

## Internationalization (i18n)
- TODO: Not configured. If required, set up Angular i18n and document usage.

## Accessibility
- TODO: Document accessibility guidelines and checks applied to components.

## CI/CD
- TODO: No CI config found. Add workflow files (e.g., GitHub Actions) and document build/test/deploy steps if applicable.

## License
No license file found in the repository root.
- TODO: Add a `LICENSE` file and update this section to clarify licensing.

## Acknowledgements
- AI was used to a certain degree
