# Hướng Dẫn Sử Dụng Web App & Console Extractor - Đăng Ký Học Phần HCMUTE

Hệ thống Đăng ký Lớp học phần HCMUTE được thiết kế chạy trực tiếp dưới dạng **Web Application (React + Shadcn UI)**, không cần cài đặt Chrome Extension.

---

## BƯỚC 1: Lấy Token & Thông Số Bằng Console (F12)

1. Truy cập trang web đăng ký học phần HCMUTE: **[https://dkmh.hcmute.edu.vn/](https://dkmh.hcmute.edu.vn/)** và tiến hành **Đăng nhập**.
2. Nhấn phím **F12** (hoặc chuột phải -> Chọn *Inspect* / *Kiểm tra*).
3. Chuyển sang tab **Console**.
4. Mở file [console_extract.js](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/console_extract.js), sao chép toàn bộ mã nguồn.
5. Dán (paste) vào Console và nhấn **Enter**.
6. Script sẽ tự động:
   - Trích xuất Session Token, MSSV, StudyProgramID.
   - Truy vấn tự động đợt đăng ký (`TurnID`), `RandID`, `Năm học` và `Học kỳ`.
   - **TỰ ĐỘNG SAO CHÉP** chuỗi cấu hình JSON vào Clipboard.
   - Hiển thị 1 bảng thông báo đẹp ngay góc màn hình trang gốc.

---

## BƯỚC 2: Khởi Chạy Web App & Dán Cấu Hình

### Khởi chạy local:
```bash
cd web-app
npm run dev
```
Trình duyệt sẽ tự động mở trang web tại `http://localhost:5173`.

### Sử dụng trên Web App:
1. Nhấn nút **"Dán JSON Cấu Hình"** ở góc phải trên cùng.
2. Dán (Ctrl + V) chuỗi JSON cấu hình vừa lấy từ Console (hoặc bấm nút *Tự động dán từ Clipboard*).
3. Bấm **"Áp Dụng Cấu Hình"**: Các thông số `StudyProgramID`, `TurnID`, `Session Token`, `MSSV` sẽ tự động điền.
4. Nhập mã môn/lớp học phần cần canh vào ô Bước 02 (hoặc qua Bước 03 để chọn trực tiếp từ danh sách môn đã đăng ký / môn KH / môn NKH).
5. Nhấn **"Bắt Đầu Chạy"**. Hệ thống sẽ kiểm tra sỉ số 5 giây / đợt và gửi API đăng ký ngay lập tức khi phát hiện có lớp nhả chỗ trống!

---

## Bảng Cấu Trúc Các File Đã Tạo

| File | Mô tả |
| :--- | :--- |
| [console_extract.js](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/console_extract.js) | Script dán lên F12 Console của `dkmh.hcmute.edu.vn` để trích xuất Session Token & TurnID |
| [web-app/src/App.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/App.jsx) | Code chính của Web App React + Shadcn UI |
| [web-app/src/components/Header.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/Header.jsx) | Topbar điều khiển với Badge và nút Dán JSON |
| [web-app/src/components/ImportModal.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/ImportModal.jsx) | Modal dán chuỗi JSON cấu hình |
| [web-app/src/components/ConfigPanel.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/ConfigPanel.jsx) | Bảng điều khiển cấu hình phiên & ô nhập môn |
| [web-app/src/components/CourseSelector.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/CourseSelector.jsx) | Tra cứu môn đã ĐK / môn KH / môn NKH & xem sỉ số |
| [web-app/src/components/QueuePanel.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/QueuePanel.jsx) | Hàng đợi theo dõi sỉ số môn |
| [web-app/src/components/LogTable.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/regis/web-app/src/components/LogTable.jsx) | Nhật ký giao dịch API thời gian thực |
