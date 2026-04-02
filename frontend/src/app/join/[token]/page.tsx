import type { Metadata } from "next";
import Link from "next/link";
import { JoinClient } from "./JoinClient";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return { title: `Join workspace · ${token.slice(0, 8)}…` };
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← PlanSync
        </Link>
      </div>
      <JoinClient token={token} />
    </div>
  );
}
