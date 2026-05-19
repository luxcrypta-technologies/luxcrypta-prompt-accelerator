import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../src/desktop-api";

const api: DesktopApi = {
  getState: () => ipcRenderer.invoke("desktop:get-state"),
  createWorkspace: (title) => ipcRenderer.invoke("desktop:create-workspace", title),
  renameWorkspace: (title) => ipcRenderer.invoke("desktop:rename-workspace", title),
  switchWorkspace: (id) => ipcRenderer.invoke("desktop:switch-workspace", id),
  updateSession: (input) => ipcRenderer.invoke("desktop:update-session", input),
  promoteNovelty: (ids) => ipcRenderer.invoke("desktop:promote-novelty", ids),
  saveCapsuleFromCurrent: () => ipcRenderer.invoke("desktop:save-capsule-from-current"),
  saveCapsule: (capsule) => ipcRenderer.invoke("desktop:save-capsule", capsule),
  saveWorkflow: (input) => ipcRenderer.invoke("desktop:save-workflow", input),
  applyWorkflow: (id) => ipcRenderer.invoke("desktop:apply-workflow", id),
  generateHandoff: (input) => ipcRenderer.invoke("desktop:generate-handoff", input),
  exportWorkspace: () => ipcRenderer.invoke("desktop:export-workspace"),
  importWorkspace: () => ipcRenderer.invoke("desktop:import-workspace"),
  copyText: (text) => ipcRenderer.invoke("desktop:copy-text", text)
};

contextBridge.exposeInMainWorld("luxcryptaDesktop", api);
