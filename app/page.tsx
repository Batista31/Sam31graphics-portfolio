import { getPortfolioRegistry } from "@/lib/media-registry";
import { ExperienceShell } from "@/components/experience-shell";

export default function Home() {
  const registry = getPortfolioRegistry();
  return <ExperienceShell registry={registry} />;
}
