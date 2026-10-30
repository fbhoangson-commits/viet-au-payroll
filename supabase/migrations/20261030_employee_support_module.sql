-- Hỗ trợ nhân sự: additive module, độc lập với payroll_adjustments và Employee Master.
create table if not exists public.employee_support_items (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null check (recipient_type in ('CURRENT','FORMER','INTERN','TRAINEE','OTHER')),
  employee_id uuid null references public.employees(id) on delete restrict,
  employee_code text null,
  recipient_name text not null,
  description text not null,
  support_type text null,
  support_month text not null,
  amount bigint not null check (amount > 0),
  apply_tax_10 boolean not null default false,
  tax_rate numeric(6,5) not null default 0.10,
  tax_threshold bigint not null default 5000000,
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  net_amount bigint not null,
  payment_date date null,
  attachment_path text null,
  notes text null,
  status text not null default 'DRAFT' check (status in ('DRAFT','PENDING','APPROVED','LINKED','PAID','CANCELLED')),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_support_current_requires_employee check (recipient_type <> 'CURRENT' or employee_id is not null)
);

create table if not exists public.employee_support_period_links (
  id uuid primary key default gen_random_uuid(),
  support_item_id uuid not null unique references public.employee_support_items(id) on delete restrict,
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid null references public.employees(id) on delete restrict,
  employee_code_snapshot text null,
  recipient_name_snapshot text not null,
  description_snapshot text not null,
  amount_snapshot bigint not null check (amount_snapshot > 0),
  tax_amount_snapshot bigint not null default 0,
  net_amount_snapshot bigint not null,
  recipient_type_snapshot text not null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_employee_support_period_links_period on public.employee_support_period_links(period_id);
create index if not exists idx_employee_support_items_employee on public.employee_support_items(employee_id);
create index if not exists idx_employee_support_items_month on public.employee_support_items(support_month);


create table if not exists public.employee_support_tax_settings (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'default',
  tax_rate numeric(6,5) not null default 0.10 check (tax_rate > 0 and tax_rate <= 1),
  tax_threshold bigint not null default 5000000 check (tax_threshold >= 0),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.employee_support_tax_settings(config_key,tax_rate,tax_threshold)
values('default',0.10,5000000) on conflict(config_key) do nothing;
alter table public.employee_support_tax_settings enable row level security;
drop policy if exists employee_support_tax_settings_operator_all on public.employee_support_tax_settings;
create policy employee_support_tax_settings_operator_all on public.employee_support_tax_settings
 for all to authenticated using (public.payroll_can_operate()) with check (public.payroll_can_operate());
grant select,insert,update on public.employee_support_tax_settings to authenticated;

create table if not exists public.employee_support_audit_logs (
  id uuid primary key default gen_random_uuid(),
  support_item_id uuid not null references public.employee_support_items(id) on delete restrict deferrable initially deferred,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.employee_support_items enable row level security;
alter table public.employee_support_period_links enable row level security;
alter table public.employee_support_audit_logs enable row level security;

drop policy if exists employee_support_items_authenticated_all on public.employee_support_items;
create policy employee_support_items_authenticated_all on public.employee_support_items
 for all to authenticated using (public.payroll_can_operate()) with check (public.payroll_can_operate());
drop policy if exists employee_support_period_links_authenticated_all on public.employee_support_period_links;
create policy employee_support_period_links_authenticated_all on public.employee_support_period_links
 for all to authenticated using (public.payroll_can_operate()) with check (public.payroll_can_operate());
drop policy if exists employee_support_audit_logs_authenticated_read on public.employee_support_audit_logs;
create policy employee_support_audit_logs_authenticated_read on public.employee_support_audit_logs
 for select to authenticated using (public.payroll_can_operate());

grant select,insert,update,delete on public.employee_support_items to authenticated;
grant select,insert,update,delete on public.employee_support_period_links to authenticated;
grant select on public.employee_support_audit_logs to authenticated;

create or replace function public.employee_support_guard_and_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  linked_period_status text;
begin
  if tg_op='UPDATE' or tg_op='DELETE' then
    select pp.status into linked_period_status
    from public.employee_support_period_links l
    join public.payroll_periods pp on pp.id=l.period_id
    where l.support_item_id=old.id
    limit 1;
    if linked_period_status in ('CLOSED','LOCKED') then
      if tg_op='DELETE' then
        raise exception 'Khoản hỗ trợ thuộc kỳ lương đã khóa, không được xóa';
      elsif not (
        new.status='PAID' and old.status='LINKED'
        and (to_jsonb(new)-'status'-'paid_at'-'updated_at'-'updated_by') =
            (to_jsonb(old)-'status'-'paid_at'-'updated_at'-'updated_by')
      ) then
        raise exception 'Khoản hỗ trợ thuộc kỳ lương đã khóa, chỉ được xác nhận đã thanh toán';
      end if;
    end if;
    if exists(select 1 from public.employee_support_period_links where support_item_id=old.id)
       and tg_op='UPDATE'
       and (new.amount is distinct from old.amount
         or new.tax_amount is distinct from old.tax_amount
         or new.net_amount is distinct from old.net_amount
         or new.employee_id is distinct from old.employee_id
         or new.recipient_name is distinct from old.recipient_name
         or new.description is distinct from old.description) then
      raise exception 'Khoản hỗ trợ đã đưa vào kỳ lương không được sửa nội dung/số tiền';
    end if;
  end if;
  if tg_op='DELETE' then
    raise exception 'Không xóa vật lý khoản hỗ trợ; hãy chuyển trạng thái Đã hủy';

  elsif tg_op='UPDATE' then
    new.updated_at=now();
    new.updated_by=auth.uid();
    insert into public.employee_support_audit_logs(support_item_id,action,old_data,new_data,actor_id)
    values(old.id,'UPDATE',to_jsonb(old),to_jsonb(new),auth.uid());
    return new;
  else
    new.created_by=auth.uid(); new.updated_by=auth.uid();
    insert into public.employee_support_audit_logs(support_item_id,action,new_data,actor_id)
    values(new.id,'INSERT',to_jsonb(new),auth.uid());
    return new;
  end if;
end $$;

drop trigger if exists trg_employee_support_guard_audit on public.employee_support_items;
create trigger trg_employee_support_guard_audit
before insert or update or delete on public.employee_support_items
for each row execute function public.employee_support_guard_and_audit();

create or replace function public.employee_support_guard_link()
returns trigger language plpgsql security definer set search_path=public as $$
declare st text;
begin
 if tg_op<>'INSERT' then
   raise exception 'Liên kết hỗ trợ với kỳ lương không được sửa/xóa trực tiếp';
 end if;
 select status into st from public.payroll_periods where id=new.period_id;
 if st not in ('DRAFT','OPEN') then raise exception 'Chỉ được gắn hỗ trợ vào kỳ lương đang mở hoặc bản nháp'; end if;
 new.created_by=auth.uid();
 return new;
end $$;
drop trigger if exists trg_employee_support_link_guard on public.employee_support_period_links;
create trigger trg_employee_support_link_guard
before insert or update or delete on public.employee_support_period_links
for each row execute function public.employee_support_guard_link();

-- Private attachment bucket for supporting documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('employee-support-attachments','employee-support-attachments',false,10485760,
       array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists employee_support_files_operator_all on storage.objects;
create policy employee_support_files_operator_all on storage.objects
 for all to authenticated
 using (bucket_id='employee-support-attachments' and public.payroll_can_operate())
 with check (bucket_id='employee-support-attachments' and public.payroll_can_operate());


-- Atomic linking: the uniqueness constraint and row locks prevent double assignment.
create or replace function public.employee_support_link_to_period(
  p_support_item_ids uuid[],
  p_period_id uuid
) returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid;
  v_item public.employee_support_items%rowtype;
  v_period_status text;
  v_count integer := 0;
begin
  if not public.payroll_can_operate() then
    raise exception 'Không có quyền đưa khoản hỗ trợ vào kỳ lương';
  end if;
  select status into v_period_status
  from public.payroll_periods where id=p_period_id for update;
  if v_period_status not in ('DRAFT','OPEN') then
    raise exception 'Chỉ được đưa hỗ trợ vào kỳ lương đang mở hoặc bản nháp';
  end if;
  if coalesce(array_length(p_support_item_ids,1),0)=0 then
    raise exception 'Chưa chọn khoản hỗ trợ';
  end if;
  foreach v_id in array p_support_item_ids loop
    select * into v_item from public.employee_support_items where id=v_id for update;
    if not found then raise exception 'Không tìm thấy khoản hỗ trợ %',v_id; end if;
    if v_item.status <> 'APPROVED' then
      raise exception 'Khoản hỗ trợ % chưa được duyệt hoặc không còn hợp lệ',v_id;
    end if;
    if exists(select 1 from public.employee_support_period_links where support_item_id=v_id) then
      raise exception 'Khoản hỗ trợ % đã được đưa vào kỳ lương',v_id;
    end if;
    insert into public.employee_support_period_links(
      support_item_id,period_id,employee_id,employee_code_snapshot,
      recipient_name_snapshot,description_snapshot,amount_snapshot,
      tax_amount_snapshot,net_amount_snapshot,recipient_type_snapshot
    ) values(
      v_item.id,p_period_id,v_item.employee_id,v_item.employee_code,
      v_item.recipient_name,v_item.description,v_item.amount,
      v_item.tax_amount,v_item.net_amount,v_item.recipient_type
    );
    update public.employee_support_items set status='LINKED',updated_at=now()
    where id=v_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
grant execute on function public.employee_support_link_to_period(uuid[],uuid) to authenticated;
