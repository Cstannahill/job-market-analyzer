import React from 'react';
import { type JobPosting } from '../services/api';
import './JobPostingCard.css';
import { Badge } from './ui/badge';

interface JobPostingCardProps {
    posting: JobPosting;
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
                <h3 className="job-title">{posting.title}</h3>
                <span className="job-date">{formatDate(posting.date)}</span>
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
        </div>
    );
};