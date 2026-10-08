create table if not exists targets (
  id serial primary key,
  name text unique not null,
  conn text not null,          -- AES-256-GCM encrypted connection string
  auto boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists backups (
  id bigserial primary key,
  target_id integer not null references targets(id) on delete cascade,
  status text not null,        -- ok | failed
  bytes bigint not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index on backups(target_id, created_at desc);
