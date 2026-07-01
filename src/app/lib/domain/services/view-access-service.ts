import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { ViewPin } from "../core/view-pin";
import { ForbiddenError, ValidationError } from "../errors";
import type { ViewPinRepo } from "../repo/view-pin-repo";

const PIN_PATTERN = /^\d{4}$/;

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString("hex");
}

function now() {
  return new Date().toISOString();
}

/** Sidebar/kısayol için: owner mı (view.toggle var mı) + PIN kurulu mu. */
export async function getViewAccessStatus(
  actor: Actor,
  repo: ViewPinRepo,
): Promise<{ hasPin: boolean }> {
  if (!can(actor, "view.toggle")) throw new ForbiddenError("view.toggle");
  const existing = await repo.get(actor.uid);
  return { hasPin: !!existing };
}

/**
 * Core→Full geçiş PIN doğrulaması. PIN henüz kurulmamışsa `reason: "no_pin"`
 * ile false döner (client "önce Kullanıcılar'dan PIN oluşturun" gösterir).
 */
export async function verifyViewPin(
  actor: Actor,
  pin: string,
  repo: ViewPinRepo,
): Promise<{ ok: boolean; reason?: "no_pin" | "wrong" }> {
  if (!can(actor, "view.toggle")) throw new ForbiddenError("view.toggle");

  const existing = await repo.get(actor.uid);
  if (!existing) return { ok: false, reason: "no_pin" };

  const candidate = Buffer.from(hashPin(pin, existing.salt), "hex");
  const stored = Buffer.from(existing.hash, "hex");
  const match = candidate.length === stored.length && timingSafeEqual(candidate, stored);
  return match ? { ok: true } : { ok: false, reason: "wrong" };
}

/**
 * PIN kurar/değiştirir (kurulum ve değişiklik aynı akış). Eski PIN'i doğrulamaz:
 * bu ekrana ulaşmanın tek şartı zaten Firebase auth + `view.toggle` capability'si
 * (owner olmak) — PIN bir re-auth mekanizması değil, sadece kısayolla Core→Full
 * geçişte sorulan kozmetik bir onay adımı. Eski PIN şartı sadece owner'ı PIN'i
 * unuttuğunda kilitlerdi, güvenlik katmıyordu.
 */
export async function setViewPin(
  actor: Actor,
  input: { newPin: string },
  repo: ViewPinRepo,
): Promise<void> {
  if (!can(actor, "view.toggle")) throw new ForbiddenError("view.toggle");
  if (!PIN_PATTERN.test(input.newPin)) throw new ValidationError("Yeni PIN 4 haneli rakam olmalı.");

  const salt = randomBytes(16).toString("hex");
  const pinDoc: ViewPin = {
    uid: actor.uid,
    hash: hashPin(input.newPin, salt),
    salt,
    updatedAt: now(),
  };
  await repo.save(pinDoc);
}
