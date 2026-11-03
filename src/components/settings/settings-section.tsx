import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** 설정 화면 카드 하나 — 제목(h2)이 영역 이름이 된다 */
export function SettingsSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`settings-${id}`} className="min-w-0">
      <Card className="gap-4 p-4 lg:p-5">
        <div className="grid gap-1">
          <h2 id={`settings-${id}`} className="text-lg font-medium lg:text-xl">{title}</h2>
          {description && <p className="text-sm text-ink-soft">{description}</p>}
        </div>
        {children}
      </Card>
    </section>
  );
}
