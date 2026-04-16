with stg as (
    select count(*) as stg_leads
    from {{ ref('stg_leads') }}
),

fct as (
    select sum(leads_created) as fct_leads_created
    from {{ ref('fct_lead_kpis_daily') }}
)

select *
from stg, fct
where stg_leads != fct_leads_created