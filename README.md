# HCMUTE Course Registration Monitor

Chrome/Edge extension (Manifest V3) để cấu hình nhiều mã lớp học phần, thử đăng ký theo chu kỳ tối thiểu 5 giây và xem phản hồi API trên một trang trạng thái riêng.

## Cài đặt

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và trỏ đến thư mục này.
4. Bấm biểu tượng extension, chọn **Mở trang trạng thái**.
5. Mở `https://dkmh.hcmute.edu.vn`, đăng nhập và thao tác tìm/mở một lớp để cổng phát sinh request API.
6. Mở dashboard. Extension tự lấy token, API key, client ID, `StudyProgramID`, `TurnID` và `Action` từ phiên/request thật; không cần dán Bearer token.
7. Nhập danh sách mã lớp; lưu và bắt đầu.

Khuyến nghị không nhập mã thủ công: bấm **Hiện môn đã đăng ký** → **Hiện các lớp** ở môn cần đổi → **Thay đổi** tại lớp đích. Extension lưu object lớp đầy đủ và thử từng mục trong hàng đợi theo kiểu luân phiên, mỗi chu kỳ xử lý một lớp.

## Chuỗi API đã triển khai

1. `POST GetAllScheduleUnitAllowRegist` để lấy object lớp đầy đủ từ mã người dùng.
2. `POST CheckExitsRegistChange?TurnID=...&StudyProgramID=...` với mảng object lớp.
3. `POST RegistScheduleStudyUnit?TurnID=...&Action=CHANGE&StudyProgramID=...` với cùng payload.

`TurnID` không phải cấu hình người dùng: extension tự đọc trường `IdDot` từ `GET GetRegistSemesterCreditQuota?StudyProgramID=...` trước khi chạy.

Extension dừng thử riêng mã lớp khi phản hồi HTTP thành công và không phát hiện cờ/lời nhắn lỗi nghiệp vụ. Nhật ký giữ tối đa 300 dòng.

## Lưu ý vận hành

- Giữ trang trạng thái mở khi chạy. Manifest V3 không bảo đảm service worker chạy timer 5 giây khi không có trang mở.
- Không chia sẻ token. Token được lưu cục bộ trong `chrome.storage.local` của profile trình duyệt.
- Extension không có API key, client ID, TurnID hay StudyProgramID mặc định. Khi cổng thay đổi cấu hình, hãy thao tác trên cổng rồi bấm **Đồng bộ lại**.
- Chu kỳ 5 giây có thể vi phạm quy định/rate limit của cổng; chỉ chạy trong khung đăng ký và theo quy định của trường.
- Nếu API đổi schema hoặc trả HTTP 200 kèm thông báo lỗi mới, xem nhật ký và cập nhật hàm `isBusinessFailure` trong `dashboard.js`.
