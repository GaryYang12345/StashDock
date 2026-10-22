import { useEffect } from "react";
import { installTooltips } from "../lib/tooltips";
import { motionTokens } from "./arc/lib/motion-tokens";
import "../styles/tooltips.css";

export function TooltipLayer() {
  useEffect(() => {
    // The folder has no visual tooltips. Do not install their delegated
    // listeners, observer or bubble in its independent WebView.
    if (document.documentElement.classList.contains('desktop-folder')) return;
    if (document.documentElement.classList.contains('desktop-search')) return;
    return installTooltips(document, { enter: motionTokens.duration.fast, exit: motionTokens.duration.instant, ease: motionTokens.ease.enter });
  }, []);
  return null;
}
