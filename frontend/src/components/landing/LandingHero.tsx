
export interface LandingHeroTextProps {
    totalPostings: number;
}

export const LandingHeroText = ({ totalPostings }: LandingHeroTextProps) => {

    return (
        <div className="hero-text fade-in">
            <h1 className="hero-title">
                Navigate Your Tech Career with <span className="gradient-text">Real Data</span>
            </h1>
            <p className="hero-subtitle">
                Discover trending skills, salary insights, and market demand across {totalPostings.toLocaleString()} job postings
            </p>
        </div>
    );
}