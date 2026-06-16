/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_SESSION_TIMEOUT_MINUTES?: string;
  readonly VITE_SESSION_WARNING_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
