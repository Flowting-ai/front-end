import { redirect } from "next/navigation";
import { CHAT_ROUTE } from "@/lib/routes";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Native MCP connector OAuth callbacks land here with ?connector=&link=
  // (see back-end/services/connectors/router.py's oauth_callback). Forward
  // the query string instead of dropping it so the (app) layout's toast
  // handler can read it after this redirect.
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  redirect(`${CHAT_ROUTE}${suffix}`);
}