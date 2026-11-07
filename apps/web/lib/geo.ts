import { headers, cookies } from "next/headers";

/** Visitor country (Vercel edge header, overridable by the y2-country cookie); India pays in INR, everyone else in USD. */
export async function visitorCountry(): Promise<string> {
  const c = (await cookies()).get("y2-country")?.value;
  if (c) return c.toUpperCase();
  const h = await headers();
  return (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "US").toUpperCase();
}
export const chargeCurrencyFor = (country: string): "INR" | "USD" => (country === "IN" ? "INR" : "USD");
