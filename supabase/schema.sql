create table if not exists profiles (
  id uuid primary key,
  full_name text,
  role text default 'captain',
  created_at timestamp with time zone default now()
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  starts_at timestamp with time zone,
  status text default 'draft',
  entry_fee numeric default 0,
  prize_pool text,
  max_teams int default 32,
  rules text,
  poster_url text,
  created_at timestamp with time zone default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  city text,
  captain_name text,
  phone text,
  email text,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round int not null,
  match_number int not null,
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  score_a int default 0,
  score_b int default 0,
  winner_id uuid references teams(id),
  status text default 'scheduled',
  created_at timestamp with time zone default now()
);
