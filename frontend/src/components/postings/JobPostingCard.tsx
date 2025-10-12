import React from 'react';
import { type ExtendedJobPosting } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toProperCase } from '@/lib/stringHelpers';
import { MetaPillContainer } from '@/components/postings/MetaPillContainer';

interface JobPostingCardProps {
    posting: ExtendedJobPosting;
}

export const JobPostingCard: React.FC<JobPostingCardProps> = ({ posting }) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const monthDay = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
        return monthDay;
    };


    return (
        <Card className="job-card">
            <MetaPillContainer posting={posting} date={formatDate(posting.date)} />
            <CardHeader className="job-card-header justify-items-center ">
                <div className="job-header-left ">
                    <Badge className="company-badge" aria-hidden>
                        {posting.company ? posting.company.charAt(0).toUpperCase() : posting.source_file?.charAt(0).toUpperCase()}
                    </Badge>
                    <div className="company-name-row">
                        {posting.company && <span className="company-name ">{posting.company}</span>}</div>


                    {/* <span className="job-date">{posting && posting.date ? formatDate(posting.date) : null}</span> */}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p className="job-title">{posting.job_title}</p>
                </div>


                <div className="flex w-full justify-between">
                    <span className="salary">{posting.salary_range ? `$${posting.salary_range}` : null}</span>

                </div>
            </CardHeader>
            <CardDescription className="job-card-description">
                {posting.job_description ? posting.job_description : (posting.job_description ? posting.job_description.slice(0, 200) + (posting.job_description.length > 200 ? '...' : '') : 'No description available')}

            </CardDescription>
            <CardContent >
                <div className="job-section">
                    {posting.technologies.length > 0 && (
                        <div className="">
                            <h4>Technologies and Skills</h4>
                            <div className="tag-container">
                                {posting.technologies.slice(0, 5).map((tech, index) => (
                                    <Badge key={index} className="tag tag-technology">
                                        {toProperCase(tech)}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {posting.skills.length > 0 && (
                    <div className="job-section">

                        <div className="tag-container">
                            {posting.skills.slice(0, 5).map((skill, index) => (
                                <Badge key={index} className="tag tag-skill" variant="secondary">
                                    {toProperCase(skill)}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}


                {/* Benefits */}
                {/* {('benefits' in posting) && posting.benefits && posting.benefits.length > 0 && (
                    <div className="job-section">
                        <h4>Benefits</h4>
                        <div className="tag-container">
                            {posting.benefits!.map((b: string, i: number) => (
                                <Badge key={i} className="tag tag-benefit">{b}</Badge>
                            ))}
                        </div>
                    </div>
                )} */}

                {/* Requirements */}
                {('requirements' in posting) && posting.requirements && posting.requirements.length > 0 && (
                    <div className="job-section">
                        <h4>Requirements</h4>
                        <div className="tag-container requirements-container">
                            {posting.requirements!.map((r: string, i: number) => {
                                // heuristic: long requirements get line clamp
                                const isLong = r.length > 90; // adjust threshold as needed
                                return (
                                    <Badge
                                        key={i}
                                        className={`tag tag-req requirement-badge ${isLong ? 'clamped' : ''}`}
                                        variant="secondary"
                                        title={r}
                                    >
                                        {r}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};