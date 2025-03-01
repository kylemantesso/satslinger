create table drops (
  id uuid default uuid_generate_v4() primary key,
  hash text not null unique,
  secret_key text not null,
  tweet_id text not null,
  tweet_text text,
  campaign_id text not null,
  twitter_handle text not null,
  amount bigint not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists drops_hash_idx on public.drops using btree (hash) tablespace pg_default;