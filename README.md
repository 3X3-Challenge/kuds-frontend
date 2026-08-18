# kuds-frontend — Trang quản trị "3x3 Ký Ức Di Sản"

Giao diện quản trị cho [`kuds-backend`](../kuds-backend). React + TypeScript + Vite + Tailwind v4,
gọi thẳng nhóm route `/admin/*` của backend bằng token quản trị.

## Chạy

```bash
npm install
cp .env.example .env      # sửa VITE_API_BASE_URL nếu backend không ở localhost:3000
npm run dev               # http://localhost:3001
npm run build             # build ra dist/
npm run preview           # xem thử bản build
npm run typecheck         # tsc --noEmit
```

Cổng **3001** khớp với `CORS_ORIGINS` mặc định trong `.env` của backend. Đổi cổng ở
`vite.config.ts` thì phải đổi luôn `CORS_ORIGINS` bên kia, nếu không trình duyệt chặn mọi request
trước khi nó rời máy.

Chưa có tài khoản quản trị nào thì tạo từ phía backend (đường vào duy nhất — API tạo admin lại cần
token publisher):

```bash
cd ../kuds-backend
npm run admin:create -- admin@kuds.test mat-khau-that-dai publisher "Tên hiển thị"
```

## Đăng nhập và quyền

Token lấy từ `POST /admin/auth/login`, lưu ở `localStorage["kuds_admin_token"]`, gắn vào mọi
request dưới dạng `Authorization: Bearer`. **Không có refresh token** — token sống 8 tiếng
(`ADMIN_TOKEN_TTL`) rồi phải đăng nhập lại; mọi phản hồi 401 đều bị coi là hết phiên và đá về trang
đăng nhập, nhớ lại đường dẫn đang đứng để quay lại sau khi đăng nhập.

Ba mức quyền, đúng như `requireAdmin` bên backend (viewer ⊂ editor ⊂ publisher):

| Quyền | Làm được gì trong trang này |
|---|---|
| `viewer` | Xem mọi danh sách, biểu mẫu, nhật ký, kết quả kiểm tra trước khi xuất bản |
| `editor` | Thêm / sửa / lưu trữ nội dung của 12 bảng danh mục |
| `publisher` | Bấm Xuất bản, thao tác lên người chơi, gửi thư GM, quản lý tài khoản quản trị |

Giao diện **ẩn** nút mà quyền hiện tại không dùng được. Đó chỉ là để không mời người ta bấm vào chỗ
chắc chắn trả về 403 — chốt chặn thật nằm ở backend.

## Trang

| Đường dẫn | Nội dung |
|---|---|
| `/` | Tổng quan: số người chơi, nội dung đã xuất bản, bản nháp đang chờ, số lỗi/cảnh báo |
| `/content/:resource` | Danh sách một bảng danh mục: tìm kiếm, lọc trạng thái, phân trang, lưu trữ |
| `/content/:resource/new`, `/content/:resource/:id` | Biểu mẫu thêm/sửa |
| `/players`, `/players/:playerId` | Tra cứu người chơi; cấm/gỡ cấm, cộng trừ tiền, tặng vật phẩm |
| `/mail` | Gửi thư GM cho danh sách người chơi hoặc toàn server |
| `/publish` | Kiểm tra trước khi xuất bản + nút xuất bản |
| `/audit` | Nhật ký thao tác, phân trang bằng con trỏ, xem JSON trước/sau |
| `/admins` | Tài khoản quản trị (chỉ publisher) |

## Kiến trúc

```
src/
  lib/          api.ts (lớp fetch duy nhất) · auth.tsx · toast.tsx · types.ts · labels.ts · format.ts
  resources/    types.ts (kiểu khai báo) · index.tsx (12 bảng danh mục) · form.ts (giá trị mặc định, diff)
  components/   ui.tsx · Layout · Modal · FormFields (vẽ ô nhập theo khai báo) · ResourceForm
  pages/        mỗi trang một file
```

Hai điểm đáng biết trước khi sửa:

**1. Mười hai bảng danh mục dùng CHUNG một trang danh sách và một biểu mẫu.** Backend đã gom chúng
vào `/admin/content/:resource` với một sổ đăng ký duy nhất; frontend soi gương đúng như vậy. Khác
biệt giữa các bảng — cột nào hiện, ô nào nhập, đọc dòng API ra giá trị biểu mẫu thế nào — nằm hết
trong `src/resources/index.tsx`. Backend thêm bảng mới thì ở đây thêm một mục vào `RESOURCE_SPECS`,
không đụng tới trang nào.

Đây là hợp đồng chép **tay** từ các Zod schema bên backend; hai repo tách nhau nên không sinh tự
động được. Quên cập nhật thì backend vẫn chặn bằng 400 kèm lỗi theo từng trường, và biểu mẫu tô đúng
ô sai — sai lệch lộ ra ngay chứ không âm thầm ghi hỏng dữ liệu.

**2. Sửa thì chỉ gửi phần đã đổi.** `PATCH` của backend là partial: trường vắng mặt nghĩa là không
đụng tới. Gửi cả biểu mẫu sẽ ghi đè những thứ mình không định sửa, và với vài trường thì còn hỏng
hẳn:

- `equip` gửi `null` khi vật phẩm vốn không có hồ sơ trang bị ⇒ Prisma chạy `delete` lên một dòng
  không tồn tại và trả lỗi.
- `shelfLifeSeconds` (vật phẩm) và `ttlSeconds` (mẫu thư) là cột `interval` của Postgres, **API
  không đọc lại được** nên ô luôn hiện trống; gửi kèm sẽ xoá sạch giá trị đang có. Để trống = giữ
  nguyên.
- `objectives` / `lines` / `entries` xoá rồi tạo lại toàn bộ dòng con, kéo theo tiến độ người chơi.

Ngược lại, lúc **tạo mới** thì trường trống mà lược đồ không cho `null` sẽ bị bỏ khỏi payload, để
`.default(...)` của Zod chạy được (`activeFrom` nhận mặc định "bây giờ" thay vì ăn lỗi "Invalid
date").

## Vài chỗ dễ vấp

- **Xuất bản không phải nút bật/tắt nội dung.** Một dòng chuyển sang `published` là ra tới người chơi
  ngay. Nút Xuất bản chỉ tăng `content.config_state.version` để client biết đã đến lúc tải lại danh
  mục.
- **Nút xoá là nút lưu trữ.** Bảng có cột trạng thái thì "xoá" nghĩa là chuyển `archived`; bảng không
  có (crop, npc, pattern, gacha-item, reward-bundle) mới xoá thật, và bị khoá ngoại chặn nếu đang có
  dữ liệu trỏ tới.
- **Thưởng trong thư GM không gõ tay được.** Phải trỏ tới một gói thưởng có sẵn — backend chụp lại
  nội dung gói ngay lúc gửi và lưu kèm nguồn gốc để đối soát về sau. Muốn combo mới thì tạo gói ở
  `/content/reward-bundles` trước.
- **Vô hiệu hoá một admin không đá họ ra ngay.** Token đã phát vẫn sống tới khi hết hạn (tối đa 8
  tiếng). Cần chặn tức thì thì đổi `ADMIN_JWT_SECRET` bên backend — thu hồi toàn bộ token.

## Triển khai

`npm run build` ra `dist/` là tệp tĩnh. Đây là SPA dùng đường dẫn thật (không hash), nên máy chủ
tĩnh phải trả `index.html` cho mọi đường dẫn không khớp tệp — thiếu bước này thì mở thẳng
`/players/<id>` sẽ ra 404. Nhớ đặt `VITE_API_BASE_URL` lúc build (biến của Vite được nhúng vào bundle
khi build, không đọc lúc chạy) và thêm origin thật vào `CORS_ORIGINS` của backend.
