import { redirect } from "next/navigation";

/** Team lives under Organization → People. */
export default function TeamRedirectPage() {
  redirect("/organization?tab=people");
}
