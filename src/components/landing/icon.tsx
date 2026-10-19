import { ArrowUpDown, Download, FileCode, FileText, ListMusic, MonitorPlay, Music, Piano, Mic, type LucideProps } from "lucide-react";

const ICONS = { ArrowUpDown, Download, FileCode, FileText, ListMusic, MonitorPlay, Music, Piano, Mic };
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C aria-hidden {...props} />;
}
