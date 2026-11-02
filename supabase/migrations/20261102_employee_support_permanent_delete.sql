-- Xoa vinh vien mot khoan ho tro va tat ca lien ket ky luong cua chinh khoan do.
-- Khong xoa ho so employees, payroll_period_employees hoac snapshot nhan su thong thuong.
-- Chi RPC nay duoc phep vuot qua cac trigger chan DELETE; khong mo quyen DELETE truc tiep.

create or replace function public.employee_support_guard_and_audit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  linked_period_status text;
begin
  if tg_op='DELETE'
     and current_setting('app.employee_support_permanent_delete', true)='on' then
    return old;
  end if;

  if tg_op='UPDATE' or tg_op='DELETE' then
    select pp.status into linked_period_status
    from public.employee_support_period_links l
    join public.payroll_periods pp on pp.id=l.period_id
    where l.support_item_id=old.id
    limit 1;

    if linked_period_status in ('CLOSED','LOCKED') then
      if tg_op='DELETE' then
        raise exception 'Khoan ho tro thuoc ky luong da khoa';
      elsif not (
        new.status='PAID' and old.status='LINKED'
        and (to_jsonb(new)-'status'-'paid_at'-'updated_at'-'updated_by') =
            (to_jsonb(old)-'status'-'paid_at'-'updated_at'-'updated_by')
      ) then
        raise exception 'Khoan ho tro thuoc ky luong da khoa, chi duoc xac nhan da thanh toan';
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
      raise exception 'Khoan ho tro da dua vao ky luong khong duoc sua noi dung/so tien';
    end if;
  end if;

  if tg_op='DELETE' then
    raise exception 'Khong xoa truc tiep khoan ho tro; su dung chuc nang xoa duoc phan quyen';
  elsif tg_op='UPDATE' then
    new.updated_at=now();
    new.updated_by=auth.uid();
    insert into public.employee_support_audit_logs(support_item_id,action,old_data,new_data,actor_id)
    values(old.id,'UPDATE',to_jsonb(old),to_jsonb(new),auth.uid());
    return new;
  else
    new.created_by=auth.uid();
    new.updated_by=auth.uid();
    insert into public.employee_support_audit_logs(support_item_id,action,new_data,actor_id)
    values(new.id,'INSERT',to_jsonb(new),auth.uid());
    return new;
  end if;
end;
$$;

create or replace function public.employee_support_guard_link()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  st text;
begin
  if tg_op='DELETE'
     and current_setting('app.employee_support_permanent_delete', true)='on' then
    return old;
  end if;
  if tg_op<>'INSERT' then
    raise exception 'Lien ket ho tro voi ky luong khong duoc sua/xoa truc tiep';
  end if;
  select status into st from public.payroll_periods where id=new.period_id;
  if st not in ('DRAFT','OPEN') then
    raise exception 'Chi duoc gan ho tro vao ky luong dang mo hoac ban nhap';
  end if;
  new.created_by=auth.uid();
  return new;
end;
$$;

create or replace function public.employee_support_delete_item(p_support_item_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item public.employee_support_items%rowtype;
  v_attachment_path text;
begin
  if auth.uid() is null or not public.payroll_can_operate() then
    raise exception 'Khong co quyen xoa khoan ho tro';
  end if;

  select * into v_item
  from public.employee_support_items
  where id=p_support_item_id
  for update;

  if not found then
    raise exception 'Khoan ho tro khong ton tai hoac da duoc xoa';
  end if;

  v_attachment_path:=v_item.attachment_path;
  perform set_config('app.employee_support_permanent_delete','on',true);

  -- Xoa tat ca lien ket cua khoan nay, ke ca lien ket thuoc ky da thanh toan/da khoa.
  delete from public.employee_support_period_links
  where support_item_id=p_support_item_id;

  -- Audit log tham chieu truc tiep item nen phai xoa trong cung transaction.
  delete from public.employee_support_audit_logs
  where support_item_id=p_support_item_id;

  delete from public.employee_support_items
  where id=p_support_item_id;

  return v_attachment_path;
end;
$$;

revoke all on function public.employee_support_delete_item(uuid) from public;
grant execute on function public.employee_support_delete_item(uuid) to authenticated;
