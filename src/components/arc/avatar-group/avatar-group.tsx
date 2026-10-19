"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import { Avatar } from "../avatar/avatar";
import styles from "./avatar-group.module.css";

export interface AvatarGroupMember { name: string; src?: string; status?: "online" | "offline"; }
export interface AvatarGroupProps { members: AvatarGroupMember[]; max?: number; size?: "sm" | "md" | "lg"; label?: string; }

/** The overflow count rolls the way it moved: more people rise in from below, fewer drop in from above. */
const rise: Variants = { hidden: (direction: number) => ({ opacity: 0, y: `${.4 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }), shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } }, gone: (direction: number) => ({ opacity: 0, y: `${-.4 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }) };
// Same keys as `rise` so the settled style is identical whichever branch renders on the server.
const fade: Variants = { hidden: { opacity: 0, y: 0, filter: "blur(0px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } }, gone: { opacity: 0, y: 0, filter: "blur(0px)", transition: { duration: motionTokens.duration.instant } } };
// A person joining or leaving opens or closes their slot, so the rest of the stack slides instead of jumping.
const slot = { initial: { width: 0, opacity: 0, scale: .9 }, animate: { width: "auto", opacity: 1, scale: 1 }, exit: { width: 0, opacity: 0, scale: .9 } };

export function AvatarGroup({ members, max = 4, size = "md", label = "Team members" }: AvatarGroupProps) {
  const reduceMotion = !!useReducedMotion();
  const visible = members.slice(0, Math.max(0, max));
  const overflow = Math.max(0, members.length - visible.length);
  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.morph;
  const [count, setCount] = useState({ overflow, direction: 1 });
  if (count.overflow !== overflow) setCount({ overflow, direction: overflow < count.overflow ? -1 : 1 });
  return <div className={[styles.group, styles[size]].join(" ")} role="group" aria-label={label} style={{ "--count": visible.length + (overflow > 0 ? 1 : 0) } as CSSProperties}>
    <AnimatePresence initial={false}>
      {visible.map((member, index) => <motion.span key={member.name} className={styles.slot} style={{ "--index": index } as CSSProperties} {...slot} transition={transition}><span className={styles.lift}><Avatar className={styles.avatar} name={member.name} src={member.src} status={member.status} size={size} /><span className={styles.tip} aria-hidden="true">{member.name}</span></span></motion.span>)}
      {overflow > 0 ? <motion.span key="overflow" className={styles.slot} style={{ "--index": visible.length } as CSSProperties} {...slot} transition={transition}><span className={[styles.lift, styles.overflow, styles[size]].join(" ")} role="img" aria-label={`${overflow} more ${label.toLowerCase()}`}><AnimatePresence mode="popLayout" initial={false} custom={count.direction}><motion.span key={overflow} className={styles.count} custom={count.direction} variants={reduceMotion ? fade : rise} initial="hidden" animate="shown" exit="gone" aria-hidden="true">+{overflow}</motion.span></AnimatePresence></span></motion.span> : null}
    </AnimatePresence>
  </div>;
}

export default AvatarGroup;

