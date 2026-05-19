import {
  Archive,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  FilePlus2,
  FolderPlus,
  GitBranch,
  ListChecks,
  Play,
  RefreshCw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Upload
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";
import type { ProviderTarget } from "@luxcrypta/continuity-routing";
import type { DesktopState, DesktopWorkflowInput } from "./desktop-api";

const MODE_OPTIONS: ModeName[] = ["focus", "precision", "research", "code", "creative", "speed"];

function Button(props: {
  children?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "quiet" | "danger";
  title?: string;
}) {
  return (
    <button className={`button button--${props.variant ?? "quiet"}`} onClick={props.onClick} disabled={props.disabled} title={props.title}>
      {props.icon}
      {props.children ? <span>{props.children}</span> : null}
    </button>
  );
}

function ScorePill({ state }: { state: SessionGovernanceState | null }) {
  if (!state) return <span className="score-pill score-pill--empty">No session</span>;
  return <span className={`score-pill score-pill--${state.monitors.sessionHealth}`}>{state.monitors.sessionHealth}</span>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="empty-line">{text}</p>;
}

function ListBlock({ items }: { items: string[] }) {
  if (!items.length) return <EmptyLine text="None yet." />;
  return (
    <ul className="state-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function WorkspaceRail(props: {
  state: DesktopState;
  workspaceTitle: string;
  setWorkspaceTitle: (value: string) => void;
  createWorkspace: () => void;
  renameWorkspace: () => void;
  switchWorkspace: (id: string) => void;
  selectedWorkflowId?: string;
  setSelectedWorkflowId: (id: string | undefined) => void;
  selectedCapsuleId?: string;
  setSelectedCapsuleId: (id: string | undefined) => void;
}) {
  return (
    <aside className="rail">
      <div className="brand">
        <div className="brand-mark">LX</div>
        <div>
          <h1>LuxCrypta</h1>
          <p>Continuity Console</p>
        </div>
      </div>

      <section className="rail-section">
        <div className="rail-heading">
          <span>Workspaces</span>
          <div className="inline-actions">
            <Button icon={<Save size={15} />} onClick={props.renameWorkspace} title="Rename active workspace" />
            <Button icon={<FolderPlus size={15} />} onClick={props.createWorkspace} title="Create workspace" />
          </div>
        </div>
        <input className="compact-input" value={props.workspaceTitle} onChange={(event) => props.setWorkspaceTitle(event.target.value)} />
        <div className="rail-list">
          {props.state.workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className={workspace.id === props.state.activeWorkspace.id ? "rail-item rail-item--active" : "rail-item"}
              onClick={() => props.switchWorkspace(workspace.id)}
            >
              <span>{workspace.title}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>

      <section className="rail-section">
        <div className="rail-heading">
          <span>Workflows</span>
          <ListChecks size={15} />
        </div>
        <div className="rail-list">
          {props.state.workflows.map((workflow) => (
            <button
              key={workflow.id}
              className={workflow.id === props.selectedWorkflowId ? "rail-item rail-item--active" : "rail-item"}
              onClick={() => props.setSelectedWorkflowId(workflow.id)}
            >
              <span>{workflow.title}</span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!props.state.workflows.length ? <EmptyLine text="No workflows saved." /> : null}
        </div>
      </section>

      <section className="rail-section">
        <div className="rail-heading">
          <span>Capsules</span>
          <Archive size={15} />
        </div>
        <div className="rail-list">
          {props.state.capsules.map((capsule) => (
            <button
              key={capsule.id}
              className={capsule.id === props.selectedCapsuleId ? "rail-item rail-item--active" : "rail-item"}
              onClick={() => props.setSelectedCapsuleId(capsule.id)}
            >
              <span>{capsule.title}</span>
              <ChevronRight size={14} />
            </button>
          ))}
          {!props.state.capsules.length ? <EmptyLine text="No capsules saved." /> : null}
        </div>
      </section>
    </aside>
  );
}

function SessionPanel({ session, promoteNovelty }: { session: SessionGovernanceState | null; promoteNovelty: (id: string) => void }) {
  if (!session) {
    return (
      <section className="continuity-panel continuity-panel--empty">
        <ShieldCheck size={28} />
        <h2>No active continuity state</h2>
        <p>Paste a working prompt or session note to create the first stable core.</p>
      </section>
    );
  }

  const novelty = session.noveltyLane.filter((item) => !item.accepted);
  return (
    <section className="continuity-panel">
      <header className="section-header">
        <div>
          <p>{session.title ?? "Active session"}</p>
          <h2>{session.stableCore.objective}</h2>
        </div>
        <ScorePill state={session} />
      </header>

      <div className="state-grid">
        <article>
          <h3>Hard Constraints</h3>
          <ListBlock items={session.stableCore.hardConstraints} />
        </article>
        <article>
          <h3>Accepted Decisions</h3>
          <ListBlock items={session.stableCore.acceptedDecisions} />
        </article>
        <article>
          <h3>Unresolved</h3>
          <ListBlock items={session.opennessLane.openQuestions} />
        </article>
        <article>
          <h3>Diagnostics</h3>
          <ListBlock items={session.diagnostics.actionsSuggested} />
        </article>
      </div>

      <div className="review-strip">
        <h3>Provisional Changes</h3>
        {novelty.length ? (
          <div className="novelty-list">
            {novelty.map((item) => (
              <div className="novelty-item" key={item.id}>
                <div>
                  <span>{item.kind.replace(/_/g, " ")}</span>
                  <p>{item.text}</p>
                </div>
                <Button icon={<Check size={14} />} onClick={() => promoteNovelty(item.id)} title="Promote" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine text="No provisional items waiting." />
        )}
      </div>
    </section>
  );
}

function HandoffPanel(props: {
  state: DesktopState;
  target: ProviderTarget;
  setTarget: (target: ProviderTarget) => void;
  notes: string;
  setNotes: (value: string) => void;
  selectedCapsule?: CarryForwardCapsule;
  selectedWorkflow?: Workflow;
  generateHandoff: () => void;
  copyHandoff: () => void;
  saveCapsule: () => void;
  saveWorkflow: () => void;
  applyWorkflow: () => void;
  exportWorkspace: () => void;
  importWorkspace: () => void;
}) {
  return (
    <aside className="handoff-panel">
      <section className="target-block">
        <div className="section-header section-header--compact">
          <div>
            <p>Provider Target</p>
            <h2>{props.target}</h2>
          </div>
          <Route size={19} />
        </div>
        <div className="target-grid">
          {props.state.providerTargets.map((target) => (
            <button key={target} className={target === props.target ? "target target--active" : "target"} onClick={() => props.setTarget(target)}>
              {target}
            </button>
          ))}
        </div>
      </section>

      <section className="target-block">
        <h3>Selected Capsule</h3>
        <p className="selection-line">{props.selectedCapsule?.title ?? "Newest capsule"}</p>
        <h3>Selected Workflow</h3>
        <p className="selection-line">{props.selectedWorkflow?.title ?? "None selected"}</p>
        <textarea className="notes-input" value={props.notes} onChange={(event) => props.setNotes(event.target.value)} placeholder="Optional handoff note" />
      </section>

      <section className="handoff-preview">
        <div className="section-header section-header--compact">
          <h2>Handoff</h2>
          <Button icon={<RefreshCw size={14} />} onClick={props.generateHandoff} title="Regenerate handoff" />
        </div>
        <pre>{props.state.handoff?.text ?? ""}</pre>
      </section>

      <div className="command-grid">
        <Button variant="primary" icon={<Clipboard size={15} />} onClick={props.copyHandoff}>
          Copy
        </Button>
        <Button icon={<FilePlus2 size={15} />} onClick={props.saveCapsule}>
          Capsule
        </Button>
        <Button icon={<Save size={15} />} onClick={props.saveWorkflow}>
          Workflow
        </Button>
        <Button icon={<Play size={15} />} onClick={props.applyWorkflow} disabled={!props.selectedWorkflow}>
          Apply
        </Button>
        <Button icon={<Download size={15} />} onClick={props.exportWorkspace}>
          Export
        </Button>
        <Button icon={<Upload size={15} />} onClick={props.importWorkspace}>
          Import
        </Button>
      </div>
    </aside>
  );
}

export function App() {
  const [state, setState] = useState<DesktopState | null>(null);
  const [status, setStatus] = useState("Loading");
  const [draft, setDraft] = useState("Objective: Continue this AI workflow without rebuilding context.\n\nHard requirements:\n- Preserve accepted decisions.\n- Keep unresolved questions visible.\n- Package the next handoff for the selected provider.");
  const [workspaceTitle, setWorkspaceTitle] = useState("New Workspace");
  const [target, setTarget] = useState<ProviderTarget>("chatgpt");
  const [mode, setMode] = useState<ModeName>("focus");
  const [notes, setNotes] = useState("");
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | undefined>();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>();

  const loadState = useCallback(async () => {
    const next = await window.luxcryptaDesktop.getState();
    setState(next);
    setWorkspaceTitle(next.activeWorkspace.title);
    setTarget((next.currentSession?.stableCore.preferredTargetModel as ProviderTarget | undefined) ?? "chatgpt");
    setStatus("Ready");
  }, []);

  useEffect(() => {
    void loadState().catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Unable to load workspace."));
  }, [loadState]);

  const selectedCapsule = useMemo(
    () => state?.capsules.find((capsule) => capsule.id === selectedCapsuleId),
    [selectedCapsuleId, state?.capsules]
  );
  const selectedWorkflow = useMemo(
    () => state?.workflows.find((workflow) => workflow.id === selectedWorkflowId),
    [selectedWorkflowId, state?.workflows]
  );

  const updateSession = useCallback(async () => {
    if (!draft.trim()) {
      setStatus("Add continuity input first.");
      return;
    }
    setStatus("Updating continuity");
    const result = await window.luxcryptaDesktop.updateSession({ sourceText: draft, mode, target });
    setState(result.state);
    setStatus("Continuity updated");
  }, [draft, mode, target]);

  const createWorkspace = useCallback(async () => {
    const next = await window.luxcryptaDesktop.createWorkspace(workspaceTitle);
    setState(next);
    setWorkspaceTitle(next.activeWorkspace.title);
    setStatus("Workspace created");
  }, [workspaceTitle]);

  const renameWorkspace = useCallback(async () => {
    const next = await window.luxcryptaDesktop.renameWorkspace(workspaceTitle);
    setState(next);
    setWorkspaceTitle(next.activeWorkspace.title);
    setStatus("Workspace renamed");
  }, [workspaceTitle]);

  const switchWorkspace = useCallback(async (id: string) => {
    const next = await window.luxcryptaDesktop.switchWorkspace(id);
    setState(next);
    setWorkspaceTitle(next.activeWorkspace.title);
    setSelectedCapsuleId(undefined);
    setSelectedWorkflowId(undefined);
    setStatus("Workspace loaded");
  }, []);

  const promoteNovelty = useCallback(async (id: string) => {
    const next = await window.luxcryptaDesktop.promoteNovelty([id]);
    setState(next);
    setStatus("Promoted");
  }, []);

  const saveCapsule = useCallback(async () => {
    const next = await window.luxcryptaDesktop.saveCapsuleFromCurrent();
    setState(next);
    setStatus("Capsule saved");
  }, []);

  const saveWorkflow = useCallback(async () => {
    const workflow: DesktopWorkflowInput = {
      title: draft.split("\n")[0].replace(/^Objective:\s*/i, "").slice(0, 64) || "Saved workflow",
      objective: draft,
      mode,
      constraints: state?.currentSession?.stableCore.hardConstraints ?? [],
      outputPreferences: state?.currentSession?.stableCore.outputContract ? [state.currentSession.stableCore.outputContract] : [],
      carryForwardContext: state?.currentSession?.stableCore.objective,
      targetModel: target
    };
    const next = await window.luxcryptaDesktop.saveWorkflow(workflow);
    setState(next);
    setStatus("Workflow saved");
  }, [draft, mode, state?.currentSession, target]);

  const applyWorkflow = useCallback(async () => {
    if (!selectedWorkflowId) return;
    const result = await window.luxcryptaDesktop.applyWorkflow(selectedWorkflowId);
    setState(result.state);
    setDraft(result.transform.transformedText);
    setStatus("Workflow applied");
  }, [selectedWorkflowId]);

  const generateHandoff = useCallback(async () => {
    const handoff = await window.luxcryptaDesktop.generateHandoff({
      target,
      capsuleId: selectedCapsuleId,
      workflowId: selectedWorkflowId,
      notes
    });
    setState((current) => (current ? { ...current, handoff } : current));
    setStatus("Handoff generated");
  }, [notes, selectedCapsuleId, selectedWorkflowId, target]);

  const copyHandoff = useCallback(async () => {
    const text = state?.handoff?.text ?? "";
    if (!text) return;
    await window.luxcryptaDesktop.copyText(text);
    setStatus("Copied");
  }, [state?.handoff?.text]);

  const exportWorkspace = useCallback(async () => {
    try {
      const result = await window.luxcryptaDesktop.exportWorkspace();
      setState(result.state);
      setStatus(result.path ? "Workspace exported" : "Export canceled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to export workspace.");
    }
  }, []);

  const importWorkspace = useCallback(async () => {
    try {
      const result = await window.luxcryptaDesktop.importWorkspace();
      setState(result.state);
      setStatus(result.path ? "Workspace imported" : "Import canceled");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to import workspace.");
    }
  }, []);

  if (!state) {
    return (
      <main className="loading-shell">
        <Sparkles size={28} />
        <p>{status}</p>
      </main>
    );
  }

  return (
    <main className="desktop-shell">
      <WorkspaceRail
        state={state}
        workspaceTitle={workspaceTitle}
        setWorkspaceTitle={setWorkspaceTitle}
        createWorkspace={createWorkspace}
        renameWorkspace={renameWorkspace}
        switchWorkspace={switchWorkspace}
        selectedWorkflowId={selectedWorkflowId}
        setSelectedWorkflowId={setSelectedWorkflowId}
        selectedCapsuleId={selectedCapsuleId}
        setSelectedCapsuleId={setSelectedCapsuleId}
      />

      <section className="workspace-main">
        <header className="topbar">
          <div>
            <p>{state.activeWorkspace.title}</p>
            <h2>AI workflow continuity</h2>
          </div>
          <div className="topbar-actions">
            <select value={mode} onChange={(event) => setMode(event.target.value as ModeName)}>
              {MODE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Button variant="primary" icon={<GitBranch size={15} />} onClick={updateSession}>
              Update
            </Button>
          </div>
        </header>

        <section className="input-panel">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
        </section>

        <SessionPanel session={state.currentSession} promoteNovelty={promoteNovelty} />
        <p className="status-line">{status}</p>
      </section>

      <HandoffPanel
        state={state}
        target={target}
        setTarget={setTarget}
        notes={notes}
        setNotes={setNotes}
        selectedCapsule={selectedCapsule}
        selectedWorkflow={selectedWorkflow}
        generateHandoff={generateHandoff}
        copyHandoff={copyHandoff}
        saveCapsule={saveCapsule}
        saveWorkflow={saveWorkflow}
        applyWorkflow={applyWorkflow}
        exportWorkspace={exportWorkspace}
        importWorkspace={importWorkspace}
      />
    </main>
  );
}
