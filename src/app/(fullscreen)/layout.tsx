export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pas de sidebar — layout plein écran pour les pages de détail
  return <>{children}</>;
}
