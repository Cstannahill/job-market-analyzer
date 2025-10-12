
import { Wifi } from 'lucide-react';
import { getCompanySizeBadgeColor, getIndustryBadgeColor } from '@/lib/postingsBadgeHelpers';
import type { ExtendedJobPosting } from '@/services/api';
import { toProperCase } from '@/lib/stringHelpers';

type MetaPillContainerProps = {
    posting: ExtendedJobPosting;
    date?: string;
};

export function MetaPillContainer({ posting, date }: MetaPillContainerProps) {
    return (
        <div className="meta-pill justify-around ">
            <div className='company-name'>
                {posting.company}
            </div>

            {posting.industry && (
                <span
                    className="meta-pill"
                    style={{
                        backgroundColor: getIndustryBadgeColor(posting.industry),
                        color: '#FFFFFF',
                    }}
                >
                    {toProperCase(posting.industry)}
                </span>

            )}<span className="job-date">{date}</span>



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
                <span className="meta-pill meta-pill-remote">
                    <Wifi size={14} className="remote-icon" />
                    Remote
                </span>
            )}
        </div>
    );
}