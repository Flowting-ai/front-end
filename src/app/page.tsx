import { redirect } from "next/navigation";
import { CHAT_ROUTE } from "@/lib/routes";

export default function RootPage() {
  redirect(CHAT_ROUTE);
}