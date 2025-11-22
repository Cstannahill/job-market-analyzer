import { motion } from "framer-motion";

const FeatureHero: React.FC = () => {

    return (
        <>
            <div className="mx-auto relative z-10 text-center">
                <motion.h1
                    className="text-4xl nf-mono sm:text-5xl font-bold mb-4 bg-linear-to-r from-chart-1 via-chart-3 to-chart-2 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    About TrendDev
                </motion.h1>

                <p className="text-sm text-muted-foreground mb-3">
                    Project started:{" "}
                    <time dateTime="2025-10-03" className="font-medium">
                        October 3, 2025
                    </time>
                </p>
                <div className="flex justify-center mb-6">
                    <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
                        TrendDev transforms raw job postings into structured, queryable insights — surfacing
                        trending skills, salary signals, co-occurrence networks, and developer demand patterns to
                        guide better career and hiring decisions.
                    </p>
                </div>
            </div>


            <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-linear-to-r from-chart-1 via-chart-3 to-chart-5 opacity-25 blur-[140px] rounded-full" />
        </>
    )
};

export default FeatureHero;