# PATCH GUI EMAIL PHIEU LUONG - V2

## Pham vi
Chi sua 2 file:
1. `src/features/payslip-email/Page.jsx`
   - Doi endpoint goi Edge Function tao hang doi tu `enqueue-payslip-emails` sang slug thuc te `bright-endpoint`.
   - Giu nguyen request body, idempotency key, tao HTML phieu luong, dieu kien duyet/khoa va luong gui hien tai.

2. `supabase/functions/process-payslip-email-queue/index.ts`
   - Dung cot `attempt_count` theo schema bang `payroll_email_queue` da duoc cung cap.
   - Bo cac truong `updated_at` va `provider_message_id` vi khong ton tai trong schema hien tai.
   - Giu nguyen xac thuc nguoi dung, kiem tra `payroll_can_operate()`, gui qua Apps Script, cap nhat trang thai va xu ly retry.

## Trien khai

### A. Webapp (Cloudflare Pages)
1. Giai nen patch vao repository, giu nguyen duong dan.
2. Thay file `src/features/payslip-email/Page.jsx`.
3. Build va deploy Webapp theo quy trinh hien tai.

### B. Edge Function process-payslip-email-queue
1. Supabase Dashboard > Edge Functions > `process-payslip-email-queue` > Code.
2. Thay toan bo code bang noi dung file `supabase/functions/process-payslip-email-queue/index.ts` trong patch.
3. Deploy function de tao phien ban moi.
4. Khong tao function moi, khong xoa function cu.

### C. Khong thay doi
- Khong deploy lai `enqueue-payslip-emails`: endpoint slug thuc te cua function hien tai la `bright-endpoint`; frontend patch da goi dung slug nay.
- Khong chay lai migration, khong sua bang, khong tao lai secrets.
- Khong thay doi tinh luong, snapshot, mau phieu luong, UI hay Employee Master.

## Kiem tra sau deploy
1. Mo Webapp, Ctrl+F5.
2. Chon ky/Run da APPROVED hoac LOCKED va chi chon mot nhan su co email hop le.
3. Bam gui mot lan.
4. Kiem tra Logs cua function hien thi ten `enqueue-payslip-emails` (slug `bright-endpoint`) va `process-payslip-email-queue`.
5. Kiem tra bang `payroll_email_queue`, Gmail va PDF dinh kem truoc khi gui nhieu nguoi.

## Luu y
- Khong bam gui lai neu chua kiem tra queue/Gmail, de tranh gui trung.
- Patch nay duoc doi chieu voi schema bang do nguoi dung cung cap: co `attempt_count`, khong co `updated_at` va `provider_message_id`.
- Chua the xac nhan build/deploy production tu moi truong tao patch; can chay build va kiem thu tren project Supabase/Cloudflare thuc te.
