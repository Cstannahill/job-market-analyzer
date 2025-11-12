
import { Wifi } from 'lucide-react';
import { getCompanySizeBadgeColor, getIndustryBadgeColor } from '@/lib/postingsBadgeHelpers';
import type { BaseJobListing } from '@/shared-types';
import { toProperCase } from '@/lib/stringHelpers';

type MetaPillContainerProps = {
    posting: BaseJobListing;
    date?: string;
};

export function MetaPillContainer({ posting, date }: MetaPillContainerProps) {
    const industry = posting?.industry && typeof posting.industry === 'string' ? posting.industry : Array.isArray(posting.industry) && posting.industry.length > 0 && typeof posting.industry[0] === 'string' ? posting.industry[0].split(",")[0] : "Unknown";
    return (
        <div className="meta-pill justify-around">
            <span className="job-date">{date}</span>
            <span
                className="meta-pill industry-badge"
                style={{
                    background: getIndustryBadgeColor(industry),
                    backgroundColor: getIndustryBadgeColor(industry),
                    color: '#FFFFFF',
                }}
            >
                {toProperCase(industry).split(",")[0]}
            </span>




            {posting.company_size && (
                <span
                    className="meta-pill"
                    style={{
                        backgroundColor: getCompanySizeBadgeColor(posting.company_size),
                        color: '#FFFFFF',
                    }}
                >
                    {toProperCase(posting.company_size)}
                </span>
            )}

            {posting.remote_status && posting.remote_status.toLowerCase() === "remote" && (
                <div className="inline-flex">
                    <Wifi size={14} className="remote-icon" />
                </div>

            )}
        </div>
    );
}