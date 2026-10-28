"use client";

import { Plus } from "lucide-react";
import { FAQS } from "./data";
import { replaceHash, useHash } from "./use-hash";
import styles from "./landing.module.css";

/** FAQ 아코디언: 하나만 열림. #faq-<id>(예: #faq-free)로 열리고, #faq-none은 모두 닫힘. 기본은 첫 문항. */
export function Faq() {
  const hash = useHash();
  const key = /^#faq-([\w-]+)$/.exec(hash)?.[1];
  const found = FAQS.findIndex((f) => f.id === key);
  const open = key === "none" ? -1 : found >= 0 ? found : 0;

  return (
    <div className="max-w-[820px]">
      {FAQS.map((f, i) => {
        const on = i === open;
        return (
          <div key={f.q} id={`faq-${f.id}`} className={`${styles.faqItem} scroll-mt-28 py-1 md:scroll-mt-20`}>
            <h3>
              <button
                type="button"
                id={`faq-btn-${f.id}`}
                aria-expanded={on}
                aria-controls={`faq-panel-${f.id}`}
                onClick={() => replaceHash(on ? "#faq-none" : `#faq-${f.id}`)}
                className="flex min-h-[var(--tap-min)] w-full items-center justify-between gap-4 py-3 text-left text-lg font-medium"
              >
                {f.q}
                <Plus className={`size-5 shrink-0 text-accent transition-transform ${on ? "rotate-45" : ""}`} aria-hidden />
              </button>
            </h3>
            <div id={`faq-panel-${f.id}`} role="region" aria-labelledby={`faq-btn-${f.id}`} hidden={!on}>
              <p className="max-w-[64ch] pb-4 text-base leading-[1.7] text-ink/70">{f.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
