import { motion, useReducedMotion } from "framer-motion";
import { SIDEKICK_NAME } from "../lib/config.js";

// The sidekick character. Shows up on every screen, optionally with a message.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Props:
//   mood     "idle" | "happy" | "proud" | "nudge" | "thinking" (default "happy")
//   message  optional text. With a message you get the character plus a speech
//            bubble. Without one you get just the character (the Dashboard does
//            this and writes its own headline).
//   size     character width in px. Default: 72 with a message, otherwise it
//            fills its container.
//
// Art: src/assets/sidekick/mascot.svg is our mascot and is used for every mood.
// Moods show through movement (bounce, jump, wiggle, tilt). To give a mood its
// own pose, drop a file named after it into src/assets/sidekick/ (happy.png,
// proud.svg, ...). If there are no images at all, the drawn SVG below is used.

const MOODS = ["idle", "happy", "proud", "nudge", "thinking"];

// How the mascot moves in each mood (loops forever, paused for reduced motion).
const loop = (duration, extra = {}) => ({ duration, repeat: Infinity, ease: "easeInOut", ...extra });
const MOTION = {
    idle: { animate: { y: [0, -4, 0] }, transition: { y: loop(3.2) } },
    happy: { animate: { y: [0, -8, 0] }, transition: { y: loop(1.4) } },
    proud: {
        animate: { y: [0, -16, 0, 0], rotate: [0, -6, 6, 0] },
        transition: { y: loop(1.6, { times: [0, 0.3, 0.6, 1] }), rotate: loop(1.6) },
    },
    nudge: { animate: { rotate: [0, -8, 8, -8, 0, 0] }, transition: { rotate: loop(2, { times: [0, 0.1, 0.2, 0.3, 0.4, 1] }) } },
    thinking: { animate: { rotate: [0, -5, -5, 0], y: [0, -2, 0] }, transition: { rotate: loop(3), y: loop(3) } },
};

const images = import.meta.glob("../assets/sidekick/*.{png,svg,webp,jpg,jpeg}", {
    eager: true,
    import: "default",
});
const imageByMood = Object.fromEntries(
    Object.entries(images).map(([path, url]) => [
        path.split("/").pop().replace(/\.[^.]+$/, ""),
        url,
    ])
);

const INK = "#1B1740";
const SPARK = "#FFD23F";
const BOLT = "#4B3FD1";
const GLOW = "#8F85FF";
const BLUSH = "#FF9E7A";

const stroke = {
    fill: "none",
    stroke: INK,
    strokeWidth: 3.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

const Eyes = ({ y = 54, dx = 0, dy = 0, r = 4.5 }) => (
    <>
        <circle cx={38 + dx} cy={y + dy} r={r} fill={INK} />
        <circle cx={62 + dx} cy={y + dy} r={r} fill={INK} />
    </>
);

const BigSmile = () => <path d="M38 66 Q50 82 62 66 Z" fill={INK} />;

const Cheeks = () => (
    <>
        <circle cx="29" cy="67" r="5" fill={BLUSH} opacity="0.6" />
        <circle cx="71" cy="67" r="5" fill={BLUSH} opacity="0.6" />
    </>
);

const Sparkle = ({ x, y, s = 1 }) => (
    <path
        transform={`translate(${x} ${y}) scale(${s})`}
        d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
        fill={GLOW}
    />
);

const FACES = {
    idle: (
        <>
            <Eyes r={4} />
            <path d="M42 70 Q50 74 58 70" {...stroke} />
        </>
    ),
    happy: (
        <>
            <Eyes />
            <BigSmile />
            <Cheeks />
        </>
    ),
    proud: (
        <>
            <path d="M33 56 Q38 48 43 56" {...stroke} />
            <path d="M57 56 Q62 48 67 56" {...stroke} />
            <BigSmile />
            <Cheeks />
            <Sparkle x={12} y={32} s={1.2} />
            <Sparkle x={90} y={40} />
            <Sparkle x={86} y={14} s={0.7} />
        </>
    ),
    nudge: (
        <>
            <Eyes r={4} />
            <path d="M31 45 L44 47" {...stroke} strokeWidth={3} />
            <path d="M56 44 L68 40" {...stroke} strokeWidth={3} />
            <path d="M42 71 Q52 73 59 66" {...stroke} />
        </>
    ),
    thinking: (
        <>
            <Eyes y={52} dx={3} dy={-2} r={4} />
            <path d="M44 71 H57" {...stroke} />
            <circle cx="80" cy="26" r="2.5" fill={GLOW} />
            <circle cx="88" cy="18" r="3.2" fill={GLOW} />
            <circle cx="94" cy="8" r="4" fill={GLOW} />
        </>
    ),
};

function Character({ mood, label }) {
    return (
        <svg
            viewBox="0 0 100 100"
            className="block h-auto w-full"
            role="img"
            aria-label={label}
        >
            <path d="M55 2 L41 22 L50 22 L45 34 L61 15 L52 15 Z" fill={BOLT} />
            <circle cx="50" cy="58" r="34" fill={SPARK} />
            {FACES[mood]}
        </svg>
    );
}

export default function Sidekick({ message, mood = "happy", size }) {
    const reduceMotion = useReducedMotion();
    const safeMood = MOODS.includes(mood) ? mood : "idle";
    const label = `${SIDEKICK_NAME} looks ${safeMood}`;
    const width = size ?? (message ? 72 : "100%");
    const custom = imageByMood[safeMood] ?? imageByMood.mascot;

    const character = (
        <motion.div
            key={safeMood}
            style={{ width }}
            className="shrink-0"
            // Pop once when the mood changes, then a slow float.
            initial={reduceMotion ? false : { scale: 0.85, y: 6 }}
            animate={reduceMotion ? undefined : { scale: 1, ...MOTION[safeMood].animate }}
            transition={{
                scale: { type: "spring", stiffness: 300, damping: 14 },
                ...MOTION[safeMood].transition,
            }}
        >
            {custom ? (
                <img src={custom} alt={label} className="block h-auto w-full" />
            ) : (
                <Character mood={safeMood} label={label} />
            )}
        </motion.div>
    );

    if (!message) return character;

    return (
        <div className="flex items-center gap-4">
            {character}
            <div
                role="status"
                aria-live="polite"
                className="relative rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#1B1740] shadow-sm ring-1 ring-[#1B1740]/10"
            >
        <span
            aria-hidden="true"
            className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white ring-1 ring-[#1B1740]/10 [clip-path:polygon(0_0,0_100%,100%_100%)]"
        />
                {message}
            </div>
        </div>
    );
}
