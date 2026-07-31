import { NextResponse } from "next/server";
import { ForbiddenError, ValidationError } from "@/app/lib/domain/errors";

/**
 * 105+ route.ts'te birebir tekrar eden catch bloğunun (ForbiddenError→403,
 * ValidationError→400, else→500 "Sunucu hatası") tek noktadan sürümü — biri
 * güncellenirken diğerlerinin unutulması riskini ortadan kaldırır.
 * `context` beklenmeyen hatalarda console.error'a etiket olarak geçilir
 * (ör. "flexos/attendance POST").
 */
export function apiError(e: unknown, context?: string): NextResponse {
  if (e instanceof ForbiddenError) {
    return NextResponse.json({ error: e.message, capability: e.capability }, { status: 403 });
  }
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  console.error(context ? `[${context}]` : "[api]", e);
  return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
}
