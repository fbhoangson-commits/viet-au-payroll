PATCH: FIX TIEN IELTS / NHOM KHAC LIEN KET VE TINH LUONG

Nguon: viet-au-payroll-main ZIP ma nguon do nguoi dung cung cap.
Chi thay doi:
  src/features/payroll-calculation/PayrollCalculationPage.jsx

Nguyen nhan duoc xu ly:
- Module tinh luong nhan dien cac nhom Tiet day, Phu dao, Khac theo ten, nhung bo sot alias ma nhom `OTHER` neu ten nhom trong database la ma tieng Anh.
- Vi vay cac cot thuoc nhom OTHER (bao gom IELTS neu cot nay duoc cau hinh trong nhom Khac) khong duoc dua vao danh sach cot tiet day va khong tinh vao Thanh Tien Tiet Day/Tong Thu Nhap.
- Bo sung cach tim don gia theo ID/code/name/label, co chuan hoa key, de doc dung gia tri da luu trong salary_rate_values.

Phan khong thay doi:
- Khong sua src/features/insurance-tax-data/Page.jsx.
- Khong sua cong thuc thue, phan loai nhan su, database, migration, giao dien cac module khac.
- Khong tao don gia hay so tiet moi; chi doc so tiet va don gia da co trong du lieu nguon.

Ap dung:
1. Sao luu ma nguon hien tai.
2. Giai nen ZIP vao thu muc goc repository, giu nguyen duong dan src/.
3. Ghi de duy nhat file neu tren.
4. Chay npm run build. Chi deploy neu build thanh cong.
5. Kiem tra nhan su co tiet IELTS trong Chấm Công Tiết Dạy: so tiet x don gia phai vao Thanh Tien Tiet Day va Tong Thu Nhap cua ky tuong ung.
