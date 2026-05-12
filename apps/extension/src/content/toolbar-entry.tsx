export interface ToolbarHandlers {
  onCompress: () => void;
  onFocus: () => void;
  onContinue: () => void;
  onSaveWorkflow: () => void;
}

export function createToolbarElement(handlers: ToolbarHandlers): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "lcpa-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Prompt Accelerator actions");

  const actions = [
    ["Compress", handlers.onCompress],
    ["Focus", handlers.onFocus],
    ["Continue", handlers.onContinue],
    ["Save", handlers.onSaveWorkflow]
  ] as const;

  for (const [label, handler] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lcpa-toolbar__button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    toolbar.append(button);
  }

  return toolbar;
}
