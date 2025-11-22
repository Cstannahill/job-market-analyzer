import { AWS_LOGO, CPP_LOGO, GCP_LOGO, GO_LOGO, JAVASCRIPT_LOGO, KUBERNETES_LOGO, POSTGRES_LOGO, PYTHON_LOGO, REACT_LOGO, TD_LOGO, TYPESCRIPT_LOGO, type LogoSpec } from "@/components/shared/logos";
import { motion, type Variants } from "motion/react"
const OUTLINE_DURATION = 2.0;
const OUTLINE_DELAY_STEP = 0.5;
const FILL_OVERLAP = 0.15;
const draw: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: (seqIndex: number = 0) => {
        const outlineDelay = seqIndex * OUTLINE_DELAY_STEP;
        return {
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: {
                    delay: outlineDelay,
                    duration: OUTLINE_DURATION,
                    ease: "linear",
                },
                opacity: {
                    delay: outlineDelay,
                    duration: 0.01,
                },
            },
        };
    },
};
// const logos = [AWS_LOGO, JAVASCRIPT_LOGO, KUBERNETES_LOGO, PYTHON_LOGO, TYPESCRIPT_LOGO,]


export function MotionLogo({
    logo,
    logoIndex,
}: {
    logo: LogoSpec;
    logoIndex: number;
}) {
    return (
        <div style={{ margin: "1rem 0 0 0" }} className="grid justify-center">
            <motion.svg
                viewBox={logo.viewBox}
                width={"5rem"}
                height={"5rem"}
                initial="hidden"
                animate="visible"
                style={{ borderRadius: "1rem" }}
            >
                {logo.paths.map((p, pathIndex) => {
                    const seqIndex = logoIndex * 3 + pathIndex;

                    const outlineDelay = seqIndex * OUTLINE_DELAY_STEP;
                    const fillDelay = outlineDelay + OUTLINE_DURATION - FILL_OVERLAP;

                    return (
                        <g key={pathIndex}>
                            <motion.path
                                d={p.d}
                                transform={p.transform}
                                initial={{ fillOpacity: 0 }}
                                animate={{ fillOpacity: 1 }}
                                transition={{ delay: fillDelay, duration: 0.4 }}
                                style={{ fill: p.fill, stroke: "transparent" }}
                            />

                            <motion.path
                                d={p.d}
                                transform={p.transform}
                                variants={draw}
                                custom={seqIndex}
                                style={{
                                    fill: "transparent",
                                    stroke: p.stroke ?? p.fill,
                                    strokeWidth: 0.75,
                                    strokeLinecap: "round",
                                }}
                            />
                        </g>
                    );
                })}
            </motion.svg></div>
    );
}

export function TechGrid() {
    const LOGOS = [PYTHON_LOGO, JAVASCRIPT_LOGO, AWS_LOGO, KUBERNETES_LOGO, TYPESCRIPT_LOGO];

    return (
        <div className="grid grid-cols-5 grid-cols gap-20">
            {LOGOS.map((logo, i) => (
                <MotionLogo key={i} logo={logo} logoIndex={i + 1} />
            ))}
        </div>
    );
}

export function TechGrid2() {
    const LOGOS = [REACT_LOGO, POSTGRES_LOGO, GCP_LOGO, GO_LOGO, CPP_LOGO];

    return (
        <div className="grid grid-cols-5 grid-cols gap-20">
            {LOGOS.map((logo, i) => (
                <MotionLogo key={i} logo={logo} logoIndex={i + 1} />
            ))}
        </div>
    );
}

export function TechRow() {
    const LOGOS = [PYTHON_LOGO, JAVASCRIPT_LOGO, AWS_LOGO, KUBERNETES_LOGO, TYPESCRIPT_LOGO, REACT_LOGO, POSTGRES_LOGO, GCP_LOGO, GO_LOGO, CPP_LOGO];

    return (
        <div className="grid grid-cols-10 gap-20">
            {LOGOS.map((logo, i) => (
                <MotionLogo key={i} logo={logo} logoIndex={i + 1} />
            ))}
        </div>
    );
}

export function DrawSingleIcon() {
    const LOGOS = [TD_LOGO];

    return (
        <div className="grid grid-cols-10 gap-20">
            {LOGOS.map((logo, i) => (
                <MotionLogo key={i} logo={logo} logoIndex={i + 1} />
            ))}
        </div>
    );
}