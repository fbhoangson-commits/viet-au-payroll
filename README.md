# WEBAPP LƯƠNG VIỆT ÂU — V9 CLEAN BASE

Bộ mã nguồn khởi đầu sạch cho repository `viet-au-payroll`.

## Mục tiêu
- Giữ nhận diện/logo Việt Âu và nền tảng React + Vite.
- Làm mới giao diện quản trị và cấu trúc menu.
- Mỗi trang nghiệp vụ có thư mục riêng dưới `src/features/<slug>/`.
- Không chứa dữ liệu nhân sự/lương đã import, không có dữ liệu seed.
- Không kết nối Supabase mặc định; chỉ kết nối khi một module được thiết kế và duyệt riêng.

## Chạy local
1. Cài Node.js LTS.
2. Chạy `npm install`.
3. Chạy `npm run dev`.
4. Kiểm tra production bằng `npm run build`.

## Cấu trúc
- `src/app/`: khung ứng dụng và cấu trúc menu.
- `src/features/<slug>/Page.jsx`: trang độc lập của từng tính năng.
- `src/features/<slug>/components/`: component riêng.
- `src/features/<slug>/services/`: lớp truy cập dữ liệu riêng.
- `src/features/<slug>/styles/`: CSS riêng.
- `src/shared/`: component dùng chung.
- `public/logo-viet-au.png`: logo.

## Supabase Auth (giai đoạn nền tảng)
- Đăng nhập bằng email/mật khẩu qua Supabase Auth; phiên đăng nhập được lưu và tự làm mới bởi SDK.
- Cấu hình biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong Cloudflare Pages > Settings > Variables and Secrets, sau đó chạy lại deployment.
- Chỉ dùng publishable/anon key ở frontend; tuyệt đối không đặt `service_role` key trong biến `VITE_*`.
- Chức năng đăng nhập không tự tạo tài khoản. Tài khoản phải tồn tại trong Supabase Auth.
- Bản vá này chưa triển khai kiểm tra vai trò từ `public.app_users` hoặc ẩn/hiện module theo quyền; cần xác nhận schema cột và ánh xạ UID trước khi bật phân quyền nghiệp vụ.

## Dữ liệu
Bộ mã nguồn này không có bản ghi dữ liệu import và không tự xóa dữ liệu trên Supabase. Nếu cần xóa dữ liệu ở backend cũ, phải xác định project, bảng và phạm vi dữ liệu trước khi thao tác.

## Đưa bộ khung lên GitHub mới

Repository đích dự kiến: `https://github.com/fbhoangson-commits/viet-au-payroll`

1. Tải ZIP và giải nén vào một thư mục riêng.
2. Mở thư mục đã giải nén trong VS Code.
3. Mở Terminal tại thư mục đó và chạy lần lượt:

```powershell
git init
git add .
git commit -m "Initialize Viet Au Payroll clean base"
git branch -M main
git remote add origin https://github.com/fbhoangson-commits/viet-au-payroll.git
git push -u origin main
```

Nếu Git báo `remote origin already exists`, chạy `git remote set-url origin https://github.com/fbhoangson-commits/viet-au-payroll.git` rồi chạy lại lệnh push. Nếu Git yêu cầu đăng nhập, hoàn tất xác thực GitHub trong trình duyệt.

Repository cần đang trống như Sơn đã xác nhận. Các lệnh trên sẽ tạo commit đầu tiên; chúng không xóa Supabase hay Cloudflare.
