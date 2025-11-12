

export const LandingCTA = () => {
    return (
        <div className="hero-cta flex justify-center">
            <div className="cta-card glass text-center p-4 rounded-2xl shadow-lg card-stylish">
                <h4>Ready to explore the market?</h4>
                <p>Dive deeper into job postings and skill trends</p>
                <p>Sign up to gain free access to resume insights! </p>
                <div className="cta-buttons flex flex-wrap justify-center gap-2 mt-2">
                    <a href="/register" className="btn btn-primary">Sign Up</a>
                    <a href="/top-tech" className="btn btn-primary">Explore Top Tech</a>
                    <a href="/postings" className="btn btn-primary">Browse Jobs</a>
                    <a href="/trends" className="btn btn-secondary">View Trends</a>
                </div>
            </div>
        </div>
    );
}