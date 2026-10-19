"use client";

import { forwardRef, useId, useState } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./checkbox.module.css";

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
}

/** Both marks share three points, so the check morphs into the dash and back instead of swapping. */
const checkPath = "M4.25 9.25 L7.25 12.25 L13.75 5.75";
const dashPath = "M4.75 9 L9 9 L13.25 9";

export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(function Checkbox(
  { label, description, id, className, checked, defaultChecked, onCheckedChange, ...props }, ref,
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const reduced = useReducedMotion();
  const [internal, setInternal] = useState<CheckboxPrimitive.CheckedState>(defaultChecked ?? false);
  const state = checked ?? internal;
  const on = state !== false;
  const change = (next: CheckboxPrimitive.CheckedState) => { if (checked === undefined) setInternal(next); onCheckedChange?.(next); };
  const fade: Transition = { duration: on ? motionTokens.duration.instant : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  return <div className={styles.field}>
    <CheckboxPrimitive.Root {...props} id={controlId} ref={ref} checked={state} onCheckedChange={change} className={[styles.box, className].filter(Boolean).join(" ")} aria-describedby={description ? `${controlId}-description` : undefined} aria-label={props["aria-label"] ?? (label ? undefined : "Checkbox")}>
      <span className={styles.visual} aria-hidden="true">
        <motion.span className={styles.fill} initial={false} animate={{ opacity: on ? 1 : 0, scale: on ? 1 : .6 }} transition={reduced ? { duration: 0 } : { scale: motionTokens.spring.snappy, opacity: fade }} />
        <svg className={styles.mark} viewBox="0 0 18 18" fill="none" focusable="false">
          <motion.path initial={false} animate={{ d: state === "indeterminate" ? dashPath : checkPath, pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduced ? { duration: 0 } : { d: motionTokens.spring.morph, pathLength: motionTokens.spring.snappy, opacity: fade }} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </CheckboxPrimitive.Root>
    {label || description ? <div className={styles.copy}>{label ? <label htmlFor={controlId}>{label}</label> : null}{description ? <span id={`${controlId}-description`}>{description}</span> : null}</div> : null}
  </div>;
});

Checkbox.displayName = "Checkbox";
