import type { ModeName } from "./modes";

export interface CarryForwardCapsule {
  capsule_version: 1;
  id: string;
  title: string;
  objective: string;
  constraints: string[];
  decisions: string[];
  open_questions: string[];
  preferred_mode?: ModeName;
  notes?: string;
  sourceSurface?: string;
  created_at: string;
  updated_at?: string;
}
