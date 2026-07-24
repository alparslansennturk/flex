import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { DevNote, DevNotePriority } from "../core/dev-note";
import { ForbiddenError, ValidationError } from "../errors";
import type { DevNoteRepo } from "../repo/dev-note-repo";

function now(): string {
  return new Date().toISOString();
}

/** Tek kapı — `view.toggle` sadece owner'a verilir (auth-actor.ts VIEW_TOGGLE_OWNER_EMAIL),
 * bu ekranın tek yetki kontrolü. Yeni bir capability/RoleDef ELLE eklenmedi. */
function assertOwner(actor: Actor): void {
  if (!can(actor, "view.toggle")) throw new ForbiddenError("view.toggle");
}

export async function listDevNotes(actor: Actor, repo: DevNoteRepo): Promise<DevNote[]> {
  assertOwner(actor);
  return repo.list();
}

export async function createDevNote(
  actor: Actor,
  input: { title: string; description: string; module: string; priority: DevNotePriority },
  repo: DevNoteRepo,
): Promise<DevNote> {
  assertOwner(actor);
  if (!input.title.trim()) throw new ValidationError("Başlık zorunlu.");
  const ts = now();
  const note: DevNote = {
    id: repo.nextId(),
    title: input.title.trim(),
    description: input.description.trim(),
    module: input.module.trim(),
    priority: input.priority,
    status: "acik",
    createdAt: ts,
    updatedAt: ts,
  };
  await repo.create(note);
  return note;
}

export async function updateDevNote(
  actor: Actor,
  id: string,
  patch: Partial<Pick<DevNote, "title" | "description" | "module" | "priority" | "status">>,
  repo: DevNoteRepo,
): Promise<void> {
  assertOwner(actor);
  await repo.update(id, { ...patch, updatedAt: now() });
}

export async function deleteDevNote(actor: Actor, id: string, repo: DevNoteRepo): Promise<void> {
  assertOwner(actor);
  await repo.remove(id);
}
