import CreateVideoForm from "@/components/CreateVideoForm";
import { getUser } from "@/lib/auth";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function CreatePage() {
  const user = await getUser(); const { plans } = await catalog();
  const plan = plans.find((p) => p.id === user?.plan) ?? plans[0];
  return <CreateVideoForm promptLimit={user?.role === "ADMIN" ? 100000 : plan?.promptChars ?? 2000} planName={plan?.name ?? "Free"} />;
}
