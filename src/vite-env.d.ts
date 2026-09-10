/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PYTHON_API_URL?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
