import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import { RefreshCw, Search, Download, AlertTriangle, Users, Wallet, Calculator, ShieldCheck, FileSpreadsheet, CircleDollarSign } from 'lucide-react';
import './payroll-calculation.css';

const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const num = value => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\s/g, '');
  if (!s) return 0;
  const normalized = s.includes(',') && s.includes('.') ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')) : s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const clean = v => String(v ?? '').trim();
const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLocaleLowerCase('vi');
const rateKey = v => norm(v).replace(/[^a-z0-9]/g, '');
const codeOf = e => clean(e?.employee_code || e?.employee_code_snapshot || e?.code || '');
const nameOf = e => clean(e?.employee_name_snapshot || e?.employee_name || e?.full_name || e?.name || codeOf(e) || 'Chưa có tên');
const periodTitle = p => clean(p?.name || p?.period_code || p?.code || `Kỳ ${p?.period_year || ''}-${String(p?.period_month || '').padStart(2,'0')}`);
const statusTitle = s => ({DRAFT:'Bản nháp',OPEN:'Đang mở',CLOSED:'Đã đóng',LOCKED:'Đã khóa',PENDING:'Chờ xử lý',APPROVED:'Đã duyệt'}[String(s||'').toUpperCase()] || s || 'Chưa xác định');
const errorText = e => e?.message || e?.details || String(e || 'Lỗi không xác định');
const MENU = {
  'payroll-overview': { title:'Tổng Quan Kỳ Lương', description:'Tổng hợp tiến độ xử lý và kết quả của kỳ lương đang chọn.', icon:Calculator },
  'period-employees': { title:'Nhân Sự Kỳ Lương', description:'Danh sách nhân sự đã được chốt vào kỳ lương và trạng thái dữ liệu.', icon:Users },
  'fixed-salary': { title:'Lương Cố Định', description:'Tổng hợp các cấu phần lương cố định từ định mức và phiên bản chính sách áp dụng.', icon:Wallet },
  'teaching-pay': { title:'Lương Tiết Dạy & Phụ Đạo', description:'Tổng hợp số tiết, đơn giá và thành tiền từ dữ liệu Chấm Công Tiết Dạy.', icon:FileSpreadsheet },
  'payroll-deductions': { title:'Khoản Cộng Trừ', description:'Tổng hợp khoản cộng, khoản trừ được áp dụng trong kỳ lương.', icon:CircleDollarSign },
  'insurance-union': { title:'Bảo Hiểm & Phí Công Đoàn', description:'Đối chiếu phần người lao động đóng và phần đơn vị đóng.', icon:ShieldCheck },
  'personal-income-tax': { title:'Thuế TNCN', description:'Tổng hợp căn cứ và kết quả thuế từ dữ liệu thuế đã cấu hình cho kỳ.', icon:Calculator },
  'payroll-summary': { title:'Tổng Hợp Lương', description:'Bảng tổng hợp kết quả lương theo từng nhân sự trong kỳ.', icon:FileSpreadsheet },
};
const moneyColumns = new Set(['fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','tax','taxAmount','gross','net','employerInsurance','difference']);
const colLabel = {
 code:'Mã Nhân Viên', name:'Họ và Tên', classification:'Phân loại', department:'Bộ phận', position:'Chức danh',
 fixed:'Lương Cố Định', teaching:'Thành Tiền Tiết Dạy', additions:'Khoản Cộng', deductions:'Khoản Trừ',
 insuranceEmployee:'BHXH NLĐ', unionEmployee:'Phí Công Đoàn NLĐ', employerInsurance:'BHXH đơn vị',
 tax:'Thu Nhập Chịu Thuế', taxable:'Thu Nhập Chịu Thuế', taxAmount:'Thuế TNCN', gross:'Tổng Thu Nhập', net:'Thực Lĩnh', status:'Trạng Thái Dữ Liệu',
 lessonCount:'Tổng Số Tiết', rateCount:'Số Cấu Phần Có Đơn Giá', taxable:'Thu Nhập Chịu Thuế',
 additionCount:'Số Khoản Cộng', additions:'Tiền Cộng', deductionCount:'Số Khoản Trừ', deductions:'Tiền Trừ', difference:'Chênh Lệch',
 participates:'Tham Gia BHXH', taxStatus:'Trạng Thái Thuế', taxMethod:'Phương Pháp Tính Thuế'
};
async function fetchRows(table, label, warnings, required=false) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    if (required) throw new Error(`${label}: ${errorText(error)}`);
    warnings.push(`${label}: chưa đọc được (${errorText(error)})`);
    return [];
  }
  return data || [];
}
function tax5(value) {
  const x=Math.max(0,num(value));
  if(x<=10000000)return Math.round(x*.05);
  if(x<=30000000)return Math.round(x*.10-500000);
  if(x<=60000000)return Math.round(x*.20-3500000);
  if(x<=100000000)return Math.round(x*.30-9500000);
  return Math.round(x*.35-14500000);
}
function estimateTax(row, taxableValue) {
  // Keep the same rule as /insurance-tax-data: validated commitment => 0;
  // otherwise calculate from the current taxable income and employee type.
  if (row?.has_commitment && row?.commitment_validated) return 0;
  const rawOverride = row?.taxable_income_override;
  const taxable = Math.max(0, num(rawOverride !== '' && rawOverride !== null && rawOverride !== undefined
    ? rawOverride
    : taxableValue ?? row?.calculated_taxable_income ?? row?.taxable_income));
  const type = norm(row?.employee_type || row?.employee_classification);
  return type.includes('co huu') ? tax5(taxable) : taxable >= 5000000 ? Math.round(taxable * .1) : 0;
}
function firstDefined(row, keys) {
  for (const key of keys) if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  return undefined;
}
function rowPeriodId(r) { return clean(r?.period_id); }
function employeeId(r) { return clean(r?.employee_id); }
function isActiveAdjustment(r) { return !['CANCELLED','CANCELED','INACTIVE','ĐÃ HỦY','DA HUY'].includes(String(r?.status||'').toUpperCase()); }
function firstText(...values) { return values.find(v => v !== null && v !== undefined && String(v).trim() !== '') ?? ''; }
function fieldFromObject(obj, candidates) {
  if (!obj || typeof obj !== 'object') return '';
  const wanted = new Set(candidates.map(norm));
  for (const [key,value] of Object.entries(obj)) if (wanted.has(norm(key)) && value !== null && value !== undefined && String(value).trim() !== '') return value;
  return '';
}
function classificationOf(...objects) {
  const candidates = ['Phân loại','phan loai','employment_type','employee_type','employee_classification','classification','loai nhan su','loại nhân sự','contract_type','nhom nhan su'];
  for (const obj of objects) {
    const direct = fieldFromObject(obj,candidates); if (direct) return clean(direct);
    const nested = fieldFromObject(obj?.custom_fields,candidates) || fieldFromObject(obj?.metadata,candidates); if (nested) return clean(nested);
  }
  return '';
}
function taxMethodFor(classification) { return norm(classification).includes('co huu') ? 'Lũy tiến từng phần' : classification ? 'Khấu trừ 10% (cần đối chiếu điều kiện)' : 'Chưa xác định phân loại'; }
function statusForPage(row,page) {
  if (page === 'period-employees') return row.hasMasterProfile ? 'Đã liên kết hồ sơ nhân sự' : 'Chưa liên kết hồ sơ nhân sự';
  if (page === 'fixed-salary') return !row.hasRateData ? 'Chưa có định mức' : row.fixedComponentCount < 4 ? `Có ${row.fixedComponentCount}/4 cấu phần; cần kiểm tra` : 'Đủ 4 cấu phần lương';
  if (page === 'teaching-pay') return row.teachingStatus;
  if (page === 'payroll-deductions') return row.adjustmentCount ? 'Đã đọc khoản cộng/trừ' : 'Chưa phát sinh khoản cộng/trừ';
  if (page === 'insurance-union') return !row.hasTaxData && !row.hasInsuranceProfile && !row.hasUnionProfile ? 'Chưa có dữ liệu bảo hiểm/Công đoàn' : 'Đã đọc dữ liệu bảo hiểm/Công đoàn';
  if (page === 'personal-income-tax') return !row.classification ? 'Chưa cập nhật phân loại' : row.taxable > 0 || row.taxAmount > 0 ? 'Đã có căn cứ tính thuế' : 'Chưa có căn cứ tính thuế';
  return row.status;
}

export default function PayrollCalculationPage({ page }) {
  const meta = MENU[page] || MENU['payroll-overview'];
  const Icon = meta.icon;
  const [periods,setPeriods] = useState([]);
  const [periodId,setPeriodId] = useState('');
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState('');
  const [warnings,setWarnings] = useState([]);
  const [search,setSearch] = useState('');
  const [typeFilter,setTypeFilter] = useState('ALL');
  const [dataLoaded,setDataLoaded] = useState(false);

  const load = useCallback(async (keepPeriod=true) => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase chưa được cấu hình. Không thể tải dữ liệu kỳ lương thật.');
      setLoading(false); setRefreshing(false); return;
    }
    setRefreshing(true); setError('');
    const notes=[];
    try {
      const {data: periodRows,error: periodError}=await supabase.from('payroll_periods').select('*').order('period_year',{ascending:false,nullsFirst:false}).order('period_month',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false});
      if(periodError) throw new Error(`Không tải được Kỳ Lương: ${errorText(periodError)}`);
      const fixedPeriods=(periodRows||[]).filter(p=>String(p.type||'FIXED').toUpperCase()==='FIXED');
      setPeriods(fixedPeriods);
      const selectedId=(keepPeriod && periodId && fixedPeriods.some(p=>p.id===periodId)) ? periodId : (fixedPeriods[0]?.id || '');
      setPeriodId(selectedId);
      if(!selectedId){setRows([]);setWarnings(['Chưa có Kỳ Lương tháng (FIXED). Hãy tạo Kỳ Lương trong menu Quản lý Kỳ Lương.']);setDataLoaded(true);return;}
      const [snapshotA,snapshotB,employees,groups,columns,rateValues,teachingRecords,adjustments,taxRows,insuranceProfiles,dependents,supportRows,attendanceRecords,unionProfiles,taxConfigs,commitments,policyVersions] = await Promise.all([
        fetchRows('payroll_period_employees','Danh sách nhân sự kỳ',notes),
        fetchRows('payroll_period_employee_snapshots','Snapshot nhân sự kỳ',notes),
        fetchRows('employees','Employee Master',notes,true),
        fetchRows('salary_rate_groups','Nhóm định mức',notes),
        fetchRows('salary_rate_columns','Cột định mức',notes),
        fetchRows('salary_rate_values','Giá trị định mức',notes),
        fetchRows('teaching_attendance_records','Chấm Công Tiết Dạy',notes),
        fetchRows('payroll_adjustments','Khoản cộng trừ',notes),
        fetchRows('payroll_period_insurance_tax_data','Dữ liệu BHXH/thuế kỳ',notes),
        fetchRows('employee_insurance_profiles','Hồ sơ BHXH',notes),
        fetchRows('employee_tax_dependents','Người phụ thuộc',notes),
        fetchRows('employee_support_allowances','Hỗ trợ nhân sự',notes),
        fetchRows('daily_attendance_records','Chấm công ngày',notes),
        fetchRows('employee_union_profiles','Hồ sơ Công đoàn',notes),
        fetchRows('payroll_tax_relief_config','Cấu hình giảm trừ thuế',notes),
        fetchRows('employee_income_commitments','Cam kết thu nhập',notes),
        fetchRows('salary_policy_versions','Phiên bản chính sách lương',notes),
      ]);
      const snapshotsRaw=snapshotA.filter(r=>rowPeriodId(r)===selectedId);
      const snapshots=snapshotsRaw.length ? snapshotsRaw : snapshotB.filter(r=>rowPeriodId(r)===selectedId);
      const masterById=new Map(employees.map(e=>[clean(e.id),e]));
      const groupsById=new Map(groups.map(g=>[clean(g.id),g]));
      const selectedPeriod=fixedPeriods.find(p=>p.id===selectedId)||{};
      const activePolicy=(policyVersions||[]).find(p=>p.id===(selectedPeriod.salary_version_id||selectedPeriod.salary_policy_version_id))||(policyVersions||[]).find(p=>String(p.status||'').toUpperCase()==='ACTIVE')||(policyVersions||[])[0];
      const columnsById=new Map(columns.map(c=>[clean(c.id),c]));
      const valuesByEmployee=new Map();
      // Prefer the period's policy, but retain a fallback to the employee's saved rate rows when the policy link is absent/mismatched.
      const policyRateValues=rateValues.filter(v=>!activePolicy?.id || v.policy_version_id===activePolicy.id);
      for(const r of policyRateValues) {
        const key=employeeId(r); if(!valuesByEmployee.has(key)) valuesByEmployee.set(key,[]);
        valuesByEmployee.get(key).push(r);
      }
      const selectedRateColumns=columns.filter(c=>c.is_active!==false);
      const rateGroupName = c => { const g=groupsById.get(clean(c.group_id)); return norm(`${g?.code || ''} ${g?.name || ''}`); };
      const isFixedGroup = c => { const n=rateGroupName(c); return n.includes('fixed') || n.includes('co dinh'); };
      const isTeachingColumn = c => { const n=rateGroupName(c); return n.includes('tiet day') || n.includes('phu dao') || n.includes('khac') || n.includes('other') || n.includes('teaching') || n.includes('tutoring'); };
      const fixedColumns = selectedRateColumns.filter(isFixedGroup).slice(0,4);
      const teachingColumns = selectedRateColumns.filter(isTeachingColumn);
      const dynamicLabels = Object.fromEntries([...fixedColumns.map(c=>[`fixedCol_${c.id}`,clean(c.name||c.label||c.code||'Cấu phần lương')]),...teachingColumns.map(c=>[`lesson_${c.id}`,clean(c.name||c.label||c.code||'Cột tiết')])]);
      const periodTeaching=teachingRecords.filter(r=>rowPeriodId(r)===selectedId);
      const periodAdjustments=adjustments.filter(r=>String(r.status||'ACTIVE').toUpperCase()==='ACTIVE');
      const periodMonth=String(selectedPeriod.month||selectedPeriod.start_date||`${selectedPeriod.period_year||''}-${String(selectedPeriod.period_month||'').padStart(2,'0')}`).slice(0,7);
      const appliesAdjustment=r=>{const app=String(r.application_type||'PER_PERIOD').toUpperCase();if(app==='PER_PERIOD')return rowPeriodId(r)===selectedId;if(app==='FIXED'){const from=String(r.effective_from||'').slice(0,7),to=String(r.effective_to||'').slice(0,7);return Boolean(periodMonth&&from&&from<=periodMonth&&(!to||to>=periodMonth));}return false;};
      const periodTax=taxRows.filter(r=>rowPeriodId(r)===selectedId);
      const taxByEmployee=new Map();
      for (const r of periodTax) {
        const idKey=employeeId(r), codeKey=clean(r.employee_code || r.employee_code_snapshot);
        if (idKey) taxByEmployee.set(`id:${idKey}`,r);
        if (codeKey) taxByEmployee.set(`code:${codeKey}`,r);
      }
      const insuranceByEmployee=new Map();
      for(const r of insuranceProfiles) insuranceByEmployee.set(employeeId(r),r);
      const unionByEmployee=new Map();
      const unionByCode=new Map();
      for(const r of unionProfiles){ if(employeeId(r)) unionByEmployee.set(employeeId(r),r); const c=clean(r.employee_code||r.employee_code_snapshot); if(c) unionByCode.set(c,r); }
      const insuranceByCode=new Map();
      for(const r of insuranceProfiles){const c=clean(r.employee_code||r.employee_code_snapshot);if(c)insuranceByCode.set(c,r);}
      // Keep dependent-count precedence identical to insurance-tax-data/Page.jsx.
      // Employee Master custom_fields must be checked too; otherwise taxable income can differ by one or more dependent deductions.
      const masterDependentCountFor=employee=>{
        const all={...(employee||{}),...(employee?.custom_fields&&typeof employee.custom_fields==='object'?employee.custom_fields:{})};
        for(const [key,value] of Object.entries(all)){
          if(['dependents_count','dependent_count','người phụ thuộc','số người phụ thuộc','nguoi phu thuoc','so nguoi phu thuoc'].some(k=>norm(k)===norm(key))&&value!==null&&value!==undefined&&String(value).trim()!==''){
            const n=num(value);if(Number.isFinite(n)&&n>=0)return Math.floor(n);
          }
        }
        return null;
      };
      const dependentCountFor=(id,code,master,snapshot)=>{
        const fromMaster=masterDependentCountFor(master);
        const fromSnapshot=masterDependentCountFor(snapshot);
        const explicit=firstDefined(taxByEmployee.get(`id:${id}`)||taxByEmployee.get(`code:${code}`)||{},['dependent_count']);
        if(fromMaster!==null)return fromMaster;if(fromSnapshot!==null)return fromSnapshot;if(explicit!==undefined)return Math.max(0,num(explicit));
        return dependents.filter(d=>(employeeId(d)===id||clean(d.employee_code||d.employee_code_snapshot)===code)&&d.is_active!==false&&!['INACTIVE','CANCELLED','NGỪNG GIẢM TRỪ','NGUNG GIAM TRU'].includes(norm(d.status).toUpperCase())).length;
      };
      const defaultTaxConfig=taxConfigs.find(c=>clean(c.config_key)==='default')||taxConfigs[0]||{};
      const supportFor=(id,code)=>supportRows.filter(r=>(employeeId(r)===id || clean(r.employee_code||r.employee_code_snapshot)===code) && (!r.period_id || rowPeriodId(r)===selectedId) && !['CANCELLED','INACTIVE'].includes(String(r.status||'').toUpperCase())).reduce((sum,r)=>sum+num(r.amount??r.support_amount??Object.values(r.amounts||{}).reduce((a,v)=>a+num(v),0)),0);
      const output=snapshots.map(s=>{
        const id=employeeId(s), code=clean(s.employee_code||s.employee_code_snapshot), master=masterById.get(id)||{};
        const rateRows=valuesByEmployee.get(id)||[];
        let fixed=0,rateCount=0;
        const fixedParts=Object.fromEntries(fixedColumns.map(c=>[`fixedCol_${c.id}`,0]));
        for(const rv of rateRows){
          const group=groupsById.get(clean(rv.group_id));
          const groupName=norm(`${group?.code||''} ${group?.name||''}`);
          if(groupName.includes('tiet day')||groupName.includes('phu dao')||groupName.includes('khac')||groupName.includes('other')||groupName.includes('teaching')||groupName.includes('tutoring')) continue;
          const vals=rv.values && typeof rv.values==='object' ? rv.values : {};
          for(const c of fixedColumns.filter(c=>clean(c.group_id)===clean(rv.group_id))){
            if(vals[c.id]!==undefined && vals[c.id]!==null && vals[c.id]!==''){fixedParts[`fixedCol_${c.id}`]=num(vals[c.id]);fixed+=num(vals[c.id]);rateCount++;}
          }
        }
        const lessons=periodTeaching.filter(r=>employeeId(r)===id || codeOf(r).toLocaleUpperCase('vi')===code.toLocaleUpperCase('vi'));
        let teaching=0, lessonCount=0, missingRates=0;
        const lessonParts=Object.fromEntries(teachingColumns.map(c=>[`lesson_${c.id}`,0]));
        for(const rec of lessons){
          const col=columnsById.get(clean(rec.salary_rate_column_id));
          if(!col) continue;
          lessonCount+=num(rec.lesson_count);
          if(Object.prototype.hasOwnProperty.call(lessonParts,`lesson_${col.id}`)) lessonParts[`lesson_${col.id}`]+=num(rec.lesson_count);
          // Resolve IELTS and other teaching rates from the exact employee + group + column.
          // Do not rely only on the selected policy map: existing rate rows may be saved under a
          // different/missing policy_version_id while still being the employee's configured rate.
          const recordEmployeeId=employeeId(rec);
          const recordEmployeeCode=codeOf(rec).toLocaleUpperCase('vi');
          const rateRowsForEmployee=rateValues.filter(v =>
            (recordEmployeeId && employeeId(v)===recordEmployeeId) ||
            (recordEmployeeCode && codeOf(v).toLocaleUpperCase('vi')===recordEmployeeCode)
          );
          // Resolve the rate per COLUMN, not by choosing one row for the whole group.
          // A group can have multiple saved rows across policy versions; each row may
          // contain only some of the group's column values. Prefer the period policy,
          // then fall back per column without letting an incomplete row hide other rates.
          const preferredRows=[
            ...rateRowsForEmployee.filter(v=>activePolicy?.id && clean(v.policy_version_id)===clean(activePolicy.id)),
            ...rateRowsForEmployee.filter(v=>!activePolicy?.id || clean(v.policy_version_id)!==clean(activePolicy.id)),
            ...rateRows.filter(v=>!rateRowsForEmployee.includes(v)),
          ].filter(v=>clean(v.group_id)===clean(col.group_id));
          const rateKeys=[col.id,col.code,col.name,col.label].filter(v=>v!==undefined&&v!==null&&clean(v)!=='').map(clean);
          let rate;
          for(const candidate of preferredRows){
            const values=candidate?.values && typeof candidate.values==='object' ? candidate.values : {};
            for(const key of rateKeys){if(Object.prototype.hasOwnProperty.call(values,key)&&values[key]!==undefined&&values[key]!==null&&values[key]!==''){rate=values[key];break;}}
            if(rate===undefined){
              const wanted=new Set(rateKeys.map(rateKey));
              const matchedKey=Object.keys(values).find(key=>wanted.has(rateKey(key))&&values[key]!==undefined&&values[key]!==null&&values[key]!=='');
              if(matchedKey!==undefined) rate=values[matchedKey];
            }
            if(rate!==undefined) break;
          }
          if(rate===undefined||rate===null||rate==='') missingRates++;
          else teaching+=num(rec.lesson_count)*num(rate);
        }
        const employeeAdjustments=periodAdjustments.filter(r=>(employeeId(r)===id || clean(r.employee_code||r.employee_code_snapshot)===code) && appliesAdjustment(r));
        const addRows=employeeAdjustments.filter(r=>String(r.kind||'').toUpperCase()==='ADD');
        const deductRows=employeeAdjustments.filter(r=>String(r.kind||'').toUpperCase()==='DEDUCT');
        const additions=addRows.reduce((sum,r)=>sum+num(r.amount),0);
        const deductions=deductRows.reduce((sum,r)=>sum+num(r.amount),0);
        const tax=taxByEmployee.get(`id:${id}`)||taxByEmployee.get(`code:${code}`)||{};
        const hasTaxData=Boolean(tax.id || tax.employee_id || tax.employee_code || tax.employee_code_snapshot);
        const hasMasterProfile=Boolean(master.id);
        const insurance=insuranceByEmployee.get(id)||insuranceByCode.get(code)||{};
        const insuranceRate=num(tax.employee_social_rate ?? insurance.employee_social_rate ?? 8)+num(tax.employee_health_rate ?? insurance.employee_health_rate ?? 1.5)+num(tax.employee_unemployment_rate ?? insurance.employee_unemployment_rate ?? 1);
        const insuranceEmployee=num(tax.employee_insurance_amount ?? tax.insurance_employee_amount ?? ((tax.participates_insurance ?? insurance.participates_insurance)===true ? num(tax.insurance_salary_base ?? insurance.insurance_salary_base)*insuranceRate/100 : 0));
        const employerInsurance=num(tax.employer_insurance_amount ?? tax.insurance_employer_amount ?? 0);
        const union=unionByEmployee.get(id)||unionByCode.get(code)||{};
        const unionEmployee=num(tax.union_employee_amount ?? tax.union_fee_employee_amount ?? union.employee_contribution ?? union.union_employee_amount ?? union.employee_fee ?? 0);
        const classification=classificationOf(master,s,tax);
        const employeeType=firstText(classification,master.employee_type,master.employee_classification,s.employee_type,s.employee_classification,tax.employee_type,tax.employee_classification);
        const gross=fixed+teaching+additions;
        const dependentCount=dependentCountFor(id,code,master,s);
        const supportAmount=num(tax.support_amount ?? supportFor(id,code));
        const reliefPersonal=num(tax.personal_relief_amount ?? defaultTaxConfig.personal_relief_amount ?? 15500000);
        const reliefDependent=num(tax.dependent_relief_amount ?? defaultTaxConfig.dependent_relief_amount ?? 6200000);
        const override=tax.taxable_income_override;
        const isPermanent=norm(employeeType).includes('co huu');
        // Match insurance-tax-data/Page.jsx: use the current period's computed income, relief, support and employee insurance.
        // A manual override is the only persisted taxable-income value that supersedes the source calculation.
        const taxInsuranceRate=num(tax.employee_social_rate ?? insurance.employee_social_rate ?? 8)+num(tax.employee_health_rate ?? insurance.employee_health_rate ?? 1.5)+num(tax.employee_unemployment_rate ?? insurance.employee_unemployment_rate ?? 1);
        const taxInsuranceAmount=(tax.participates_insurance ?? insurance.participates_insurance)===true ? num(tax.insurance_salary_base ?? insurance.insurance_salary_base)*taxInsuranceRate/100 : 0;
        const calculatedTaxable=isPermanent ? Math.max(0,gross-deductions-supportAmount-reliefPersonal-dependentCount*reliefDependent-taxInsuranceAmount) : Math.max(0,fixed+teaching+additions);
        const taxable=Math.max(0,num(override!==''&&override!==null&&override!==undefined?override:calculatedTaxable));
        const commitment=commitments.find(c=>(employeeId(c)===id||clean(c.employee_code||c.employee_code_snapshot)===code)&&(!c.period_id||rowPeriodId(c)===selectedId)&&c.has_commitment!==false) || {};
        const taxAmount=estimateTax({...commitment,...tax,has_commitment:tax.has_commitment??commitment.has_commitment??false,commitment_validated:tax.commitment_validated??false,employee_type:employeeType},taxable);
        const net=gross-deductions-insuranceEmployee-unionEmployee-taxAmount;
        const status=[];
        if(!rateRows.length) status.push('Chưa có dữ liệu định mức');
        if(lessons.some(r=>!columnsById.get(clean(r.salary_rate_column_id)))) status.push('Có tiết chưa khớp cấu hình');
        if(missingRates) status.push('Thiếu đơn giá tiết dạy');
        if(!hasTaxData) status.push('Chưa có dữ liệu BHXH/thuế kỳ');
        if(!classification) status.push('Chưa cập nhật phân loại');
        const fixedComponentCount=rateCount;
        const teachingStatus=lessons.length===0?'Chưa ghi nhận tiết dạy':missingRates?'Thiếu đơn giá tiết dạy':'Đã ghi nhận tiết dạy';
        const taxMethod=tax.method||tax.tax_method||tax.calculation_method||taxMethodFor(classification);
        return {id,code,name:nameOf(s)||nameOf(master),classification,columnLabels:dynamicLabels,hasTaxData,hasMasterProfile,hasRateData:rateRows.length>0,hasInsuranceProfile:Boolean(insuranceByEmployee.get(id)),hasUnionProfile:Boolean(unionByEmployee.get(id)),adjustmentCount:employeeAdjustments.length,department:s.department||s.department_snapshot||master.department||'—',position:s.position||s.position_snapshot||master.position||master.job_title||'—',fixed,...fixedParts,...lessonParts,teaching,lessonCount,rateCount,fixedComponentCount,additions,deductions,additionCount:addRows.length,deductionCount:deductRows.length,difference:additions-deductions,insuranceEmployee,employerInsurance,unionEmployee,tax,taxable,taxAmount,taxMethod,gross,net,participates:tax.participates_insurance??insurance.participates_insurance??insurance.social_insurance??false,dependents:tax.dependent_count??dependentCount,support:supportFor(id,code),status:status.length?status.join(' · '):'Đủ dữ liệu nguồn',teachingStatus,hasIssue:status.length>0};
      }).sort((a,b)=>a.code.localeCompare(b.code,'vi',{numeric:true}));
      setRows(output);setWarnings(notes);setDataLoaded(true);
    } catch(e) {setError(errorText(e));setRows([]);setWarnings(notes);setDataLoaded(false);}
    finally {setLoading(false);setRefreshing(false);}
  },[periodId]);

  useEffect(()=>{load(false);},[]);
  useEffect(()=>{if(periodId) load(true);},[periodId]);

  const visible=useMemo(()=>rows.filter(r=>{
    const q=norm(search);
    const matches=!q||norm([r.code,r.name,r.department,r.position,r.classification].join(' ')).includes(q);
    const typeMatches=typeFilter==='ALL'||(typeFilter==='ISSUES'?r.hasIssue:norm(r.classification).includes(norm(typeFilter)));
    return matches&&typeMatches;
  }),[rows,search,typeFilter]);
  const totals=useMemo(()=>rows.reduce((s,r)=>{
    for(const key of ['fixed','teaching','additions','deductions','difference','insuranceEmployee','unionEmployee','employerInsurance','taxable','taxAmount','gross','net'])s[key]+=num(r[key]);
    s.lessonCount+=num(r.lessonCount); for(const k of Object.keys(r)) if(k.startsWith('fixedCol_')) s[k]=(s[k]||0)+num(r[k]); if(r.hasIssue)s.issues++;
    return s;
  },{fixed:0,teaching:0,additions:0,deductions:0,difference:0,insuranceEmployee:0,unionEmployee:0,employerInsurance:0,taxable:0,taxAmount:0,gross:0,net:0,lessonCount:0,issues:0}),[rows]);

  const columns = useMemo(()=>{
    if(page==='period-employees')return ['code','name','classification','department','position','status'];
    if(page==='fixed-salary')return ['code','name','classification',...Object.keys(rows[0]?.columnLabels||{}).filter(k=>k.startsWith('fixedCol_')).slice(0,4),'fixed','status'];
    if(page==='teaching-pay')return ['code','name',...Object.keys(rows[0]?.columnLabels||{}).filter(k=>k.startsWith('lesson_')),'lessonCount','teaching'];
    if(page==='payroll-deductions')return ['code','name','additionCount','additions','deductionCount','deductions','difference','status'];
    if(page==='insurance-union')return ['code','name','participates','insuranceEmployee','unionEmployee','taxable','taxAmount','status'];
    if(page==='personal-income-tax')return ['code','name','classification','taxMethod','taxable','taxAmount','taxStatus'];
    if(page==='payroll-summary')return ['code','name','classification','fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','taxable','taxAmount','gross','net','status'];
    return ['code','name','classification','fixed','teaching','additions','deductions','insuranceEmployee','unionEmployee','taxable','taxAmount','gross','net','status'];
  },[page,rows]);
  const dynamicLabels = rows[0]?.columnLabels || {};
  const columnLabel = k => colLabel[k] || dynamicLabels[k] || k;
  const exportRows=()=> {
    const data=visible.map(r=>Object.fromEntries(columns.map(k=>[columnLabel(k),k==='participates'?(r[k]?'Có':'Không'):(moneyColumns.has(k)?num(r[k]):k==='taxable'||k==='lessonCount'||k==='rateCount'||k==='additionCount'||k==='deductionCount'?num(r[k]):(r[k]??''))])));
    const ws=XLSX.utils.json_to_sheet(data.length?data:[Object.fromEntries(columns.map(k=>[columnLabel(k),'']))]);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Tính lương');
    XLSX.writeFile(wb,`${page}-${periodTitle(periods.find(p=>p.id===periodId)).replace(/[^\wÀ-ỹ-]+/g,'-')}.xlsx`);
  };
  const selectedPeriod=periods.find(p=>p.id===periodId);
  const metric=(label,value,icon,sub='')=><div className="pc-metric" key={label}><div className="pc-metric-icon">{React.createElement(icon,{size:18})}</div><div className="pc-metric-label">{label}</div><div className="pc-metric-value">{value}</div>{sub&&<div className="pc-metric-sub">{sub}</div>}</div>;

  return <section className="pc-page">
    <header className="pc-heading"><div className="pc-heading-icon"><Icon size={22}/></div><div className="pc-heading-copy"><div className="pc-eyebrow">TÍNH LƯƠNG · WORKSPACE</div><h2>{meta.title}</h2><p>{meta.description}</p></div></header>
    <div className="pc-toolbar">
      <label className="pc-period">Kỳ Lương<select value={periodId} onChange={e=>setPeriodId(e.target.value)} disabled={loading}><option value="">-- Chọn Kỳ Lương --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodTitle(p)} · {statusTitle(p.status)}</option>)}</select></label>
      <label className="pc-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã nhân viên, họ tên..."/></label>
      <select className="pc-filter" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} aria-label="Lọc dữ liệu"><option value="ALL">Tất cả dữ liệu</option><option value="ISSUES">Cần kiểm tra</option>{[...new Set(rows.map(r=>r.classification).filter(Boolean))].map(v=><option key={v} value={v}>{v}</option>)}</select>
      <button className="pc-button" onClick={()=>load(true)} disabled={refreshing}><RefreshCw size={15}/> Làm mới</button>
      <button className="pc-button pc-primary" onClick={exportRows} disabled={!visible.length}><Download size={15}/> Xuất Excel</button>
    </div>
    {error&&<div className="pc-alert pc-error"><AlertTriangle size={17}/><div><strong>Không tải được dữ liệu</strong><p>{error}</p></div></div>}
    {warnings.length>0&&<div className="pc-alert"><AlertTriangle size={17}/><div><strong>Một số nguồn dữ liệu cần kiểm tra</strong><ul>{warnings.slice(0,5).map((w,i)=><li key={i}>{w}</li>)}</ul></div></div>}
    {page==='payroll-overview'&&<div className="pc-metrics">
      {metric('Nhân sự trong kỳ',rows.length,Users)}
      {metric('Cần kiểm tra',totals.issues,AlertTriangle)}
      {metric('Tổng thu nhập',money(totals.gross),Wallet)}
      {metric('Tổng khấu trừ NLĐ',money(totals.insuranceEmployee+totals.unionEmployee+totals.taxAmount+totals.deductions),ShieldCheck)}
      {metric('Tổng thực lĩnh',money(totals.net),CircleDollarSign)}
      {metric('Phí Công đoàn NLĐ',money(totals.unionEmployee),Calculator)}
      <div className="pc-period-status"><span>TRẠNG THÁI KỲ</span><strong>{selectedPeriod?statusTitle(selectedPeriod.status):'Chưa chọn kỳ'}</strong><small>{selectedPeriod?periodTitle(selectedPeriod):'Tạo kỳ trong menu Quản lý Kỳ Lương'}</small></div>
    </div>}
    {page==='payroll-summary'&&<div className="pc-metrics pc-summary-metrics">
      {metric('Nhân sự',rows.length,Users)}{metric('Tổng lương cố định',money(totals.fixed),Wallet)}{metric('Tiết dạy & phụ đạo',money(totals.teaching),FileSpreadsheet)}{metric('Tổng thu nhập',money(totals.gross),Calculator)}{metric('Tổng thuế TNCN',money(totals.taxAmount),ShieldCheck)}{metric('Thực lĩnh',money(totals.net),CircleDollarSign)}
    </div>}
    <div className="pc-table-card">
      <div className="pc-table-heading"><div><h3>{page==='payroll-overview'?'Chi tiết tổng quan theo nhân sự':meta.title}</h3><p>{selectedPeriod?`${periodTitle(selectedPeriod)} · ${rows.length} nhân sự đã chốt`:'Chưa có dữ liệu kỳ lương để hiển thị'}</p></div><span className="pc-count">{visible.length} dòng</span></div>
      {loading||refreshing&&!dataLoaded ? <div className="pc-empty"><RefreshCw className="pc-spin" size={22}/><strong>Đang tải dữ liệu kỳ lương...</strong></div>
      : !selectedPeriod ? <div className="pc-empty"><CalendarRangeIcon/><strong>Chưa có Kỳ Lương tháng</strong><p>Tạo Kỳ Lương tại menu Dữ Liệu Kỳ Lương → Quản lý Kỳ Lương.</p></div>
      : !visible.length ? <div className="pc-empty"><Users size={26}/><strong>{rows.length?'Không tìm thấy nhân sự phù hợp':'Kỳ Lương chưa có danh sách nhân sự được chốt'}</strong><p>{rows.length?'Thử thay đổi từ khóa hoặc bộ lọc.':'Kiểm tra danh sách nhân sự của Kỳ Lương. Không có dữ liệu mẫu được tạo tự động.'}</p></div>
      : <div className="pc-table-wrap"><table className="pc-table"><thead><tr>{columns.map(k=><th key={k}>{columnLabel(k)}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.id||r.code}>{columns.map(k=><td key={k} className={moneyColumns.has(k)||k.startsWith('fixedCol_')||k==='taxable'||k==='lessonCount'||k==='rateCount'||k==='additionCount'||k==='deductionCount'||k.startsWith('lesson_')?'pc-number':''}>{k==='status'||k==='teachingStatus'?<span className={`pc-status ${(k==='teachingStatus' ? r.teachingStatus==='Đã ghi nhận tiết dạy' : ['Đã liên kết nhân sự','Đã đọc khoản cộng/trừ','Đã đọc dữ liệu bảo hiểm/Công đoàn','Đủ 4 cấu phần lương','Đủ dữ liệu nguồn'].includes(statusForPage(r,page)) || statusForPage(r,page).startsWith('Chưa phát sinh'))?'pc-status-ok':'pc-status-warn'}`}>{k==='status'?statusForPage(r,page):r[k]}</span>:k==='taxStatus'?<span className={`pc-status ${r.taxAmount||r.taxable?'pc-status-ok':'pc-status-warn'}`}>{r.tax?.taxable_income_override!=null?'Có điều chỉnh':r.taxable>0||r.taxAmount>0?'Đã có dữ liệu thuế':'Chưa có dữ liệu thuế'}</span>:k==='participates'?(r.participates?'Có':'Không'):k==='taxable'?money(r.taxable):moneyColumns.has(k)||k.startsWith('fixedCol_')?money(r[k]):k==='lessonCount'||k==='rateCount'||k==='additionCount'||k==='deductionCount'||k.startsWith('lesson_')?num(r[k]).toLocaleString('vi-VN'):r[k]||'—'}</td>)}</tr>)}</tbody>
      {page!=='period-employees'&&<tfoot><tr>{columns.map((k,i)=><th key={k} className={i>1?'pc-number':''}>{i===0?'TỔNG CỘNG':moneyColumns.has(k)||k.startsWith('fixedCol_')||k==='taxable'?money(totals[k]||0):k==='lessonCount'?num(totals.lessonCount).toLocaleString('vi-VN'):k==='additionCount'?num(rows.reduce((sum,r)=>sum+num(r.additionCount),0)).toLocaleString('vi-VN'):k==='deductionCount'?num(rows.reduce((sum,r)=>sum+num(r.deductionCount),0)).toLocaleString('vi-VN'):''}</th>)}</tr></tfoot>}</table></div>}
    </div>
    <div className="pc-footnote"><AlertTriangle size={14}/><span>Đây là màn hình tổng hợp chỉ đọc. Số liệu lấy từ các bảng dữ liệu hiện có; các cấu phần chưa có nguồn hoặc chưa đủ điều kiện tính sẽ được cảnh báo. Chưa thực hiện duyệt hoặc khóa kỳ.</span></div>
  </section>;
}
function CalendarRangeIcon(){return <Calculator size={26}/>}
