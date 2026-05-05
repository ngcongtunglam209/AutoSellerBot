# Huong Dan Cai Dat va Su Dung AutoSellerBot

## 1. Cai dat ban dau

```bash
# Copy file .env
cp .env.example .env

# Chinh sua .env voi thong tin cua ban
nano .env
```

## 2. Cac bien .env can dien

| Bien | Mo ta | Vi du |
|------|-------|-------|
| BOT_TOKEN | Token bot tu BotFather | 123456:ABC... |
| ADMIN_IDS | Telegram ID cua admin | 123456789 |
| SEPAY_API_KEY | API Key tu my.sepay.vn | ... |
| SEPAY_ACCOUNT_NUMBER | So tai khoan ngan hang | 1234567890 |
| SEPAY_BANK_CODE | Ma ngan hang Sepay | VCB / TCB / MB / ... |
| SEPAY_ACCOUNT_NAME | Ten chu tai khoan | NGUYEN VAN A |
| WEBHOOK_URL | URL server nhan callback Sepay | https://yourdomain.com/webhook/sepay |
| PORT | Cong server | 3000 |
| ADMIN_PASSWORD | Mat khau admin (khong dung) | admin123 |
| ORDER_EXPIRY_MINUTES | Thoi gian het han don hang | 15 |

## 3. Lay ADMIN_IDS

Nhan tin cho @userinfobot tren Telegram, no se tra ve Telegram ID cua ban.

## 4. Cai dat Sepay

1. Dang ky tai https://my.sepay.vn
2. Them tai khoan ngan hang
3. Vao API > Tao API Key
4. Cai dat Webhook URL: `https://yourdomain.com/webhook/sepay`

## 5. Chay bot

```bash
# Dev mode
npm run dev

# Production voi PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 6. Lenh admin trong bot

- `/admin` - Mo admin panel
- Them account: dinh dang `login|password|ghi_chu|gia`
- Vi du: `user123|pass456|Nick dep|50000`
- Them nhieu: moi dong 1 account

## 7. Luong mua hang cua khach

1. /start -> Chon [Mua Tai Khoan]
2. Xem danh sach, bam chon account
3. Xac nhan -> Nhan QR VietQR
4. Chuyen khoan DUNG noi dung
5. He thong tu dong gui account sau khi xac nhan thanh toan

## 8. Cau truc thu muc

```
AutoSellerBot/
├── src/
│   ├── bot/handlers/   # Xu ly lenh bot
│   ├── services/       # Business logic
│   ├── db/             # Database SQLite
│   └── webhook/        # Nhan callback Sepay
├── data/               # File database (tu dong tao)
├── logs/               # Log PM2
├── index.js            # Entry point
└── ecosystem.config.js # PM2 config
```
