with source as (

    select * from {{ source('app', 'leads') }}

),

renamed as (

    select
        id as lead_id,
        created_at,
        resume_submitted_at,
        tour_began_at,
        updated_at,
        status,
        tour_id,
        company,
        role,
        notes
    from source

)

select * from renamed