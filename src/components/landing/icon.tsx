import { Guitar, Drum, FileCode, FileText, Layers, Mic, Music, Piano, ScanLine, type LucideProps } from "lucide-react";

const ICONS = { Guitar, Drum, FileCode, FileText, Layers, Mic, Music, Piano, ScanLine };
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C aria-hidden {...props} />;
}
