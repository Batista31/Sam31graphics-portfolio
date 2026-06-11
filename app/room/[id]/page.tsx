import { getPortfolioRegistry } from "@/lib/media-registry";
import { IsometricShell } from "@/components/isometric-shell";

type Props = { params: Promise<{ id: string }> };

export default async function RoomPage({ params }: Props) {
  const { id } = await params;
  const registry = getPortfolioRegistry();
  return <IsometricShell roomId={id} registry={registry} />;
}

export function generateStaticParams() {
  return [
    { id: "video" },
    { id: "photo" },
    { id: "blender" },
    { id: "thumbnails" },
    { id: "secret" },
  ];
}
