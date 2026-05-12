import { app, BrowserWindow, clipboard, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DesktopWorkspaceRepository } from "./workspace-store";

const __dirname = dirname(fileURLToPath(import.meta.url));

let repository: DesktopWorkspaceRepository;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: "LuxCrypta Continuity Console",
    backgroundColor: "#f7f8f5",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.LUXCRYPTA_DESKTOP_RENDERER_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
    return;
  }
  void win.loadFile(join(__dirname, "../renderer/index.html"));
}

function registerIpc(): void {
  ipcMain.handle("desktop:get-state", () => repository.getState());
  ipcMain.handle("desktop:create-workspace", (_event, title: string) => repository.createWorkspace(title));
  ipcMain.handle("desktop:switch-workspace", (_event, id: string) => repository.switchWorkspace(id));
  ipcMain.handle("desktop:update-session", (_event, input) => repository.updateSession(input));
  ipcMain.handle("desktop:promote-novelty", (_event, ids: string[]) => repository.promoteNovelty(ids));
  ipcMain.handle("desktop:save-capsule-from-current", () => repository.saveCapsuleFromCurrent());
  ipcMain.handle("desktop:save-capsule", (_event, capsule) => repository.saveCapsule(capsule));
  ipcMain.handle("desktop:save-workflow", (_event, input) => repository.saveWorkflow(input));
  ipcMain.handle("desktop:apply-workflow", (_event, id: string) => repository.applyWorkflow(id));
  ipcMain.handle("desktop:generate-handoff", (_event, input) => repository.generateHandoff(input));
  ipcMain.handle("desktop:copy-text", (_event, text: string) => {
    clipboard.writeText(text);
  });
}

app.whenReady().then(() => {
  repository = new DesktopWorkspaceRepository(join(app.getPath("userData"), "workspaces"));
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
