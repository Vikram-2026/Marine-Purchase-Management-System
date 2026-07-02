const { Client } = require('pg');

const connString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

const client = new Client({
  connectionString: connString,
  ssl: { rejectUnauthorized: false }
});

const sql = `
create extension if not exists pgcrypto;

create table if not exists vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  imo text,
  registration_no text,
  flag text,
  status text default 'Active',
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  contact_person text,
  email text,
  phone text,
  port text,
  currency text default 'USD',
  payment_terms text,
  categories text[],
  rating int default 3,
  notes text,
  document_url text,
  document_notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  vessel_id uuid references vessels(id),
  item text,
  category text,
  priority text,
  required_by date,
  requester text,
  remarks text,
  status text default 'Pending RFQ',
  created_at timestamptz default now()
);

create table if not exists pr_line_items (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid references purchase_requests(id) on delete cascade,
  item_no int,
  description text,
  part_no text,
  qty numeric,
  unit text,
  category text,
  remarks text,
  status text default 'Open',
  created_at timestamptz default now()
);

create table if not exists rfqs (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  pr_id uuid references purchase_requests(id),
  issued_date date,
  deadline date,
  selected_quote_id uuid,
  selected_supplier text,
  status text default 'Open',
  created_at timestamptz default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid references rfqs(id) on delete cascade,
  supplier text,
  amount numeric,
  currency text default 'USD',
  delivery_time text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  pr_id uuid references purchase_requests(id),
  rfq_id uuid references rfqs(id),
  supplier text,
  amount numeric,
  currency text default 'USD',
  po_date date,
  delivery_date date,
  payment_terms text,
  incoterms text,
  attachment_path text,
  status text default 'Open',
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  po_id uuid references purchase_orders(id),
  supplier text,
  amount numeric,
  currency text default 'USD',
  invoice_date date,
  due_date date,
  status text default 'Received',
  created_at timestamptz default now()
);

create table if not exists delivery_notes (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  po_id uuid references purchase_orders(id),
  dn_date date,
  received_by text,
  status text default 'Pending',
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  username text unique,
  password_hash text,
  role text,
  status text default 'Pending',
  created_at timestamptz default now()
);

create table if not exists vessel_budgets (
  vessel_id uuid references vessels(id) on delete cascade,
  budget_month text not null,
  budget_amount numeric default 0,
  currency text default 'USD',
  primary key (vessel_id, budget_month)
);

create or replace view vessel_budget_summary as
select
  vb.vessel_id,
  v.name as vessel_name,
  vb.budget_month as month,
  vb.budget_amount,
  coalesce(sum(po.amount), 0) as actual_amount
from vessel_budgets vb
left join vessels v on v.id = vb.vessel_id
left join purchase_requests pr on pr.vessel_id = vb.vessel_id
left join purchase_orders po on po.pr_id = pr.id
group by vb.vessel_id, v.name, vb.budget_month, vb.budget_amount;
`;

(async () => {
  try {
    await client.connect();
    await client.query(sql);
    console.log('Supabase schema initialized');
  } catch (error) {
    console.error('Supabase schema init failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
