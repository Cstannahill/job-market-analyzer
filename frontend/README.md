# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

## Testing helpers

This project includes a small test-time ResizeObserver mock and helpers so chart components that use Recharts' ResponsiveContainer work in the jsdom test environment.

Files:

- `src/setupTests.ts` — installs the `MockResizeObserver` in the test environment.
- `src/test-utils/resize.ts` — exportable helpers for tests:
  - `setTestResize(width, height)` — sets the mocked size and notifies observers immediately.
  - `enqueueTestResize(width, height)` — schedules a size to be used on the next notify.
  - `notifyTestResize()` — triggers a notification using the next queued size or the current size.

Usage examples (in a test):

```ts
import { render, screen } from "@testing-library/react";
import {
  setTestResize,
  enqueueTestResize,
  notifyTestResize,
} from "@/test-utils/resize";
import { MyChart } from "@/components/charts/MyChart";

// Make ResponsiveContainer render at a specific size before render
setTestResize(400, 200);
render(<MyChart />);

// Simulate later resizes
enqueueTestResize(600, 300);
notifyTestResize();
// assert DOM changes after resize...
```

You can also access the mock directly (typed) via the global `ResizeObserver` in tests:

```ts
(globalThis.ResizeObserver as any)
  .__setSize({ width: 320, height: 200 })(globalThis.ResizeObserver as any)
  .__notifyAll();
```

## Backend API / environment

This frontend expects the deployed API Gateway base URL to be provided via the
`VITE_API_URL` environment variable. All trends endpoints are under the `/trends`
resource, so the code constructs requests like:

- `${VITE_API_URL}/trends/technology?limit=20`
- `${VITE_API_URL}/trends/region?region=us&limit=10`
- `${VITE_API_URL}/trends/skill/{skillName}`

Example `.env` for local development (place in `frontend/.env`):

```
VITE_API_URL=https://xee5kjisf5.execute-api.us-east-1.amazonaws.com/prod
```

The code in `src/services/trends.ts` will combine `VITE_API_URL` with the
appropriate `/trends` route. The frontend does not add an extra `/api` prefix —
the deployed API gateway base must include the stage (`/prod`) as shown above.
