import {
  ArrowUpDown,
  AudioWaveform,
  ChartNoAxesGantt,
  Download,
  Eye,
  FileCode,
  FileText,
  Guitar,
  KeyRound,
  Keyboard,
  Library,
  ListMusic,
  Mic,
  MonitorPlay,
  Music,
  PencilLine,
  Piano,
  Play,
  ShieldCheck,
  Timer,
  Upload,
  Zap,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  ArrowUpDown,
  AudioWaveform,
  ChartNoAxesGantt,
  Download,
  Eye,
  FileCode,
  FileText,
  Guitar,
  KeyRound,
  Keyboard,
  Library,
  ListMusic,
  Mic,
  MonitorPlay,
  Music,
  PencilLine,
  Piano,
  Play,
  ShieldCheck,
  Timer,
  Upload,
  Zap,
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C aria-hidden {...props} />;
}
