import React from 'react';
import type { BaseJobListing } from '@/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toProperCase } from '@/lib/stringHelpers';
import { MetaPillContainer } from '@/components/postings/MetaPillContainer';
import TechBadgeSvgr from '@/components/postings/TechBadgeSvgr';
import CompanyBadgeSvgr from '@/components/postings/CompanyBadgeSvgr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
interface JobPostingCardProps {
    posting: BaseJobListing;
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
            <MetaPillContainer posting={posting} date={formatDate(posting.processed_date)} />
            <CardHeader style={{ padding: "0.25rem", margin: "0rem .25rem" }} className="job-card-header">
                <div className="flex flex-row justify-around">
                    {/* <Badge className="company-badge col-6" aria-hidden> */}
                    <CompanyBadgeSvgr name={posting.company_name.toLowerCase()} roundStyle="md" size={50} />
                    {/* </Badge> */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <p className="job-title">{posting.job_title.toProperCase()}</p>
                    </div>
                </div>





                <div className="flex w-full justify-between">
                    <span className="salary">{posting.salary_range ? `$${posting.salary_range}` : null}</span>
                </div>
            </CardHeader>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <CardDescription style={{ padding: "0.1rem" }} className="job-card-description">
                            {(posting.job_description ? posting.job_description.slice(0, 200) + (posting.job_description.length > 200 ? '...' : '') : 'No description available')}

                        </CardDescription>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-stone-200">
                        <p style={{ padding: ".1rem .5rem", color: "black" }} className="text-sm">
                            {posting.job_description}
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <CardContent >
                <div className="job-section">
                    {posting.technologies.length > 0 && (
                        <>
                            <h4>Technologies and Skills</h4>
                            <div className="tag-container flex flex-wrap items-start">
                                {posting.technologies.slice(0, 5).map((tech, index) => (
                                    <TechBadgeSvgr key={`${tech}-${posting.jobId}-${index}`} name={tech} size={26} roundStyle='full' />

                                ))}
                            </div>
                        </>
                    )}
                </div>

                {posting.skills.length > 0 && (
                    <div className="job-section">

                        <div className=" flex flex-col justify-center">
                            <div className="flex flex-row items-center mb-1 tag-container-skills-row">
                                {posting.skills.slice(0, 2).map((skill, index) => (

                                    <Badge key={index} className="tag tag-skill" variant="secondary">
                                        {toProperCase(skill)}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex flex-row items-center mb-1 tag-container-skills-row">
                                {posting.skills.length > 2 && posting.skills.slice(2, 5).map((skill, index) => (

                                    <Badge key={index} className="tag tag-skill" variant="secondary">
                                        {toProperCase(skill)}
                                    </Badge>

                                ))}
                            </div>
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
        </Card >
    );
};