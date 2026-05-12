/// <reference types="vite/client" />

import type { DesktopApi } from "./desktop-api";

declare global {
  interface Window {
    luxcryptaDesktop: DesktopApi;
  }
}
