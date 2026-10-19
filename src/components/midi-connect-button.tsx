"use client";

import { Cable } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MidiStatus } from "@/hooks/use-midi-input";

interface Props {
  status: MidiStatus;
  devices: string[];
  message: string;
  onConnect: () => void;
}

export function MidiConnectButton({ status, devices, message, onConnect }: Props) {
  const connected = status === "connected";
  let info = "";
  if (connected) info = devices.length > 0 ? devices.join(", ") : "연결됨 · 장치를 연결하면 자동으로 인식해요";
  else if (status === "connecting") info = "연결 중…";
  else if (status === "denied" || status === "unsupported") info = message;

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={onConnect}
        disabled={connected || status === "connecting"}
        className={`h-11 w-fit rounded-full px-4 text-sm sm:h-9 ${connected ? "border-accent bg-accent/15 text-accent" : ""}`}
      >
        <Cable className="size-4" aria-hidden />
        {connected ? "MIDI 건반 연결됨" : "MIDI 건반 연결"}
      </Button>
      {info && (
        <p role="status" className={`text-xs ${status === "denied" || status === "unsupported" ? "text-destructive" : "text-ink-soft"}`}>
          {info}
        </p>
      )}
    </div>
  );
}
