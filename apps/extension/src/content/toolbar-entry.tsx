export interface ToolbarHandlers {
  onAdvanced: () => void;
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

  const button = document.createElement("button");
  button.type = "button";
  button.className = "lcpa-toolbar__button";
  button.textContent = "Advanced";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onAdvanced();
  });
  toolbar.append(button);

  return toolbar;
}
