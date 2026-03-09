-- Enable pgvector extension
create extension if not exists vector;

-- Proposals table
create table if not exists proposals (
  id uuid default gen_random_uuid() primary key,
  client_text text not null,
  analysis text,
  created_at timestamptz default now()
);

-- Responses table
create table if not exists responses (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid references proposals(id) on delete cascade,
  response_text text not null,
  result text default 'no_response' check (result in ('won', 'lost', 'no_response')),
  created_at timestamptz default now()
);

-- Embeddings table
create table if not exists embeddings (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Index for faster similarity search
create index if not exists embeddings_embedding_idx
  on embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Function for similarity search
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 3
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    embeddings.id,
    embeddings.content,
    embeddings.metadata,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
