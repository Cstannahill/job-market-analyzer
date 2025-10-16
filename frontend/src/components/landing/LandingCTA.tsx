

export const LandingCTA = () => {
    return (
        <div className="hero-cta flex justify-center">
            <div className="cta-card glass text-center p-8 rounded-2xl shadow-lg card-stylish">
                <h2>Ready to explore the market?</h2>
                <p>Dive deeper into job postings and skill trends</p>
                <div className="cta-buttons flex flex-wrap justify-center gap-4 mt-4">
                    <a href="/top-tech" className="btn btn-primary">Explore Top Tech</a>
                    <a href="/postings" className="btn btn-primary">Browse Jobs</a>
                    <a href="/trends" className="btn btn-secondary">View Trends</a>
                </div>
            </div>
        </div>
    );
}