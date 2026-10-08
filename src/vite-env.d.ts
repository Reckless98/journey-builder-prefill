/** Typed `import.meta.env` variables; merges with the declaration in `vite/client`. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_TENANT_ID?: string;
  readonly VITE_BLUEPRINT_ID?: string;
  readonly VITE_BLUEPRINT_VERSION_ID?: string;
  readonly VITE_PREFILL_SOURCES?: string;
}
