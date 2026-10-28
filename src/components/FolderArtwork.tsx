import { memo, useId } from "react";
import { Link } from "lucide-react";
import { FolderCloseArtwork } from "./FolderCloseArtwork";
import brandMark from "../../assets/brand/icon.svg";

const front = "M92 126H153C167 126 175 131 184 141L194 153C201 162 208 165 220 165H271C299 165 317 185 314 213L309 265C306 293 292 311 263 311H100C72 311 58 296 56 271L48 174C46 145 65 126 92 126Z"
const rear = "M101 89H260C288 89 306 106 306 135V266C306 293 290 309 264 309H100C73 309 59 294 59 267V133C59 106 74 89 101 89Z"

// Approved monochrome Framer geometry. No alternate palettes or editor controls.
const references = [
    { type: "document", x: 75, y: 81, w: 111, h: 105, radius: 15, rotate: -8 },
    { type: "link", x: 238, y: 104, w: 73, h: 88, radius: 15, rotate: 7 },
    { type: "photo", x: 151, y: 92, w: 101, h: 105, radius: 16, rotate: 3 },
]

export const FolderArtwork = memo(function FolderArtwork({ layer, nativeClose = false }: { layer?: "rear" | "cards" | "front"; nativeClose?: boolean } = {}) {
    const uid = "folder" + useId().replace(/[^a-zA-Z0-9]/g, "");
    const url = (name: string) => `url(#${uid}${name})`;
    const face = front;
    const rim = "M92 129H153C166 129 173 134 182 143L192 155C200 165 208 168 220 168H271C297 168 314 187 311 213L306 265C303 292 291 308 263 308H100C74 308 61 294 59 271L51 174C49 147 66 129 92 129Z";
    const cardLayer = (blurred = false) => references.map(card => <g key={card.type} className="folder-reference">
        <g transform={`rotate(${card.rotate} ${card.x + card.w / 2} ${card.y + card.h / 2})`}>
            <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={card.radius} fill={url("card")} filter={blurred ? undefined : url("cardShadow")} stroke="#929292" strokeOpacity=".12" strokeWidth="1" />
            <rect x={card.x + 2} y={card.y + 2} width={card.w - 4} height={card.h - 4} rx={card.radius - 2} fill="none" stroke="white" strokeOpacity=".8" strokeWidth="1.5" />
            {card.type === "document" && <g transform={`translate(${card.x + 16} ${card.y + 18})`}>
                <rect width="55" height="8" rx="4" fill={url("glyph")} />
                <rect y="19" width="76" height="5.5" rx="2.75" fill="#C6C6C6" />
                <rect y="33" width="62" height="5.5" rx="2.75" fill="#D0D0D0" />
            </g>}
            {card.type === "photo" && <g transform={`translate(${card.x + 10} ${card.y + 11})`}>
                <g clipPath={url("photoArt")}>
                    <rect width="81" height="83" rx="10" fill={url("photo")} />
                    <circle cx="62" cy="20" r="8" fill={url("photoGlyph")} />
                    <path d="M-4 79L29 37Q35 29 41 37L59 60L65 51Q70 45 75 51L86 66V89H-4Z" fill={url("photoGlyph")} />
                </g>
            </g>}
            {card.type === "link" && <g transform={`translate(${card.x + 17} ${card.y + 13})`}>
                <Link size={39} strokeWidth={3} aria-hidden="true" stroke={url("glyph")} filter={blurred ? undefined : url("stamp")}  />
                <rect x="-3" y="48" width="44" height="5" rx="2.5" fill="#C4C4C4" />
                <rect x="-3" y="61" width="29" height="5" rx="2.5" fill="#D0D0D0" />
            </g>}
        </g>
    </g>)

    return (
        <svg viewBox="0 0 360 360" width="100%" height="100%" aria-hidden="true" focusable="false" className="folder-artwork">
            <defs>
                <linearGradient id={uid + "rear"} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#E2E2E2" /><stop offset=".45" stopColor="#F7F7F7" /><stop offset="1" stopColor="#DADADA" /></linearGradient>
                <linearGradient id={uid + "card"} x1="0" y1="0" x2=".35" y2="1"><stop stopColor="#FCFCFC" /><stop offset=".6" stopColor="#EEEEEE" /><stop offset="1" stopColor="#E8E8E8" /></linearGradient>
                <linearGradient id={uid + "photo"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#E5E5E5" /><stop offset="1" stopColor="#CBCBCB" /></linearGradient>
                <linearGradient id={uid + "glyph"} x1="0" y1="0" x2=".35" y2="1"><stop stopColor="#828282" /><stop offset="1" stopColor="#4C4C4C" /></linearGradient>
                <linearGradient id={uid + "photoGlyph"} x1="0" y1="0" x2=".35" y2="1"><stop stopColor="#969696" /><stop offset="1" stopColor="#747474" /></linearGradient>
                <linearGradient id={uid + "face"} x1="0" y1="0" x2=".3" y2="1"><stop stopColor="white" stopOpacity=".85" /><stop offset=".5" stopColor="#F6F6F6" stopOpacity=".61" /><stop offset="1" stopColor="#EEEEEE" stopOpacity=".87" /></linearGradient>
                <linearGradient id={uid + "edge"} x1="0" y1="0" x2=".6" y2="1"><stop stopColor="white" stopOpacity=".95" /><stop offset=".5" stopColor="white" stopOpacity=".65" /><stop offset="1" stopColor="#F8F8F8" stopOpacity=".8" /></linearGradient>
                <linearGradient id={uid + "mark"} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#525252" /><stop offset=".5" stopColor="#3B3B3B" /><stop offset="1" stopColor="#444444" /></linearGradient>
                <radialGradient id={uid + "light"} cx=".28" cy=".18" r=".9"><stop stopColor="white" stopOpacity=".26" /><stop offset="1" stopColor="white" stopOpacity="0" /></radialGradient>
                <filter id={uid + "shadow"} x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="11" stdDeviation="10" floodColor="#545454" floodOpacity=".18" /></filter>
                <filter id={uid + "cardShadow"} x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#626262" floodOpacity=".18" /></filter>
                <filter id={uid + "stamp"} x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="1.1" stdDeviation=".6" floodColor="#343434" floodOpacity=".18" /></filter>
                <filter id={uid + "blur"} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="8" /></filter>
                <filter id={uid + "inset"} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="soft" /><feComposite in="SourceAlpha" in2="soft" operator="out" result="edgeAlpha" />
                    <feFlood floodColor="#8A8A8A" floodOpacity=".38" /><feComposite in2="edgeAlpha" operator="in" result="shade" />
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="narrow" /><feOffset in="narrow" dx="0" dy="3" result="offset" />
                    <feComposite in="SourceAlpha" in2="offset" operator="out" result="upper" /><feFlood floodColor="#959595" floodOpacity=".14" /><feComposite in2="upper" operator="in" result="upperShade" />
                    <feMerge><feMergeNode in="shade" /><feMergeNode in="upperShade" /></feMerge>
                </filter>
                <mask id={uid + "brand"} maskUnits="userSpaceOnUse" x="81" y="255" width="46" height="38" style={{ maskType: "alpha" }}>
                    <image href={brandMark} x="81" y="255" width="45.828" height="36.515" />
                </mask>
                <clipPath id={uid + "pocket"}><path d="M51 20H323V183L303 293H75L51 181Z" /></clipPath>
                <clipPath id={uid + "photoArt"}><rect width="81" height="83" rx="10" /></clipPath>
                <clipPath id={uid + "faceClip"}><path d={face} /></clipPath>
                <mask id={uid + "exposed"} maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="360"><rect width="360" height="360" fill="white" /><path d={face} fill="black" /></mask>
            </defs>
            {(!layer || layer === "rear") && <g>
            <path d={face} fill="white" filter={url("shadow")} />
            <path d={rear} fill={url("rear")} />
            <path d="M100 93H260C286 93 302 109 302 135" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="1.8" />
            </g>}
            {(!layer || layer === "cards") && <g>
            {<g clipPath={url("pocket")}><g mask={url("exposed")}>{cardLayer()}</g></g>}
            {<g clipPath={url("faceClip")}><g clipPath={url("pocket")} filter={url("blur")} opacity=".53">{cardLayer(true)}</g></g>}
            </g>}
            {(!layer || layer === "front") && <g>
            <path className="folder-pocket-outline" d={face} fill={url("face")} stroke="#A1A1A1" strokeOpacity=".19" strokeWidth="1.2" />
            <path d={face} fill="white" filter={url("inset")} />
            <path d={rim} fill="none" stroke={url("edge")} strokeWidth="2.5" />
            <path d={face} fill={url("light")} />
            <g clipPath={url("faceClip")}>
                <g transform="translate(0 .7)"><rect x="81" y="255" width="46" height="38" fill="white" opacity=".64" mask={url("brand")} /></g>
                <rect x="81" y="255" width="46" height="38" fill={url("mark")} mask={url("brand")} />
            </g>
            {nativeClose && <g transform="translate(240.75 168.75) scale(2.25)"><FolderCloseArtwork /></g>}
            </g>}
        </svg>
    );
});
