import BatchStatus from "@/components/BatchStatus";
export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BatchStatus id={id} />; }
