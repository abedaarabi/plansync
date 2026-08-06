import type { Metadata } from "next";
import { StoryPresentationClient } from "@/components/landing/StoryPresentationClient";

const title = "The delivery story · PlanSync";
const description =
  "A short story about complex builds, scattered delivery, and how PlanSync connects drawings, RFIs, punch, and handover into one path.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/story",
  },
  openGraph: {
    title,
    description,
    url: "/story",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function StoryPage() {
  return <StoryPresentationClient />;
}
