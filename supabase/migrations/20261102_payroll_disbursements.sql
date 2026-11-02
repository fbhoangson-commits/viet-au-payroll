-- VA Payroll: chi trả sau duyệt. Additive; does not modify payroll snapshots or calculations.
begin;
create table if not exists public.payroll_disbursement_items (
 id uuid primary key default gen_random_uuid(),
 payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
 payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
 employee_id uuid references public.employees(id) on delete set null,
 employee_code_snapshot text not null,
 employee_name_snapshot text not null,
 department_snapshot text,
 amount numeric(14,2) not null check (amount > 0),
 payment_method text not null default 'HOLD' check (payment_method in ('BANK','CASH','HOLD','BANK_EXTERNAL','OTHER')),
 bank_code_snapshot text,
 bank_name_snapshot text,
 account_number_snapshot text,
 account_holder_snapshot text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(payroll_run_id, employee_code_snapshot)
);
create index if not exists payroll_disbursement_items_run_idx on public.payroll_disbursement_items(payroll_run_id);
create index if not exists payroll_disbursement_items_method_idx on public.payroll_disbursement_items(payroll_run_id,payment_method);

create table if not exists public.payroll_disbursement_transactions (
 id uuid primary key default gen_random_uuid(),
 disbursement_item_id uuid not null references public.payroll_disbursement_items(id) on delete restrict,
 payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
 amount numeric(14,2) not null check (amount > 0),
 payment_method text not null check (payment_method in ('CASH','BANK_EXTERNAL','OTHER','BANK')),
 paid_at date not null default current_date,
 reference text,
 note text,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists payroll_disbursement_transactions_item_idx on public.payroll_disbursement_transactions(disbursement_item_id,paid_at desc);

alter table public.payroll_disbursement_items enable row level security;
alter table public.payroll_disbursement_transactions enable row level security;
drop policy if exists payroll_disbursement_items_access on public.payroll_disbursement_items;
create policy payroll_disbursement_items_access on public.payroll_disbursement_items for all to authenticated
 using (public.system_has_role('SUPER_ADMIN') or public.system_has_role('PAYROLL_ACCOUNTANT'))
 with check (public.system_has_role('SUPER_ADMIN') or public.system_has_role('PAYROLL_ACCOUNTANT'));
drop policy if exists payroll_disbursement_transactions_read on public.payroll_disbursement_transactions;
create policy payroll_disbursement_transactions_read on public.payroll_disbursement_transactions for select to authenticated
 using (public.system_has_role('SUPER_ADMIN') or public.system_has_role('PAYROLL_ACCOUNTANT'));
drop policy if exists payroll_disbursement_transactions_insert on public.payroll_disbursement_transactions;
create policy payroll_disbursement_transactions_insert on public.payroll_disbursement_transactions for insert to authenticated
 with check ((public.system_has_role('SUPER_ADMIN') or public.system_has_role('PAYROLL_ACCOUNTANT')) and recorded_by=auth.uid());
grant select,insert,update on public.payroll_disbursement_items to authenticated;
grant select,insert on public.payroll_disbursement_transactions to authenticated;

-- Atomic overpayment protection and approved-run validation. Row lock serializes concurrent payment attempts.
create or replace function public.payroll_validate_disbursement_transaction()
returns trigger language plpgsql security invoker set search_path=public,auth as $$
declare v_item public.payroll_disbursement_items%rowtype; v_status text; v_paid numeric(14,2);
begin
 select * into v_item from public.payroll_disbursement_items where id=new.disbursement_item_id for update;
 if not found then raise exception 'Không tìm thấy khoản chi trả.'; end if;
 if v_item.payroll_run_id <> new.payroll_run_id then raise exception 'Phiên bản lương không khớp khoản chi trả.'; end if;
 select status into v_status from public.payroll_runs where id=v_item.payroll_run_id;
 if upper(coalesce(v_status,'')) not in ('APPROVED','LOCKED') then raise exception 'Chỉ được chi trả phiên bản lương đã duyệt hoặc khóa.'; end if;
 select coalesce(sum(amount),0) into v_paid from public.payroll_disbursement_transactions where disbursement_item_id=new.disbursement_item_id;
 if v_paid + new.amount > v_item.amount then raise exception 'Số tiền ghi nhận vượt quá số Thực lĩnh còn phải trả.'; end if;
 if new.recorded_by is distinct from auth.uid() then raise exception 'Người ghi nhận không khớp tài khoản đăng nhập.'; end if;
 return new;
end $$;
drop trigger if exists payroll_validate_disbursement_transaction_trigger on public.payroll_disbursement_transactions;
create trigger payroll_validate_disbursement_transaction_trigger before insert on public.payroll_disbursement_transactions
for each row execute function public.payroll_validate_disbursement_transaction();

-- Protect approved net-pay snapshot values from edits through the payout screen.
create or replace function public.payroll_guard_disbursement_item_update()
returns trigger language plpgsql as $$
begin
 if new.amount is distinct from old.amount or new.employee_code_snapshot is distinct from old.employee_code_snapshot
  or new.employee_name_snapshot is distinct from old.employee_name_snapshot or new.payroll_run_id is distinct from old.payroll_run_id
  or new.payroll_period_id is distinct from old.payroll_period_id then
  raise exception 'Không được sửa dữ liệu snapshot hoặc số Thực lĩnh đã duyệt.';
 end if;
 return new;
end $$;
drop trigger if exists payroll_guard_disbursement_item_update_trigger on public.payroll_disbursement_items;
create trigger payroll_guard_disbursement_item_update_trigger before update on public.payroll_disbursement_items
for each row execute function public.payroll_guard_disbursement_item_update();
revoke all on function public.payroll_validate_disbursement_transaction() from public;
revoke all on function public.payroll_guard_disbursement_item_update() from public;
comment on table public.payroll_disbursement_items is 'Danh sách chi trả được tạo từ snapshot của payroll_run đã duyệt; amount là Thực lĩnh bất biến.';
comment on table public.payroll_disbursement_transactions is 'Lịch sử thanh toán; hỗ trợ nhiều lần trả một phần và chặn tổng thanh toán vượt Thực lĩnh.';
commit;
