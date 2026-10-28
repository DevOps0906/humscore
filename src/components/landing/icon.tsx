import {
  ArrowUpDown,
  ChartNoAxesGantt,
  Download,
  FileCode,
  FileText,
  Guitar,
  Keyboard,
  Library,
  ListMusic,
  Mic,
  MonitorPlay,
  Music,
  Piano,
  ShieldCheck,
  Upload,
  Zap,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  ArrowUpDown,
  ChartNoAxesGantt,
  Download,
  FileCode,
  FileText,
  Guitar,
  Keyboard,
  Library,
  ListMusic,
  Mic,
  MonitorPlay,
  Music,
  Piano,
  ShieldCheck,
  Upload,
  Zap,
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C aria-hidden {...props} />;
}
