
import { Wifi } from 'lucide-react';
import { getCompanySizeBadgeColor, getIndustryBadgeColor } from '@/lib/postingsBadgeHelpers';
import type { BaseJobListing } from '@/shared-types';
import { toProperCase } from '@/lib/stringHelpers';

type MetaPillContainerProps = {
    posting: BaseJobListing;
    date?: string;
};

export function MetaPillContainer({ posting, date }: MetaPillContainerProps) {
    const industry = posting?.industry && typeof posting.industry === 'string' ? posting.industry : Array.isArray(posting.industry) && posting.industry.length > 0 && typeof posting.industry[0] === 'string' ? posting.industry[0] : "Unknown";
    return (
        <div className="meta-pill justify-around ">
            <div className='company-name'>
                {posting.company_name && posting.company_name.toProperCase()}
            </div>
            <span
                className="meta-pill"
                style={{
                    backgroundColor: getIndustryBadgeColor(industry),
                    color: '#FFFFFF',
                }}
            >
                {toProperCase(industry)}
            </span>
            <span className="job-date">{date}</span>



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

            {posting.remote_status && (
                <div className="inline-flex">
                    <Wifi size={14} className="remote-icon" />
                </div>

            )}
        </div>
    );
}