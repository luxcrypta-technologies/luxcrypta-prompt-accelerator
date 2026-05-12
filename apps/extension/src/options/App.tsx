import { getPlatformAPI } from "@platform-runtime";
import { Download, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SUPPORTED_SURFACES } from "@/app/constants";
import type { BackgroundMessage, ExportBundle, ImportBundleResult } from "@/types/messages";
import type { UserPreferences } from "@/types/preferences";
import { Button } from "@/ui/Button";

const platform = getPlatformAPI();

export function App() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [status, setStatus] = useState("Loading...");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    platform.messaging
      .sendMessage<BackgroundMessage, UserPreferences>({ type: "preferences:get" })
      .then((value) => {
        setPreferences(value);
        setStatus("Ready.");
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Unable to load options."));
  }, []);

  async function update(patch: Partial<UserPreferences>) {
    const updated = await platform.messaging.sendMessage<BackgroundMessage, UserPreferences>({
      type: "preferences:update",
      payload: patch
    });
    setPreferences(updated);
    setStatus("Saved.");
  }

  async function exportBundle() {
    try {
      const bundle = await platform.messaging.sendMessage<BackgroundMessage, ExportBundle>({
        type: "export:create"
      });
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `luxcrypta-prompt-accelerator-export-${bundle.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(
        `Exported ${bundle.workflows.length} workflows, ${bundle.capsules.length} capsules, and ${
          bundle.sessions?.length ?? 0
        } session states.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function importBundle(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await platform.messaging.sendMessage<BackgroundMessage, ImportBundleResult>({
        type: "import:apply",
        payload: { bundle: parsed }
      });
      const updatedPreferences = await platform.messaging.sendMessage<BackgroundMessage, UserPreferences>({
        type: "preferences:get"
      });
      setPreferences(updatedPreferences);
      setStatus(
        `Imported ${result.workflowsImported} workflows, ${result.capsulesImported} capsules, and ${
          result.sessionsImported ?? 0
        } session states${
          result.preferencesImported ? " with preferences." : "."
        }`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  if (!preferences) {
    return (
      <main className="options-shell">
        <h1>Prompt Accelerator Options</h1>
        <p>{status}</p>
      </main>
    );
  }

  return (
    <main className="options-shell">
      <header>
        <p className="eyebrow">Local settings</p>
        <h1>Prompt Accelerator Options</h1>
      </header>

      <section className="options-section">
        <label>
          <input
            type="checkbox"
            checked={preferences.diffViewEnabled}
            onChange={(event) => void update({ diffViewEnabled: event.currentTarget.checked })}
          />
          Show diff review
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.contextualToolbarEnabled}
            onChange={(event) => void update({ contextualToolbarEnabled: event.currentTarget.checked })}
          />
          Show toolbar on supported chat pages
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.saveHistoryEnabled}
            onChange={(event) => void update({ saveHistoryEnabled: event.currentTarget.checked })}
          />
          Save local action history
        </label>
      </section>

      <section className="options-section">
        <h2>Local-only behavior</h2>
        <p>Core transformations, workflows, capsules, preferences, and history stay in local extension storage.</p>
      </section>

      <section className="options-section">
        <h2>Session governance</h2>
        <p>Keep compact local session state for continuity, new items, and unresolved questions.</p>
        <label>
          <input
            type="checkbox"
            checked={preferences.sessionGovernanceEnabled}
            onChange={(event) => void update({ sessionGovernanceEnabled: event.currentTarget.checked })}
          />
          Enable session governance
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.showAdvancedDiagnostics}
            onChange={(event) => void update({ showAdvancedDiagnostics: event.currentTarget.checked })}
          />
          Show advanced diagnostics
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.preserveOpenQuestions}
            onChange={(event) => void update({ preserveOpenQuestions: event.currentTarget.checked })}
          />
          Preserve open questions
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.conservativeStableCoreUpdates}
            onChange={(event) => void update({ conservativeStableCoreUpdates: event.currentTarget.checked })}
          />
          Use conservative stable-core updates
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.saveSessionStateLocally}
            onChange={(event) => void update({ saveSessionStateLocally: event.currentTarget.checked })}
          />
          Save session state locally
        </label>
      </section>

      <section className="options-section">
        <h2>Supported surfaces</h2>
        <ul>
          {SUPPORTED_SURFACES.map((surface) => (
            <li key={surface.id}>
              {surface.label}: {surface.hosts.join(", ")}
            </li>
          ))}
        </ul>
      </section>

      <section className="options-section">
        <h2>Manual portability</h2>
        <p>Export and import workflows, capsules, and preferences as a local JSON file.</p>
        <div className="options-actions">
          <Button icon={<Download size={15} />} variant="secondary" onClick={() => void exportBundle()}>
            Export Bundle
          </Button>
          <Button icon={<Upload size={15} />} variant="secondary" onClick={() => importInputRef.current?.click()}>
            Import Bundle
          </Button>
          <input
            ref={importInputRef}
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void importBundle(file);
            }}
          />
        </div>
      </section>

      <Button icon={<Save size={15} />} variant="primary" onClick={() => void update(preferences)}>
        Save
      </Button>
      <p className="status-line">{status}</p>
    </main>
  );
}
