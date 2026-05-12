import { CheckCircle2 } from "lucide-react";
import type { SessionNoveltyItem } from "@/types/governance";
import { Button } from "@/ui/Button";

export function NoveltyCard({
  items,
  onPromote
}: {
  items: SessionNoveltyItem[];
  onPromote: (id: string) => void;
}) {
  const active = items.filter((item) => !item.accepted);
  return (
    <section className="review-section governance-card">
      <h2>New / Provisional</h2>
      {active.length ? (
        <ul className="novelty-list">
          {active.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.kind.replace(/_/g, " ")}</strong>
                <p>{item.text}</p>
              </div>
              <Button icon={<CheckCircle2 size={14} />} onClick={() => onPromote(item.id)}>
                Promote
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="governance-muted">No unresolved new or provisional items.</p>
      )}
    </section>
  );
}
