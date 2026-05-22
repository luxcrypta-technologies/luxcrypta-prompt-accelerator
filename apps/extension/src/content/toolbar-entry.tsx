export interface ToolbarHandlers {
  onAdvanced: () => Promise<void> | void;
}

function advancedButton(toolbar: HTMLElement): HTMLButtonElement {
  let button = toolbar.querySelector<HTMLButtonElement>(".lcpa-toolbar__button");
  if (button) return button;
  button = document.createElement("button");
  button.type = "button";
  button.className = "lcpa-toolbar__button";
  button.textContent = "Advanced";
  toolbar.append(button);
  return button;
}

function statusElement(toolbar: HTMLElement): HTMLElement {
  let status = toolbar.querySelector<HTMLElement>(".lcpa-toolbar__status");
  if (status) return status;
  status = document.createElement("span");
  status.className = "lcpa-toolbar__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  toolbar.append(status);
  return status;
}

export function bindToolbarHandlers(toolbar: HTMLElement, handlers: ToolbarHandlers): void {
  const button = advancedButton(toolbar);
  const status = statusElement(toolbar);
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    status.textContent = "Opening review...";
    button.disabled = true;
    Promise.resolve(handlers.onAdvanced())
      .then(() => {
        status.textContent = "Review opened.";
        button.textContent = "Advanced";
      })
      .catch((error: unknown) => {
        status.textContent = "Review did not open. Retry Open.";
        button.textContent = "Retry Open";
        console.warn("LuxCrypta Prompt Review open failed:", error);
      })
      .finally(() => {
        button.disabled = false;
      });
  };
  toolbar.dataset.listenerBound = "true";
}

export function createToolbarElement(handlers: ToolbarHandlers): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "lcpa-toolbar";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "LuxCrypta continuity runtime");

  const label = document.createElement("span");
  label.className = "lcpa-toolbar__label";
  label.textContent = "Powered by LuxCrypta";
  toolbar.append(label);

  advancedButton(toolbar);
  bindToolbarHandlers(toolbar, handlers);

  return toolbar;
}
