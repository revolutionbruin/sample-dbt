with source as (

    select * from {{ source('app', 'tour_events') }}

),

renamed as (

    select
        id as event_id,
        tour_id,
        event_type,
        first_seen_at,
        page_path
    from source

)

select * from renamed