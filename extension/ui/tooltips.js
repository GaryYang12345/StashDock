/** One delegated, opt-in hint layer for React and the HTML extension. */
export function installTooltips(doc, motion) {
    const win = doc.defaultView;
    const bubble = doc.createElement("div");
    bubble.id = "stashdock-tooltip";
    bubble.className = "stash-tooltip";
    bubble.setAttribute("role", "tooltip");
    bubble.setAttribute("data-arc-ui", "");
    bubble.hidden = true;
    // Keep modal hints in the modal's accessible subtree, but render above its
    // clipping/entrance transform. Manual popovers never dismiss the dialog.
    const topLayer = typeof bubble.showPopover === "function";
    if (topLayer)
        bubble.setAttribute("popover", "manual");
    const closeTopLayer = () => { if (topLayer && bubble.matches(":popover-open"))
        bubble.hidePopover(); };
    doc.body.append(bubble);
    let anchor = null;
    let timer = 0, leaveTimer = 0, exitTimer = 0;
    let animation;
    const observer = new MutationObserver(() => {
        if (!anchor)
            return;
        if (!anchor.isConnected || anchor.closest('[inert], [hidden], [aria-hidden="true"], dialog:not([open])'))
            hide();
        else if (!bubble.hidden) {
            if (bubble.textContent !== text(anchor))
                bubble.textContent = text(anchor);
            place();
        }
    });
    const selector = "[data-tooltip]";
    const find = (target) => target instanceof Element ? target.closest(selector) : null;
    const text = (node) => node.dataset.tooltip || "";
    const describe = (node, add) => {
        const ids = new Set((node.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
        if (add)
            ids.add(bubble.id);
        else
            ids.delete(bubble.id);
        if (ids.size)
            node.setAttribute("aria-describedby", [...ids].join(" "));
        else
            node.removeAttribute("aria-describedby");
    };
    const place = () => {
        if (!anchor)
            return;
        const surface = anchor.closest('dialog[open], [role="dialog"]');
        const bounds = surface?.getBoundingClientRect() || { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight, width: win.innerWidth, height: win.innerHeight };
        const inset = 8, gap = 8;
        bubble.style.maxWidth = `${Math.max(1, Math.min(240, bounds.width - inset * 2))}px`;
        bubble.style.maxHeight = `${Math.max(1, bounds.height - inset * 2)}px`;
        const rect = anchor.getBoundingClientRect(), hint = bubble.getBoundingClientRect();
        const left = Math.min(bounds.right - hint.width - inset, Math.max(bounds.left + inset, rect.left + (rect.width - hint.width) / 2));
        let top = rect.top - hint.height - gap;
        if (top < bounds.top + inset)
            top = rect.bottom + gap;
        top = Math.max(bounds.top + inset, Math.min(top, bounds.bottom - hint.height - inset));
        bubble.style.pointerEvents = left < rect.right && left + hint.width > rect.left && top < rect.bottom && top + hint.height > rect.top ? "none" : "auto";
        bubble.style.left = `${left}px`;
        bubble.style.top = `${top}px`;
    };
    const hide = () => {
        // Repeated scroll/resize events must not restart an in-progress fade-out.
        if (!anchor)
            return;
        win.clearTimeout(timer);
        timer = 0;
        win.clearTimeout(leaveTimer);
        observer.disconnect();
        if (anchor)
            describe(anchor, false);
        anchor = null;
        if (bubble.hidden)
            return;
        animation?.cancel();
        const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
        animation = bubble.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 0 : motion.exit * 1000, fill: "forwards" });
        win.clearTimeout(exitTimer);
        exitTimer = win.setTimeout(() => { closeTopLayer(); bubble.hidden = true; animation?.cancel(); }, reduced ? 0 : motion.exit * 1000);
    };
    const show = (node, keyboard = false) => {
        if (node === anchor) {
            win.clearTimeout(leaveTimer);
            if (timer || !bubble.hidden)
                return;
        }
        hide();
        if (!text(node) || node.closest('[inert], [hidden], [aria-hidden="true"], dialog:not([open])'))
            return;
        anchor = node;
        const instant = keyboard;
        timer = win.setTimeout(() => {
            timer = 0;
            if (anchor !== node)
                return;
            if (!node.isConnected || node.closest('[inert], [hidden], [aria-hidden="true"], dialog:not([open])')) {
                hide();
                return;
            }
            win.clearTimeout(exitTimer);
            animation?.cancel();
            closeTopLayer();
            (node.closest('dialog[open], [role="dialog"]') || doc.body).append(bubble);
            // Radix may have hidden the formerly external bubble when opening a modal.
            bubble.removeAttribute("aria-hidden");
            bubble.textContent = text(node);
            bubble.style.visibility = "hidden";
            bubble.hidden = false;
            if (topLayer)
                bubble.showPopover();
            place();
            bubble.style.visibility = "visible";
            describe(node, true);
            const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
            animation = bubble.animate([
                { opacity: 0, transform: reduced || instant ? "none" : "translateY(3px) scale(.97)" },
                { opacity: 1, transform: "none" },
            ], { duration: reduced ? 0 : motion.enter * 1000, easing: `cubic-bezier(${motion.ease.join(",")})`, fill: "forwards" });
            observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert", "hidden", "aria-hidden", "data-tooltip", "open"] });
        }, instant ? 0 : 700);
    };
    const over = (event) => { if (event.pointerType !== "touch") {
        const node = find(event.target);
        if (node)
            show(node);
    } };
    const out = (event) => {
        if (!anchor)
            return;
        if (event.relatedTarget instanceof Node && (anchor?.contains(event.relatedTarget) || bubble.contains(event.relatedTarget)))
            return;
        // A short safe corridor lets the pointer reach a hoverable tooltip.
        win.clearTimeout(timer);
        timer = 0;
        win.clearTimeout(leaveTimer);
        leaveTimer = win.setTimeout(hide, 120);
    };
    const focus = (event) => { const node = find(event.target); if (node?.matches(":focus-visible"))
        show(node, true); };
    const blur = (event) => { if (find(event.target) === anchor)
        hide(); };
    const key = (event) => {
        if (event.key === "Escape" && anchor) {
            const visible = !bubble.hidden;
            hide();
            // A not-yet-visible hint must not swallow the panel/dialog's Escape.
            if (visible) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }
    };
    const down = () => hide();
    const hold = () => win.clearTimeout(leaveTimer);
    doc.addEventListener("pointerover", over);
    doc.addEventListener("pointerout", out);
    doc.addEventListener("pointerdown", down, true);
    doc.addEventListener("focusin", focus);
    doc.addEventListener("focusout", blur);
    doc.addEventListener("keydown", key, true);
    doc.addEventListener("scroll", down, true);
    win.addEventListener("resize", down);
    win.addEventListener("blur", down);
    bubble.addEventListener("pointerenter", hold);
    bubble.addEventListener("pointerleave", hide);
    return () => {
        observer.disconnect();
        win.clearTimeout(timer);
        win.clearTimeout(leaveTimer);
        win.clearTimeout(exitTimer);
        if (anchor)
            describe(anchor, false);
        anchor = null;
        animation?.cancel();
        closeTopLayer();
        bubble.remove();
        doc.removeEventListener("pointerover", over);
        doc.removeEventListener("pointerout", out);
        doc.removeEventListener("pointerdown", down, true);
        doc.removeEventListener("focusin", focus);
        doc.removeEventListener("focusout", blur);
        doc.removeEventListener("keydown", key, true);
        doc.removeEventListener("scroll", down, true);
        win.removeEventListener("resize", down);
        win.removeEventListener("blur", down);
    };
}
