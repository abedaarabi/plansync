import { redirect } from "next/navigation";

/** Legacy route — file browser and viewer entry live under `/projects`. */
export default function SheetsRedirectPage() {
  redirect("/projects");
}
