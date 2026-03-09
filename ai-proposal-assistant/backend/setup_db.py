"""
Run this script once to create the required tables in Supabase.
Uses the Supabase Management API via direct PostgreSQL connection.
"""
import httpx
import sys

# Supabase project ref extracted from URL
PROJECT_REF = "ylqqgbgqdcxreekaksxw"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlscXFnYmdxZGN4cmVla2Frc3h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA1NjM2NywiZXhwIjoyMDg4NjMyMzY3fQ.gyPdxTtC5F206SCmubBfYyW8I5adP9rBSeG0WBxRpOc"

SQL_STATEMENTS = [
    "create extension if not exists vector;",
    """
    create table if not exists proposals (
      id uuid default gen_random_uuid() primary key,
      client_text text not null,
      analysis text,
      created_at timestamptz default now()
    );
    """,
    """
    create table if not exists responses (
      id uuid default gen_random_uuid() primary key,
      proposal_id uuid references proposals(id) on delete cascade,
      response_text text not null,
      result text default 'no_response' check (result in ('won', 'lost', 'no_response')),
      created_at timestamptz default now()
    );
    """,
    """
    create table if not exists embeddings (
      id uuid default gen_random_uuid() primary key,
      content text not null,
      embedding vector(1536),
      metadata jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    """,
    """
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
    """,
]


def run_sql(sql: str):
    """Execute SQL via Supabase pg-meta API."""
    url = f"https://{PROJECT_REF}.supabase.co/pg-meta/default/query"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(url, json={"query": sql}, headers=headers, timeout=30)
    return resp.status_code, resp.text


def main():
    print("Setting up database tables...")
    for i, sql in enumerate(SQL_STATEMENTS, 1):
        desc = sql.strip().split("\n")[0][:60]
        print(f"  [{i}/{len(SQL_STATEMENTS)}] {desc}...")
        status, body = run_sql(sql)
        if status >= 400:
            print(f"    ERROR ({status}): {body}")
            sys.exit(1)
        else:
            print(f"    OK")
    print("\nAll tables created successfully!")


if __name__ == "__main__":
    main()
