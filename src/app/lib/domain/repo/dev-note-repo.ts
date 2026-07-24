import type { DevNote } from "../core/dev-note";

export interface DevNoteRepo {
  list(): Promise<DevNote[]>;
  create(note: DevNote): Promise<void>;
  update(id: string, patch: Partial<DevNote>): Promise<void>;
  remove(id: string): Promise<void>;
  nextId(): string;
}
