select
    date(created_at) as metric_date,
    count(*) as leads_created,

    sum(resume_submitted_flag) as resumes_submitted,
    round(sum(resume_submitted_flag)::numeric / nullif(count(*), 0), 4) as resume_submission_rate,

    sum(rejected_flag) as rejected_leads,
    round(sum(rejected_flag)::numeric / nullif(count(*), 0), 4) as rejection_rate,

    sum(engaged_within_7d_flag) as engaged_within_7d_leads,
    round(sum(engaged_within_7d_flag)::numeric / nullif(count(*), 0), 4) as engagement_7d_rate
from {{ ref('int_lead_engagement') }}
group by 1
order by 1