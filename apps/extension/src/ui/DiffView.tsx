import type { DiffBlock } from "@/types/diff";

export function DiffView({ blocks }: { blocks: DiffBlock[] }) {
  return (
    <div className="diff-view">
      {blocks.map((block) => (
        <div key={block.id} className={`diff-view__block diff-view__block--${block.operation}`}>
          <div className="diff-view__label">{block.operation}</div>
          {block.originalText ? <pre className="diff-view__text diff-view__text--old">{block.originalText}</pre> : null}
          {block.transformedText ? (
            <pre className="diff-view__text diff-view__text--new">{block.transformedText}</pre>
          ) : null}
          {block.reason ? <div className="diff-view__reason">{block.reason}</div> : null}
        </div>
      ))}
    </div>
  );
}
