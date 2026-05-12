import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-modal__panel">
        <div className="ui-modal__header">
          <h2>{title}</h2>
          <Button icon={<X size={15} />} variant="quiet" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
