import { useI18n } from '../features/settings/locale';
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./arc/button/button";
import { motionTokens } from "./arc/lib/motion-tokens";
import styles from "./CopyForAI.module.css";
import { CardActionLabel } from './CardActionLabel';

/** One clipboard action and feedback language across desktop layouts. */
export function CopyForAI({ copied = false, onCopy, responsiveLabel = false, label = "Copy for AI", className = "" }: {
  copied?: boolean; onCopy: () => void | Promise<void>; responsiveLabel?: boolean; label?: string; className?: string;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"idle" | "working" | "settled">("idle");
  const pending = phase !== "idle";
  const flight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (phase !== "settled") return;
    // Start the feedback beat after React has committed a visible busy state.
    // Starting it in the click handler could expire before a slow frame paints.
    const timer = window.setTimeout(() => { flight.current = false; setPhase("idle"); }, motionTokens.duration.fast * 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const copy = async () => {
    if (flight.current) return;
    flight.current = true;
    setPhase("working");
    // Write immediately. Keep the acknowledgement visible for one Arc fast beat,
    // even when the clipboard promise settles in the same React batch.
    try { await onCopy(); } finally {
      if (alive.current) setPhase("settled");
    }
  };
  return <Button type="button" variant="primary" size="sm" loading={pending}
    className={`${styles.button} ${copied && !pending ? styles.success : ""} ${className}`}
    aria-label={label} aria-description={copied ? t("Copied") : undefined} onClick={() => void copy()}>
    {copied ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
    {responsiveLabel ? <CardActionLabel compact={t(copied ? 'Copied' : 'Copy')}>{copied ? t("Copied") : t("Copy for AI")}</CardActionLabel> : t(copied ? "Copied" : "Copy for AI")}
  </Button>;
}
