import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
export function badRequest(message: string) {
  return json({ error: message }, 400);
}
