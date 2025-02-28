create table
  public.drops (
    id bigint generated always as identity not null,
    hash text not null,
    secret_key text not null,
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    tweet_id text null,
    campaign_id bigint null,
    twitter_handle text null,
    constraint drops_pkey primary key (id),
    constraint drops_hash_key unique (hash)
  ) tablespace pg_default;

create index if not exists drops_hash_idx on public.drops using btree (hash) tablespace pg_default;