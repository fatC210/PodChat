import { redirect } from "next/navigation";

export default async function ChatRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/podcast/${id}/listen`);
}
