import React from 'react';
import { Link } from 'react-router-dom';
import type { BaseJobListing } from '@job-market-analyzer/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toProperCase } from '@/lib/stringHelpers';
import { MetaPillContainer } from '@/components/postings/MetaPillContainer';
import TechBadgeSvgr from '@/components/postings/TechBadgeSvgr';
import { hasTechIcon } from '@/lib/utils/techBadgeHelpers';
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

    const technologies = posting.technologies ?? [];
    const skills = posting.skills ?? [];
    const companyName = posting.company_name ?? "Unknown company";
    const techsWithIcons = technologies.filter(hasTechIcon);

    return (
        <Link
            to={`/postings/${posting.jobId}`}
            state={{ posting }}
            className="block h-full transition hover:-translate-y-1 hover:no-underline"
        >
            <Card className="job-card cursor-pointer flex h-full flex-col">
                <MetaPillContainer posting={posting} date={formatDate(posting.processed_date)} />
                <CardHeader style={{ padding: "0.25rem", margin: "0rem .25rem" }} className="job-card-header">
                    <div className="flex flex-row justify-around">
                        <CompanyBadgeSvgr name={companyName.toLowerCase()} roundStyle="md" size={50} />
                        {/* </Badge> */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <p className="job-title">{posting.job_title.toProperCase()}</p>
                        </div>
                    </div>





                    <div className="grid w-full justify-center">
                        <span className="salary text-end">{posting.salary_range && posting.salary_range !== "Unknown" ? `${posting.salary_range}` : null}</span>
                    </div>
                </CardHeader>

                <div className="flex flex-col flex-1">
                    <div className="flex-1">
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CardDescription style={{ padding: "0.1rem" }} className="job-card-description h-full">
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
                    </div>
                    <CardContent className="mt-auto">
                        <div className="job-section">
                            {techsWithIcons.length > 0 && (
                                <>
                                    <h4>Technologies and Skills</h4>
                                    <div className="tag-container flex flex-wrap items-start">
                                        {techsWithIcons.slice(0, 4).map((tech, index) => (
                                            <TechBadgeSvgr key={`${tech}-${posting.jobId}-${index}`} name={tech} size={26} roundStyle='full' />

                                        ))}
                                    </div>
                                    <div className="tag-container flex flex-wrap items-start">
                                        {techsWithIcons.slice(4, 7).map((tech, index) => (
                                            <TechBadgeSvgr key={`${tech}-${posting.jobId}-${index}`} name={tech} size={26} roundStyle='full' />

                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {skills.length > 0 && (
                            <div className="job-section">

                                <div className=" flex flex-col justify-center tag-skills-section">
                                    <div className="flex flex-row items-center mb-1 tag-container-skills-row">


                                        {skills.slice(0, 2).map((skill, index) => (
                                            <TooltipProvider key={`${posting.jobId}-${skill}`} delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge key={index} className="tag tag-skill" variant="secondary">
                                                            {toProperCase(skill).slice(0, 25)}
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs bg-stone-200">
                                                        <p style={{ padding: ".1rem .5rem", color: "black" }} className="text-sm">{skill.toProperCase()}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ))}
                                    </div>
                                    <div className="flex flex-row items-center mb-1 tag-container-skills-row">
                                        {skills.length > 2 && skills.slice(2, 5).map((skill, index) => (
                                            <TooltipProvider key={`${posting.jobId}-${skill}`} delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge key={index} className="tag tag-skill" variant="secondary">
                                                            {skill.length > 14 ? `${toProperCase(skill).slice(0, 14)}..` : toProperCase(skill)}
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs bg-stone-200">
                                                        <p style={{ padding: ".1rem .5rem", color: "black" }} className="text-sm">{skill.toProperCase()}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </div>
            </Card >
        </Link>
    );
};
