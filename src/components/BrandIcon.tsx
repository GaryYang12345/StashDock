import full from "../../assets/brand/full.png";
import styles from "./BrandIcon.module.css";

export function BrandIcon({ className = "h-5 w-[142px]" }: { className?: string }) {
  return <img src={full} alt="StashDock" draggable={false} className={`${styles.mark} object-contain ${className}`} />;
}
