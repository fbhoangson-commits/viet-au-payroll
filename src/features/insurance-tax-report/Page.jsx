import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import {
  RefreshCw, Download, Search, ShieldCheck, ReceiptText, AlertTriangle,
  CheckCircle2, CircleHelp, FileWarning, Users, ChevronLeft, ChevronRight
} from 'lucide-react';
import './insurance-tax-report.css';

const money = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const percent = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').trim().toLocaleLowerCase('vi');
const first = (...values) => values.find(value => value !== null && value !== undefined && value !== '');
const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const employeeCode = row => String(first(row?.employee_code, row?.code, row?.employee_code_snapshot, '') || '');
const employeeName = row => String(first(row?.employee_name, row?.full_name, row?.name, row?.employee_name_snapshot, employeeCode(row), 'Chưa có tên') || 'Chưa có tên');
const moneyField = (row, keys) => {
  for (const key of keys) if (row && Object.prototype.hasOwnProperty.call(row, key)) return numberOrNull(row[key]);
  return null;
};
const statusLabel = status => ({
  DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', LOCKED: 'Đã khóa',
  CLOSED: 'Đã đóng', OPEN: 'Đang mở'
}[String(status || '').toUpperCase()] || (status || 'Chưa xác định'));
const statusTone = status => {
  const s = String(status || '').toUpperCase();
  if (['APPROVED', 'LOCKED', 'CLOSED'].includes(s)) return 'success';
  if (['REJECTED'].includes(s)) return 'danger';
  if (['SUBMITTED', 'PENDING'].includes(s)) return 'warning';
  return 'neutral';
};
const periodName = period => period?.name || period?.period_name || period?.period_code || period?.code || period?.month || 'Kỳ lương';
const runLabel = run => `Run #${run.run_number ?? '—'} · ${statusLabel(run.status)} · ${run.calculated_at ? new Date(run.calculated_at).toLocaleString('vi-VN') : 'Chưa rõ thời điểm'}`;
const snapshotOf = run => run?.input_snapshot && typeof run.input_snapshot === 'object' ? run.input_snapshot : {};
const snapshotResults = run => Array.isArray(snapshotOf(run).results) ? snapshotOf(run).results : [];
const snapshotTotals = run => snapshotOf(run).totals && typeof snapshotOf(run).totals === 'object' ? snapshotOf(run).totals : {};
const totalFrom = (rows, field) => rows.reduce((sum, row) => sum + (numberOrNull(row[field]) ?? 0), 0);
const knownSum = values => {
  const known = values.filter(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
  return known.length ? known.reduce((sum, value) => sum + Number(value), 0) : null;
};
const missingValueCount = values => values.filter(value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))).length;
const getEmployeeId = row => String(first(row?.employee_id, row?.id, '') || '');
const getRunPeriodId = run => String(first(run?.payroll_period_id, run?.period_id, '') || '');
const getRunId = run => String(first(run?.id, '') || '');
const isTrue = value => value === true || ['true', '1', 'yes', 'co', 'tham gia', 'dang tham gia'].includes(norm(value));
const employeeMapKey = row => employeeCode(row).trim().toLocaleUpperCase('vi');
const detailField = (row, keys) => {
  for (const key of keys) if (row && Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '') return row[key];
  return null;
};
const moneyColumns = [
  ['insurance_salary_base', 'Căn cứ đóng BHXH'], ['employee_social_amount', 'BHXH NLĐ'],
  ['employee_health_amount', 'BHYT NLĐ'], ['employee_unemployment_amount', 'BHTN NLĐ'],
  ['employee_insurance_amount', 'Tổng bảo hiểm NLĐ'], ['employer_insurance_amount', 'Tổng bảo hiểm đơn vị'],
  ['taxable_income', 'Thu nhập chịu thuế'], ['personal_relief_amount', 'Giảm trừ cá nhân'],
  ['dependent_relief_amount', 'Giảm trừ người phụ thuộc'], ['insurance_deductible_amount', 'Bảo hiểm được trừ'],
  ['taxable_income_base', 'Thu nhập tính thuế'], ['personal_income_tax', 'Thuế TNCN']
];

function downloadWorkbook({ period, run, insuranceRows, taxRows, warnings }) {
  const wb = XLSX.utils.book_new();
  const meta = [
    ['BÁO CÁO BHXH & THUẾ – VIỆT ÂU PAYROLL'],
    ['Kỳ lương', periodName(period)],
    ['Mã phiên bản', run ? `Run #${run.run_number ?? ''}` : ''],
    ['Trạng thái', run ? statusLabel(run.status) : ''],
    ['Thời điểm tính', run?.calculated_at || ''],
    ['Ghi chú', 'Dữ liệu được tổng hợp từ snapshot và hồ sơ hiện có; không tính lại lương, bảo hiểm hoặc thuế.']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Thông tin');
  const exportRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? '' : value])));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows(insuranceRows)), 'Chi tiết bảo hiểm');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows(taxRows)), 'Chi tiết thuế');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warnings.map(item => ({ Loại: item.type, 'Mã nhân viên': item.code || '', 'Họ và tên': item.name || '', Mô_tả: item.message, Trạng_thái: item.status || '' }))), 'Cảnh báo');
  const suffix = period?.period_code || period?.code || period?.month || 'ky-luong';
  XLSX.writeFile(wb, `Bao-cao-BHXH-Thue-${String(suffix).replace(/[^a-zA-Z0-9_-]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function Page() {
  const [periods, setPeriods] = useState([]);
  const [runs, setRuns] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [periodTaxData, setPeriodTaxData] = useState([]);
  const [periodEmployees, setPeriodEmployees] = useState([]);
  const [taxReliefConfig, setTaxReliefConfig] = useState(null);
  const [insuranceProfiles, setInsuranceProfiles] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [unionProfiles, setUnionProfiles] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [activePeriodId, setActivePeriodId] = useState('');
  const [activeRunId, setActiveRunId] = useState('');
  const [tab, setTab] = useState('insurance');
  const [search, setSearch] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [insuranceFilter, setInsuranceFilter] = useState('all');
  const [taxFilter, setTaxFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warningsData, setWarningsData] = useState([]);
  const [loadedAt, setLoadedAt] = useState(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setError('Chưa cấu hình Supabase. Không thể tải báo cáo.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const optionalWarnings = [];
    try {
      const [periodResult, runResult, employeeResult, periodTaxResult, periodEmployeeResult, taxConfigResult, insuranceResult, dependentResult, commitmentResult, unionResult, approvalResult] = await Promise.all([
        supabase.from('payroll_periods').select('*').order('created_at', { ascending: false }),
        supabase.from('payroll_runs').select('*').order('run_number', { ascending: false }),
        supabase.from('employees').select('*'),
        supabase.from('payroll_period_insurance_tax_data').select('*'),
        supabase.from('payroll_period_employees').select('*'),
        supabase.from('payroll_tax_relief_config').select('*').eq('config_key', 'default').maybeSingle(),
        supabase.from('employee_insurance_profiles').select('*'),
        supabase.from('employee_tax_dependents').select('*'),
        supabase.from('employee_income_commitments').select('*'),
        supabase.from('employee_union_profiles').select('*'),
        supabase.from('payroll_approvals').select('*').order('created_at', { ascending: false })
      ]);
      if (periodResult.error) throw new Error(`Không tải được kỳ lương: ${periodResult.error.message}`);
      if (runResult.error) throw new Error(`Không tải được phiên bản lương: ${runResult.error.message}`);
      setPeriods(periodResult.data || []);
      setRuns(runResult.data || []);
      if (employeeResult.error) optionalWarnings.push(`Employee Master: ${employeeResult.error.message}`);
      if (periodTaxResult.error) optionalWarnings.push(`Dữ liệu BHXH/thuế theo kỳ: ${periodTaxResult.error.message}`);
      if (periodEmployeeResult.error) optionalWarnings.push(`Dữ liệu nhân sự kỳ lương: ${periodEmployeeResult.error.message}`);
      if (taxConfigResult.error) optionalWarnings.push(`Cấu hình giảm trừ thuế: ${taxConfigResult.error.message}`);
      if (insuranceResult.error) optionalWarnings.push(`Hồ sơ bảo hiểm: ${insuranceResult.error.message}`);
      if (dependentResult.error) optionalWarnings.push(`Người phụ thuộc: ${dependentResult.error.message}`);
      if (commitmentResult.error) optionalWarnings.push(`Cam kết thu nhập: ${commitmentResult.error.message}`);
      if (unionResult.error) optionalWarnings.push(`Công đoàn: ${unionResult.error.message}`);
      if (approvalResult.error) optionalWarnings.push(`Lịch sử duyệt: ${approvalResult.error.message}`);
      setEmployees(employeeResult.data || []);
      setPeriodTaxData(periodTaxResult.data || []);
      setPeriodEmployees(periodEmployeeResult.data || []);
      setTaxReliefConfig(taxConfigResult.data || null);
      setInsuranceProfiles(insuranceResult.data || []);
      setDependents(dependentResult.data || []);
      setCommitments(commitmentResult.data || []);
      setUnionProfiles(unionResult.data || []);
      setApprovals(approvalResult.data || []);
      setWarningsData(optionalWarnings.map(message => ({ type: 'Lỗi nguồn dữ liệu', message, status: 'Chưa thể đối chiếu' })));
      setLoadedAt(new Date());
      const validPeriods = periodResult.data || [];
      const validRuns = runResult.data || [];
      setActivePeriodId(current => validPeriods.some(p => String(p.id) === current) ? current : (validRuns[0] ? getRunPeriodId(validRuns[0]) : String(validPeriods[0]?.id || '')));
      setActiveRunId(current => validRuns.some(r => getRunId(r) === current) ? current : '');
    } catch (err) {
      setError(err?.message || 'Không thể tải báo cáo từ Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const periodRuns = useMemo(() => runs.filter(run => getRunPeriodId(run) === String(activePeriodId)), [runs, activePeriodId]);
  const selectedRun = useMemo(() => {
    if (activeRunId && periodRuns.some(run => getRunId(run) === activeRunId)) return periodRuns.find(run => getRunId(run) === activeRunId);
    return periodRuns.find(run => ['APPROVED', 'LOCKED'].includes(String(run.status || '').toUpperCase())) || periodRuns[0] || null;
  }, [periodRuns, activeRunId]);
  useEffect(() => {
    if (selectedRun && activeRunId !== getRunId(selectedRun)) setActiveRunId(getRunId(selectedRun));
    if (!selectedRun && activeRunId) setActiveRunId('');
  }, [selectedRun, activeRunId]);

  const period = useMemo(() => periods.find(item => String(item.id) === String(activePeriodId)) || null, [periods, activePeriodId]);
  const activeTaxRows = useMemo(() => periodTaxData.filter(row => String(row.period_id) === String(activePeriodId)), [periodTaxData, activePeriodId]);
  const activePeriodEmployees = useMemo(() => periodEmployees.filter(row => String(row.period_id) === String(activePeriodId)), [periodEmployees, activePeriodId]);
  const results = useMemo(() => {
    const snapshots = snapshotResults(selectedRun);
    const baseRows = activePeriodEmployees.length ? activePeriodEmployees : activeTaxRows;
    if (!baseRows.length) return snapshots;
    const keyOf = row => {
      const id = String(first(row?.employee_id, row?.id, '') || '').trim();
      const code = String(first(row?.employee_code, row?.employee_code_snapshot, row?.code, '') || '').trim().toLocaleUpperCase('vi');
      return id ? `id:${id}` : code ? `code:${code}` : '';
    };
    const merged = new Map();
    for (const row of baseRows) {
      const key = keyOf(row);
      if (key) merged.set(key, { ...row });
    }
    for (const row of snapshots) {
      const key = keyOf(row);
      if (!key) continue;
      const base = merged.get(key) || {};
      merged.set(key, { ...base, ...row });
    }
    // Keep the saved snapshot as the source for calculated amounts, but use Dữ Liệu Kỳ Lương
    // to complete employees and period-specific insurance/tax fields when snapshot fields are absent.
    return [...merged.values()];
  }, [selectedRun, activePeriodEmployees, activeTaxRows]);
  const totals = useMemo(() => snapshotTotals(selectedRun), [selectedRun]);
  const masterById = useMemo(() => new Map(employees.map(row => [getEmployeeId(row), row])), [employees]);
  const masterByCode = useMemo(() => new Map(employees.map(row => [employeeMapKey(row), row]).filter(([key]) => key)), [employees]);
  const taxById = useMemo(() => new Map(activeTaxRows.map(row => [String(row.employee_id), row])), [activeTaxRows]);
  const taxByCode = useMemo(() => new Map(activeTaxRows.map(row => [String(row.employee_code || '').trim().toLocaleUpperCase('vi'), row]).filter(([key]) => key)), [activeTaxRows]);
  const insuranceById = useMemo(() => new Map(insuranceProfiles.map(row => [String(row.employee_id), row])), [insuranceProfiles]);
  const dependentCounts = useMemo(() => {
    const map = new Map();
    for (const row of dependents) {
      const key = String(row.employee_id || '');
      if (!key) continue;
      if (!['inactive', 'terminated', 'ended', 'ngung giam tru', 'da ket thuc'].includes(norm(row.status))) map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [dependents]);
  const commitmentById = useMemo(() => new Map(commitments.map(row => [String(row.employee_id), row])), [commitments]);
  const unionById = useMemo(() => new Map(unionProfiles.map(row => [String(row.employee_id), row])), [unionProfiles]);
  const historicalRuns = useMemo(() => {
    const byPeriod = new Map();
    for (const run of runs) {
      const periodId = getRunPeriodId(run);
      if (!periodId) continue;
      const existing = byPeriod.get(periodId);
      const rank = item => ['APPROVED', 'LOCKED'].includes(String(item?.status || '').toUpperCase()) ? 2 : 1;
      if (!existing || rank(run) > rank(existing) || (rank(run) === rank(existing) && Number(run.run_number || 0) > Number(existing.run_number || 0))) byPeriod.set(periodId, run);
    }
    return [...byPeriod.values()].map(run => ({
      run,
      period: periods.find(item => String(item.id) === getRunPeriodId(run)) || null,
      totals: snapshotTotals(run),
      results: snapshotResults(run)
    })).sort((a, b) => {
      const ad = String(a.period?.month || a.period?.period_code || a.period?.code || '');
      const bd = String(b.period?.month || b.period?.period_code || b.period?.code || '');
      return ad.localeCompare(bd, 'vi', { numeric: true });
    });
  }, [runs, periods]);

  const approvalByRun = useMemo(() => {
    const map = new Map();
    for (const row of approvals) {
      const key = String(first(row.payroll_run_id, row.run_id, '') || '');
      if (key && !map.has(key)) map.set(key, row);
    }
    return map;
  }, [approvals]);

  const detailRows = useMemo(() => results.map((result) => {
    const code = String(first(result.code, result.employee_code, result.employee_code_snapshot, '') || '');
    const name = String(first(result.employee_name, result.full_name, result.name, result.employee_name_snapshot, code, 'Chưa có tên') || 'Chưa có tên');
    const master = masterByCode.get(code.trim().toLocaleUpperCase('vi')) || masterById.get(String(result.employee_id || '')) || {};
    const id = String(first(result.employee_id, master.id, '') || '');
    // Dữ liệu Kỳ Lương là nguồn ưu tiên cho các cấu hình BHXH/thuế của đúng kỳ.
    // Snapshot vẫn được ưu tiên cho kết quả thực tế đã chốt như thuế và tổng bảo hiểm.
    const tax = taxById.get(id) || taxByCode.get(code.trim().toLocaleUpperCase('vi')) || {};
    const insurance = insuranceById.get(id) || {};
    const commitment = commitmentById.get(id) || {};
    const union = unionById.get(id) || {};
    const masterDependentCount = (() => {
      const sources = [master, master.custom_fields && typeof master.custom_fields === 'object' ? master.custom_fields : {}];
      const keys = new Set(['dependents_count','dependent_count','so nguoi phu thuoc','nguoi phu thuoc'].map(norm));
      for (const source of sources) for (const [key, value] of Object.entries(source || {})) {
        if (keys.has(norm(key)) && value !== null && value !== undefined && String(value).trim() !== '') {
          const n = numberOrNull(value); if (n !== null && n >= 0) return Math.floor(n);
        }
      }
      return null;
    })();
    const count = numberOrNull(first(tax.dependent_count, masterDependentCount, dependentCounts.has(id) ? dependentCounts.get(id) : null));
    const taxableIncome = moneyField(result, ['taxable_income', 'taxable', 'taxable_income_base'])
      ?? moneyField(tax, ['taxable_income', 'taxable_income_override', 'calculated_taxable_income']);
    const taxAmount = moneyField(result, ['personal_income_tax', 'tax_amount', 'taxAmount'])
      ?? moneyField(tax, ['personal_income_tax', 'tax_amount']);
    const insuranceEmployee = moneyField(result, ['insurance_employee', 'insuranceEmployee']);
    const insuranceEmployer = moneyField(result, ['employer_insurance', 'employerInsurance']);
    const unionEmployee = moneyField(result, ['union_employee', 'unionEmployee']);
    const socialEmployee = moneyField(tax, ['employee_social_amount', 'social_employee_amount']);
    const healthEmployee = moneyField(tax, ['employee_health_amount', 'health_employee_amount']);
    const unemploymentEmployee = moneyField(tax, ['employee_unemployment_amount', 'unemployment_employee_amount']);
    const base = moneyField(tax, ['insurance_salary_base']) ?? moneyField(insurance, ['insurance_salary_base']);
    const participation = first(tax.participates_insurance, insurance.participates_insurance, null);
    const employeeInsuranceTotal = moneyField(result, ['insurance_employee', 'insuranceEmployee', 'employee_insurance_amount'])
      ?? moneyField(tax, ['employee_insurance_amount', 'insurance_employee_amount']);
    const employerInsuranceTotal = moneyField(result, ['employer_insurance', 'employerInsurance', 'employer_insurance_amount'])
      ?? moneyField(tax, ['employer_insurance_amount', 'insurance_employer_amount']);
    const personalRelief = moneyField(tax, ['personal_relief_amount']) ?? moneyField(taxReliefConfig, ['personal_relief_amount']);
    const dependentReliefUnit = moneyField(tax, ['dependent_relief_amount']) ?? moneyField(taxReliefConfig, ['dependent_relief_amount']);
    const dependentRelief = moneyField(tax, ['dependent_relief_total', 'total_dependent_relief_amount'])
      ?? (count !== null && dependentReliefUnit !== null ? count * dependentReliefUnit : null);
    const deductibleInsurance = moneyField(tax, ['insurance_deductible_amount']) ?? employeeInsuranceTotal;
    const taxableBase = moneyField(result, ['taxable_income_base', 'taxable_base'])
      ?? moneyField(tax, ['taxable_income_base', 'calculated_taxable_income']);
    const hasTaxData = [
      taxableIncome, tax.personal_relief_amount, tax.dependent_relief_amount,
      tax.insurance_deductible_amount, tax.taxable_income_base, tax.calculated_taxable_income,
      taxAmount, tax.has_commitment, tax.commitment_validated, tax.dependent_count
    ].some(value => value !== null && value !== undefined && value !== '');
    const hasInsuranceData = [
      base, participation, employeeInsuranceTotal, employerInsuranceTotal,
      socialEmployee, healthEmployee, unemploymentEmployee,
      tax.employee_social_rate, tax.employee_health_rate, tax.employee_unemployment_rate
    ].some(value => value !== null && value !== undefined && value !== '')
      || Object.keys(insurance).length > 0;
    const status = !hasInsuranceData && !hasTaxData ? 'Thiếu dữ liệu' : (hasInsuranceData && (participation === true || participation === false) ? 'Có dữ liệu' : 'Cần kiểm tra');
    const classification = first(result.classification, result.employee_type, master.employee_type, master.classification, master.employment_type, '');
    const department = first(result.department, result.department_name, master.department, master.department_name, master.division, '');
    return {
      employee_id: id, employee_code: code, employee_name: name,
      classification: classification || 'Chưa phân loại', department: department || 'Chưa có phòng ban',
      participates_insurance: participation, insurance_salary_base: base,
      employee_social_rate: moneyField(tax, ['employee_social_rate']) ?? moneyField(insurance, ['employee_social_rate']),
      employee_social_amount: socialEmployee,
      employee_health_rate: moneyField(tax, ['employee_health_rate']) ?? moneyField(insurance, ['employee_health_rate']),
      employee_health_amount: healthEmployee,
      employee_unemployment_rate: moneyField(tax, ['employee_unemployment_rate']) ?? moneyField(insurance, ['employee_unemployment_rate']),
      employee_unemployment_amount: unemploymentEmployee,
      employee_insurance_amount: employeeInsuranceTotal, employer_insurance_amount: employerInsuranceTotal,
      taxable_income: taxableIncome, personal_relief_amount: personalRelief, dependent_count: count,
      dependent_relief_amount: dependentRelief, insurance_deductible_amount: deductibleInsurance,
      taxable_income_base: taxableBase, personal_income_tax: taxAmount,
      has_commitment: first(tax.has_commitment, commitment.has_commitment, null),
      commitment_validated: first(tax.commitment_validated, null),
      status, _hasInsuranceData: hasInsuranceData, _hasTaxData: hasTaxData,
      _rawTax: tax, _rawInsurance: insurance, _rawResult: result, _union: union
    };
  }).sort((a, b) => a.employee_code.localeCompare(b.employee_code, 'vi', { numeric: true })), [results, masterByCode, masterById, taxById, taxByCode, insuranceById, commitmentById, unionById, dependentCounts, taxReliefConfig]);

  const classifications = useMemo(() => [...new Set(detailRows.map(row => row.classification).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [detailRows]);
  const departments = useMemo(() => [...new Set(detailRows.map(row => row.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [detailRows]);
  const filteredRows = useMemo(() => detailRows.filter(row => {
    const q = norm(search);
    const matchSearch = !q || norm(row.employee_code).includes(q) || norm(row.employee_name).includes(q);
    const matchClass = classificationFilter === 'all' || row.classification === classificationFilter;
    const matchDepartment = departmentFilter === 'all' || row.department === departmentFilter;
    const matchInsurance = insuranceFilter === 'all' || (insuranceFilter === 'yes' && row.participates_insurance === true) || (insuranceFilter === 'no' && row.participates_insurance === false) || (insuranceFilter === 'missing' && row.participates_insurance !== true && row.participates_insurance !== false);
    const matchTax = taxFilter === 'all' || (taxFilter === 'has' && row._hasTaxData) || (taxFilter === 'missing' && !row._hasTaxData) || (taxFilter === 'taxable' && row.personal_income_tax !== null && row.personal_income_tax > 0);
    return matchSearch && matchClass && matchDepartment && matchInsurance && matchTax;
  }), [detailRows, search, classificationFilter, departmentFilter, insuranceFilter, taxFilter]);
  useEffect(() => { setPage(1); }, [search, classificationFilter, departmentFilter, insuranceFilter, taxFilter, tab, activeRunId]);
  const visibleRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page]);
  const maxPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const insuranceKpis = useMemo(() => {
    const totalBase = knownSum(detailRows.map(row => row.insurance_salary_base));
    const employeeInsurance = knownSum(detailRows.map(row => row.employee_insurance_amount));
    const employerInsurance = knownSum(detailRows.map(row => row.employer_insurance_amount));
    const social = knownSum(detailRows.map(row => row.employee_social_amount));
    const health = knownSum(detailRows.map(row => row.employee_health_amount));
    const unemployment = knownSum(detailRows.map(row => row.employee_unemployment_amount));
    const participating = detailRows.filter(row => row.participates_insurance === true).length;
    const missingProfile = detailRows.filter(row => !row._hasInsuranceData).length;
    return { employees: detailRows.length, participating, missingProfile, totalBase, employeeInsurance, employerInsurance, social, health, unemployment };
  }, [detailRows]);
  const taxKpis = useMemo(() => {
    const taxable = knownSum(detailRows.map(row => row.taxable_income));
    const personalRelief = knownSum(detailRows.map(row => row.personal_relief_amount));
    const dependentRelief = knownSum(detailRows.map(row => row.dependent_relief_amount));
    const deductibleInsurance = knownSum(detailRows.map(row => row.insurance_deductible_amount));
    const tax = knownSum(detailRows.map(row => row.personal_income_tax));
    const hasTax = detailRows.filter(row => row._hasTaxData).length;
    const missingTax = detailRows.filter(row => !row._hasTaxData).length;
    const positiveTax = detailRows.filter(row => row.personal_income_tax !== null && row.personal_income_tax > 0).length;
    const commitmentsCount = detailRows.filter(row => row.has_commitment === true && row.commitment_validated === true).length;
    const taxableBase = knownSum(detailRows.map(row => row.taxable_income_base));
    return { taxable, personalRelief, dependentRelief, deductibleInsurance, tax, hasTax, missingTax, positiveTax, commitmentsCount, taxableBase };
  }, [detailRows]);

  const warnings = useMemo(() => {
    const list = [...warningsData];
    for (const row of detailRows) {
      if (!row._hasInsuranceData) list.push({ type: 'Thiếu hồ sơ bảo hiểm', code: row.employee_code, name: row.employee_name, message: 'Không tìm thấy dữ liệu bảo hiểm trong hồ sơ hoặc dữ liệu kỳ lương.', status: 'Cần kiểm tra' });
      else if (row.participates_insurance === true && row.insurance_salary_base === null) list.push({ type: 'Thiếu căn cứ đóng', code: row.employee_code, name: row.employee_name, message: 'Đang tham gia bảo hiểm nhưng chưa có căn cứ đóng trong dữ liệu đọc được.', status: 'Cần kiểm tra' });
      if (!row._hasTaxData) list.push({ type: 'Thiếu dữ liệu thuế', code: row.employee_code, name: row.employee_name, message: 'Không tìm thấy trường dữ liệu thuế tương ứng cho nhân sự trong phiên bản đã chọn.', status: 'Cần kiểm tra' });
      if (row.classification === 'Chưa phân loại') list.push({ type: 'Thiếu phân loại', code: row.employee_code, name: row.employee_name, message: 'Không tìm thấy phân loại nhân sự trong snapshot hoặc Employee Master.', status: 'Cần kiểm tra' });
      if (row.participates_insurance === null && row._hasInsuranceData) list.push({ type: 'Chưa xác định trạng thái bảo hiểm', code: row.employee_code, name: row.employee_name, message: 'Hồ sơ có dữ liệu nhưng chưa xác định rõ có tham gia bảo hiểm hay không.', status: 'Cần kiểm tra' });
    }
    if (selectedRun && !['APPROVED','LOCKED'].includes(String(selectedRun.status || '').toUpperCase())) list.push({ type: 'Phiên bản chưa được duyệt', message: `Phiên bản đang xem ở trạng thái ${statusLabel(selectedRun.status)}.`, status: statusLabel(selectedRun.status) });
    if (selectedRun && !snapshotResults(selectedRun).length) list.push({ type: 'Thiếu snapshot', message: 'Phiên bản không có danh sách kết quả trong input_snapshot.', status: 'Cần kiểm tra' });
    return list;
  }, [warningsData, detailRows, selectedRun]);

  const currentTabRows = tab === 'insurance' ? filteredRows.filter(row => row._hasInsuranceData || row.participates_insurance !== null) : tab === 'tax' ? filteredRows.filter(row => row._hasTaxData) : filteredRows;
  const exportData = useCallback(() => {
    if (!selectedRun) return;
    const insuranceRows = filteredRows.map(row => ({
      'Mã nhân viên': row.employee_code, 'Họ và tên': row.employee_name, 'Phân loại': row.classification, 'Phòng ban': row.department,
      'Tham gia BHXH': row.participates_insurance === true ? 'Có' : row.participates_insurance === false ? 'Không' : 'Chưa rõ',
      'Căn cứ đóng BHXH': row.insurance_salary_base, 'Tỷ lệ BHXH NLĐ (%)': row.employee_social_rate, 'BHXH NLĐ': row.employee_social_amount,
      'Tỷ lệ BHYT NLĐ (%)': row.employee_health_rate, 'BHYT NLĐ': row.employee_health_amount,
      'Tỷ lệ BHTN NLĐ (%)': row.employee_unemployment_rate, 'BHTN NLĐ': row.employee_unemployment_amount,
      'Tổng bảo hiểm NLĐ': row.employee_insurance_amount, 'Tổng bảo hiểm đơn vị': row.employer_insurance_amount, 'Trạng thái': row.status
    }));
    const taxRows = filteredRows.map(row => ({
      'Mã nhân viên': row.employee_code, 'Họ và tên': row.employee_name, 'Phân loại': row.classification, 'Phòng ban': row.department,
      'Tổng thu nhập': moneyField(row._rawResult, ['gross_income', 'gross']), 'Thu nhập chịu thuế': row.taxable_income,
      'Giảm trừ cá nhân': row.personal_relief_amount, 'Số người phụ thuộc': row.dependent_count,
      'Giảm trừ người phụ thuộc': row.dependent_relief_amount, 'Bảo hiểm được trừ': row.insurance_deductible_amount,
      'Thu nhập tính thuế': row.taxable_income_base, 'Thuế TNCN': row.personal_income_tax,
      'Có cam kết': row.has_commitment === true ? 'Có' : row.has_commitment === false ? 'Không' : 'Chưa rõ',
      'Trạng thái dữ liệu': row._hasTaxData ? 'Có dữ liệu' : 'Thiếu dữ liệu'
    }));
    downloadWorkbook({ period, run: selectedRun, insuranceRows, taxRows, warnings });
  }, [selectedRun, filteredRows, period, warnings]);

  const kpiCard = (label, value, icon, note = '') => (
    <div className="itr-kpi" key={label}>
      <div className="itr-kpi-icon">{icon}</div>
      <div className="itr-kpi-label">{label}</div>
      <div className="itr-kpi-value">{value === null || value === undefined ? 'Chưa có dữ liệu' : value}</div>
      {note && <div className="itr-kpi-note">{note}</div>}
    </div>
  );

  const displayMoney = value => value === null || value === undefined ? '—' : `${money(value)} ₫`;
  const rowClass = row => row._hasInsuranceData && row._hasTaxData ? 'Có dữ liệu' : 'Cần kiểm tra';

  return (
    <div className="itr-page">
      <div className="itr-heading">
        <div><div className="itr-eyebrow">VIỆT ÂU PAYROLL · BÁO CÁO NGHIỆP VỤ</div><h1>Báo cáo BHXH &amp; thuế</h1><p>Đối chiếu số liệu bảo hiểm và thuế từ phiên bản lương đã lưu.</p></div>
        <div className="itr-actions"><button className="itr-btn itr-btn-secondary" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'itr-spin' : ''}/> Làm mới</button><button className="itr-btn itr-btn-primary" onClick={exportData} disabled={!selectedRun || loading}><Download size={16}/> Xuất Excel</button></div>
      </div>

      <section className="itr-filter-panel">
        <label>Kỳ lương<select value={activePeriodId} onChange={event => { setActivePeriodId(event.target.value); setActiveRunId(''); }}><option value="">Chọn kỳ lương</option>{periods.map(item => <option key={item.id} value={item.id}>{periodName(item)}</option>)}</select></label>
        <label>Phiên bản lương<select value={selectedRun ? getRunId(selectedRun) : ''} onChange={event => setActiveRunId(event.target.value)}><option value="">Chọn phiên bản</option>{periodRuns.map(run => <option key={run.id} value={getRunId(run)}>{runLabel(run)}</option>)}</select></label>
        <label>Phân loại<select value={classificationFilter} onChange={event => setClassificationFilter(event.target.value)}><option value="all">Tất cả</option>{classifications.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Phòng ban<select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value="all">Tất cả</option>{departments.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Trạng thái BHXH<select value={insuranceFilter} onChange={event => setInsuranceFilter(event.target.value)}><option value="all">Tất cả</option><option value="yes">Có tham gia</option><option value="no">Không tham gia</option><option value="missing">Chưa xác định</option></select></label>
        <label>Dữ liệu thuế<select value={taxFilter} onChange={event => setTaxFilter(event.target.value)}><option value="all">Tất cả</option><option value="has">Có dữ liệu</option><option value="missing">Thiếu dữ liệu</option><option value="taxable">Có thuế phải nộp</option></select></label>
      </section>

      {error && <div className="itr-alert itr-alert-danger"><AlertTriangle size={18}/><div><strong>Không thể tải báo cáo</strong><p>{error}</p><button className="itr-btn itr-btn-secondary" onClick={load}>Thử lại</button></div></div>}
      {loading && <div className="itr-state"><RefreshCw className="itr-spin" size={24}/><strong>Đang tải dữ liệu từ Supabase…</strong></div>}
      {!loading && !error && !selectedRun && <div className="itr-state"><CircleHelp size={28}/><strong>Chưa có phiên bản lương</strong><p>Chọn kỳ lương có phiên bản đã lưu để xem báo cáo. Dashboard không tự tạo hoặc tính lại dữ liệu.</p></div>}

      {!loading && !error && selectedRun && <>
        <div className={`itr-run-banner ${statusTone(selectedRun.status)}`}>
          <div><strong>{periodName(period)} · {runLabel(selectedRun)}</strong><p>Đang xem một kỳ và phiên bản lương. Thông tin BHXH/thuế ưu tiên Dữ Liệu Kỳ Lương; số tiền đã tính ưu tiên snapshot, hồ sơ nhân sự chỉ bổ sung khi thiếu trường.</p></div>
          <span className={`itr-status ${statusTone(selectedRun.status)}`}>{statusLabel(selectedRun.status)}</span>
        </div>

        <div className="itr-tabs" role="tablist">
          <button className={tab === 'insurance' ? 'active' : ''} onClick={() => setTab('insurance')}><ShieldCheck size={16}/> Bảo hiểm</button>
          <button className={tab === 'tax' ? 'active' : ''} onClick={() => setTab('tax')}><ReceiptText size={16}/> Thuế TNCN</button>
          <button className={tab === 'reconcile' ? 'active' : ''} onClick={() => setTab('reconcile')}><FileWarning size={16}/> Đối chiếu &amp; cảnh báo <span>{warnings.length}</span></button>
        </div>

        {tab === 'insurance' && <>
          <h2 className="itr-section-title">Tổng quan bảo hiểm</h2>
          <div className="itr-kpi-grid">
            {kpiCard('Nhân sự trong phiên bản', money(insuranceKpis.employees), <Users size={18}/>)}
            {kpiCard('Đang tham gia BHXH', money(insuranceKpis.participating), <ShieldCheck size={18}/>)}
            {kpiCard('Thiếu hồ sơ bảo hiểm', money(insuranceKpis.missingProfile), <AlertTriangle size={18}/>, 'Không tìm thấy dữ liệu hồ sơ')}
            {kpiCard('Tổng căn cứ đóng BHXH', insuranceKpis.totalBase === null ? null : `${money(insuranceKpis.totalBase)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('Bảo hiểm NLĐ', insuranceKpis.employeeInsurance === null ? null : `${money(insuranceKpis.employeeInsurance)} ₫`, <Users size={18}/>)}
            {kpiCard('Bảo hiểm đơn vị', insuranceKpis.employerInsurance === null ? null : `${money(insuranceKpis.employerInsurance)} ₫`, <ShieldCheck size={18}/>)}
            {kpiCard('BHXH NLĐ', insuranceKpis.social === null ? null : `${money(insuranceKpis.social)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('BHYT NLĐ', insuranceKpis.health === null ? null : `${money(insuranceKpis.health)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('BHTN NLĐ', insuranceKpis.unemployment === null ? null : `${money(insuranceKpis.unemployment)} ₫`, <ReceiptText size={18}/>)}
          </div>
          <div className="itr-card">
            <div className="itr-card-head"><div><h2>Chi tiết bảo hiểm theo nhân sự</h2><p>Hiển thị số tiền đã lưu; không tự tính lại từ tỷ lệ.</p></div><span>{currentTabRows.length} nhân sự</span></div>
            <div className="itr-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã nhân viên hoặc họ tên…"/></div>
            <div className="itr-table-wrap"><table><thead><tr><th>Mã NV</th><th>Họ và tên</th><th>Phân loại</th><th>Phòng ban</th><th>Tham gia BHXH</th><th>Căn cứ đóng</th><th>BHXH NLĐ</th><th>BHYT NLĐ</th><th>BHTN NLĐ</th><th>Tổng BH NLĐ</th><th>Tổng BH đơn vị</th><th>Trạng thái</th></tr></thead><tbody>
              {currentTabRows.length ? visibleRows.filter(row => row._hasInsuranceData || row.participates_insurance !== null).map(row => <tr key={row.employee_code}><td>{row.employee_code || '—'}</td><td>{row.employee_name}</td><td>{row.classification}</td><td>{row.department}</td><td>{row.participates_insurance === true ? 'Có' : row.participates_insurance === false ? 'Không' : 'Chưa rõ'}</td><td>{displayMoney(row.insurance_salary_base)}</td><td>{displayMoney(row.employee_social_amount)}</td><td>{displayMoney(row.employee_health_amount)}</td><td>{displayMoney(row.employee_unemployment_amount)}</td><td>{displayMoney(row.employee_insurance_amount)}</td><td>{displayMoney(row.employer_insurance_amount)}</td><td><span className={`itr-status ${row._hasInsuranceData ? 'success' : 'warning'}`}>{row._hasInsuranceData ? 'Có dữ liệu' : 'Cần kiểm tra'}</span></td></tr>) : <tr><td colSpan="12" className="itr-empty-cell">Chưa có dữ liệu bảo hiểm phù hợp với bộ lọc.</td></tr>}
            </tbody></table></div>
            <div className="itr-table-foot"><span>Trang {page} / {maxPages} · {filteredRows.length} nhân sự sau lọc</span><div><button className="itr-icon-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ChevronLeft size={16}/></button><button className="itr-icon-btn" disabled={page >= maxPages} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ChevronRight size={16}/></button></div></div>
          </div>
        </>}

        {tab === 'tax' && <>
          <h2 className="itr-section-title">Tổng quan thuế TNCN</h2>
          <div className="itr-kpi-grid">
            {kpiCard('Nhân sự có dữ liệu thuế', money(taxKpis.hasTax), <Users size={18}/>)}
            {kpiCard('Chưa đủ dữ liệu thuế', money(taxKpis.missingTax), <AlertTriangle size={18}/>)}
            {kpiCard('Tổng thu nhập chịu thuế', taxKpis.taxable === null ? null : `${money(taxKpis.taxable)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('Giảm trừ cá nhân', taxKpis.personalRelief === null ? null : `${money(taxKpis.personalRelief)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('Giảm trừ người phụ thuộc', taxKpis.dependentRelief === null ? null : `${money(taxKpis.dependentRelief)} ₫`, <Users size={18}/>)}
            {kpiCard('Bảo hiểm được trừ', taxKpis.deductibleInsurance === null ? null : `${money(taxKpis.deductibleInsurance)} ₫`, <ShieldCheck size={18}/>)}
            {kpiCard('Thu nhập tính thuế', taxKpis.taxableBase === null ? null : `${money(taxKpis.taxableBase)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('Tổng thuế TNCN', taxKpis.tax === null ? null : `${money(taxKpis.tax)} ₫`, <ReceiptText size={18}/>)}
            {kpiCard('Có thuế phải nộp', money(taxKpis.positiveTax), <ReceiptText size={18}/>)}
            {kpiCard('Cam kết đã xác nhận', money(taxKpis.commitmentsCount), <CheckCircle2 size={18}/>)}
          </div>
          <div className="itr-card">
            <div className="itr-card-head"><div><h2>Chi tiết thuế TNCN theo nhân sự</h2><p>Thuế và thu nhập lấy từ snapshot; thông tin giảm trừ lấy từ dữ liệu kỳ lương nếu có.</p></div><span>{currentTabRows.length} nhân sự</span></div>
            <div className="itr-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã nhân viên hoặc họ tên…"/></div>
            <div className="itr-table-wrap"><table><thead><tr><th>Mã NV</th><th>Họ và tên</th><th>Phân loại</th><th>Phòng ban</th><th>Tổng thu nhập</th><th>Thu nhập chịu thuế</th><th>Giảm trừ cá nhân</th><th>Số NPT</th><th>Giảm trừ NPT</th><th>Bảo hiểm được trừ</th><th>Thu nhập tính thuế</th><th>Thuế TNCN</th><th>Cam kết</th><th>Trạng thái</th></tr></thead><tbody>
              {currentTabRows.length ? visibleRows.filter(row => row._hasTaxData).map(row => <tr key={row.employee_code}><td>{row.employee_code || '—'}</td><td>{row.employee_name}</td><td>{row.classification}</td><td>{row.department}</td><td>{displayMoney(moneyField(row._rawResult, ['gross_income','gross']))}</td><td>{displayMoney(row.taxable_income)}</td><td>{displayMoney(row.personal_relief_amount)}</td><td>{row.dependent_count ?? '—'}</td><td>{displayMoney(row.dependent_relief_amount)}</td><td>{displayMoney(row.insurance_deductible_amount)}</td><td>{displayMoney(row.taxable_income_base)}</td><td>{displayMoney(row.personal_income_tax)}</td><td>{row.has_commitment === true ? (row.commitment_validated === true ? 'Đã xác nhận' : 'Chưa xác nhận') : row.has_commitment === false ? 'Không' : 'Chưa rõ'}</td><td><span className={`itr-status ${row._hasTaxData ? 'success' : 'warning'}`}>{row._hasTaxData ? 'Có dữ liệu' : 'Thiếu dữ liệu'}</span></td></tr>) : <tr><td colSpan="14" className="itr-empty-cell">Chưa có dữ liệu thuế phù hợp với bộ lọc.</td></tr>}
            </tbody></table></div>
            <div className="itr-table-foot"><span>Trang {page} / {maxPages} · {filteredRows.length} nhân sự sau lọc</span><div><button className="itr-icon-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ChevronLeft size={16}/></button><button className="itr-icon-btn" disabled={page >= maxPages} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ChevronRight size={16}/></button></div></div>
          </div>
        </>}

        {tab === 'reconcile' && <>
          <h2 className="itr-section-title">Đối chiếu &amp; cảnh báo</h2>
          <div className="itr-reconcile-grid">
            <div className="itr-card itr-reconcile-card"><div className="itr-kpi-icon"><ShieldCheck size={18}/></div><span>Số dòng snapshot</span><strong>{money(results.length)}</strong><small>{results.length ? 'Đọc từ input_snapshot.results' : 'Không có dữ liệu snapshot'}</small></div>
            <div className="itr-card itr-reconcile-card"><div className="itr-kpi-icon"><ReceiptText size={18}/></div><span>Tổng thuế TNCN snapshot</span><strong>{totals.personal_income_tax === undefined ? 'Chưa có dữ liệu' : `${money(totals.personal_income_tax)} ₫`}</strong><small>{taxKpis.tax === null ? 'Không đủ dữ liệu dòng để đối chiếu' : `Tổng dòng: ${money(taxKpis.tax)} ₫`}</small></div>
            <div className="itr-card itr-reconcile-card"><div className="itr-kpi-icon"><Users size={18}/></div><span>Bảo hiểm NLĐ snapshot</span><strong>{totals.insurance_employee === undefined ? 'Chưa có dữ liệu' : `${money(totals.insurance_employee)} ₫`}</strong><small>{insuranceKpis.employeeInsurance === null ? 'Không đủ dữ liệu dòng để đối chiếu' : `Tổng dòng: ${money(insuranceKpis.employeeInsurance)} ₫`}</small></div>
            <div className="itr-card itr-reconcile-card"><div className="itr-kpi-icon"><ShieldCheck size={18}/></div><span>Bảo hiểm đơn vị snapshot</span><strong>{totals.employer_insurance === undefined ? 'Chưa có dữ liệu' : `${money(totals.employer_insurance)} ₫`}</strong><small>{insuranceKpis.employerInsurance === null ? 'Không đủ dữ liệu dòng để đối chiếu' : `Tổng dòng: ${money(insuranceKpis.employerInsurance)} ₫`}</small></div>
          </div>
          <div className="itr-card">
            <div className="itr-card-head"><div><h2>Danh sách cảnh báo</h2><p>Các cảnh báo chỉ phục vụ kiểm tra, không tự sửa dữ liệu nguồn.</p></div><span>{warnings.length} cảnh báo</span></div>
            <div className="itr-table-wrap"><table><thead><tr><th>Loại</th><th>Mã nhân viên</th><th>Họ và tên</th><th>Mô tả</th><th>Trạng thái</th></tr></thead><tbody>
              {warnings.length ? warnings.map((item, index) => <tr key={`${item.type}-${item.code || 'global'}-${index}`}><td><span className="itr-warning-type"><AlertTriangle size={14}/>{item.type}</span></td><td>{item.code || '—'}</td><td>{item.name || '—'}</td><td>{item.message}</td><td><span className={`itr-status ${item.status === 'Lỗi nguồn dữ liệu' ? 'danger' : 'warning'}`}>{item.status || 'Cần kiểm tra'}</span></td></tr>) : <tr><td colSpan="5" className="itr-empty-cell">Không có cảnh báo từ các nguồn dữ liệu hiện đọc được.</td></tr>}
            </tbody></table></div>
          </div>
          <div className="itr-card">
            <div className="itr-card-head"><div><h2>So sánh quỹ BHXH &amp; thuế theo kỳ</h2><p>Mỗi kỳ chỉ dùng một phiên bản đại diện; ưu tiên phiên bản đã duyệt/khóa, nếu chưa có thì dùng bản mới nhất và ghi trạng thái thực tế.</p></div><span>{historicalRuns.length} kỳ</span></div>
            <div className="itr-table-wrap"><table><thead><tr><th>Kỳ lương</th><th>Phiên bản</th><th>Trạng thái</th><th>Số nhân sự</th><th>Căn cứ đóng BHXH</th><th>Bảo hiểm NLĐ</th><th>Bảo hiểm đơn vị</th><th>Thu nhập chịu thuế</th><th>Thuế TNCN</th></tr></thead><tbody>
              {historicalRuns.length ? historicalRuns.map(item => <tr key={getRunId(item.run)}><td>{periodName(item.period)}</td><td>Run #{item.run.run_number ?? '—'}</td><td><span className={`itr-status ${statusTone(item.run.status)}`}>{statusLabel(item.run.status)}</span></td><td>{item.totals.employee_count ?? item.results.length}</td><td>{money(knownSum(item.results.map(row => moneyField(row, ['insurance_salary_base']))))}</td><td>{item.totals.insurance_employee === undefined ? '—' : money(item.totals.insurance_employee)}</td><td>{item.totals.employer_insurance === undefined ? '—' : money(item.totals.employer_insurance)}</td><td>{item.totals.taxable_income === undefined ? '—' : money(item.totals.taxable_income)}</td><td>{item.totals.personal_income_tax === undefined ? '—' : money(item.totals.personal_income_tax)}</td></tr>) : <tr><td colSpan="9" className="itr-empty-cell">Chưa có dữ liệu lịch sử để so sánh.</td></tr>}
            </tbody></table></div>
          </div>
          <div className="itr-card">
            <div className="itr-card-head"><div><h2>Thông tin lịch sử duyệt</h2><p>Hiển thị bản ghi lịch sử tìm được cho phiên bản đang chọn.</p></div></div>
            {approvalByRun.get(getRunId(selectedRun)) ? <pre className="itr-approval-json">{JSON.stringify(approvalByRun.get(getRunId(selectedRun)), null, 2)}</pre> : <div className="itr-inline-note"><CircleHelp size={16}/> Chưa tìm thấy bản ghi lịch sử liên kết trực tiếp với phiên bản này.</div>}
          </div>
        </>}
        <div className="itr-footnote"><CircleHelp size={15}/> Báo cáo không tính lại lương, bảo hiểm hoặc thuế. Những chỉ tiêu không có trường dữ liệu nguồn sẽ hiển thị “—” hoặc “Chưa có dữ liệu”.</div>
      </>}
      {loadedAt && !loading && <div className="itr-updated">Dữ liệu tải gần nhất: {loadedAt.toLocaleString('vi-VN')}</div>}
    </div>
  );
}
