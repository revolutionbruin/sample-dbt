with leads as (

    select * from {{ ref('stg_leads') }}

),

tour_events as (

    select * from {{ ref('stg_tour_events') }}

),

event_rollup as (

    select
        l.lead_id,
        min(te.first_seen_at) as first_event_at
    from leads l
    left join tour_events te
        on l.tour_id = te.tour_id
    group by 1

),

final as (

    select
        l.lead_id,
        l.tour_id,
        l.company,
        l.role,
        l.status,
        l.created_at,
        l.updated_at,
        l.resume_submitted_at,
        l.tour_began_at,

        er.first_event_at,

        case
            when l.tour_began_at is not null and er.first_event_at is not null
                then least(l.tour_began_at, er.first_event_at)
            when l.tour_began_at is not null
                then l.tour_began_at
            when er.first_event_at is not null
                then er.first_event_at
            else null
        end as engagement_at,

        case
            when l.resume_submitted_at is not null
              or l.status = 'resume_submitted' then 1
            else 0
        end as resume_submitted_flag,

        case
            when l.status = 'rejected' then 1
            else 0
        end as rejected_flag

    from leads l
    left join event_rollup er
        on l.lead_id = er.lead_id

)

select
    *,
    case
        when engagement_at >= created_at
         and engagement_at < created_at + interval '7 day'
            then 1
        else 0
    end as engaged_within_7d_flag
from final