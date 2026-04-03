import { QueryProvider } from "@/providers/QueryProvider";

export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
