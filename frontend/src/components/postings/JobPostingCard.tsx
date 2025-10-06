import React from 'react';
import { type ExtendedJobPosting } from '@/services/api';
import './JobPostingCard.css';
import { Badge } from '@/components/ui/badge';

interface JobPostingCardProps {
    posting: ExtendedJobPosting;
}

export const JobPostingCard: React.FC<JobPostingCardProps> = ({ posting }) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="job-card">
            <div className="job-card-header">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 className="job-title">{posting.title}</h3>
                    <span className="job-meta-row">
                        {posting.industry && <span className="meta-pill">{posting.industry}</span>}
                        {('company_size' in posting) && posting.company_size && <span className="meta-pill">{posting.company_size}</span>}
                        {('remote_status' in posting) && posting.remote_status && <span className="meta-pill">{posting.remote_status}</span>}
                    </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    {('salary_range' in posting) && posting.salary_range ? <div className="salary">{posting.salary_range}</div> : null}
                    <span className="job-date">{formatDate(posting.date)}</span>
                </div>
            </div>

            <div className="job-meta">
                <span className="source-file">📄 {posting.source_file}</span>
            </div>

            {posting.technologies.length > 0 && (
                <div className="job-section">
                    <h4>Technologies</h4>
                    <div className="tag-container">
                        {posting.technologies.map((tech, index) => (
                            <Badge key={index} className="tag tag-technology">
                                {tech}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {posting.skills.length > 0 && (
                <div className="job-section">
                    <h4>Skills</h4>
                    <div className="tag-container">
                        {posting.skills.map((skill, index) => (
                            <Badge key={index} className="tag tag-skill" variant="secondary">
                                {skill}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {posting.raw_text && (
                <div className="job-section">
                    <h4>Preview</h4>
                    <p className="job-preview">{posting.raw_text}</p>
                </div>
            )}

            {/* Benefits */}
            {('benefits' in posting) && posting.benefits && posting.benefits.length > 0 && (
                <div className="job-section">
                    <h4>Benefits</h4>
                    <div className="tag-container">
                        {posting.benefits!.map((b: string, i: number) => (
                            <Badge key={i} className="tag tag-benefit">{b}</Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Requirements */}
            {('requirements' in posting) && posting.requirements && posting.requirements.length > 0 && (
                <div className="job-section">
                    <h4>Requirements</h4>
                    <div className="tag-container">
                        {posting.requirements!.map((r: string, i: number) => (
                            <Badge key={i} className="tag tag-req" variant="secondary">{r}</Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};