# Shaxsiy Moliyaviy Hisob-kitob Boti

Bu loyiha — foydalanuvchilarning shaxsiy daromad va xarajatlarini kuzatib borishga yordam beruvchi Telegram bot. Bot `grammY` kutubxonasi yordamida Node.js da yaratilgan va ma'lumotlarni saqlash uchun PostgreSQL ma'lumotlar bazasidan foydalanadi.

## 🤖 Bot funksiyalari

- **Daromad qo'shish**: Daromad manbasi va summasini kiritish.
- **Xarajat qo'shish**: Xarajat nomi, summasi va kategoriyasini ("Oziq-ovqat", "Transport" va hokazo) kiritish.
- **Balansni ko'rish**: Umumiy daromad, umumiy xarajat va joriy balansni ko'rsatish.
- **Hisobot olish**: Tanlangan davr (hafta/oy) uchun xarajatlarning kategoriyalar bo'yicha taqsimoti, umumiy daromad, xarajat va sof balansni ko'rsatuvchi hisobotni shakllantirish.
- **Interaktiv menyu**: Barcha amallarni qulay `InlineKeyboard` tugmalari orqali boshqarish.

## 🛠 Texnologiyalar

- **Runtime**: Node.js
- **Telegram Bot Framework**: grammY
- **Ma'lumotlar bazasi**: PostgreSQL
- **Kutubxonalar**: `pg` (PostgreSQL drayveri), `dotenv` (muhit o'zgaruvchilari uchun), `@grammyjs/conversations` (ko'p bosqichli suhbatlar uchun).

## ⚙️ O'rnatish va ishga tushirish

Loyihani o'z kompyuteringizda ishga tushirish uchun quyidagi amallarni bajaring:

### 1. Talablar
- [Node.js](https://nodejs.org/) (v16 yoki undan yuqori)
- [PostgreSQL](https://www.postgresql.org/download/)

### 2. Loyihani sozlash
1.  Kerakli paketlarni o'rnating:
    ```bash
    npm install grammy @grammyjs/conversations pg dotenv
    ```

2.  PostgreSQL da `moliya_db` nomli yangi ma'lumotlar bazasini yarating.

3.  `database.sql` faylidagi SQL skriptni `moliya_db` bazasida ishga tushirib, kerakli jadvallarni yarating.


### 3. Botni ishga tushirish
Barcha sozlamalardan so'ng, botni quyidagi buyruq bilan ishga tushiring:

```bash
node index.js
```
Agar hamma narsa to'g'ri bajarilgan bo'lsa, terminalda "Bot ishga tushdi..." xabarini ko'rasiz.

## 🚀 Botdan foydalanish

1.  Telegramda botingizni toping va `/start` buyrug'ini yuboring.
2.  Paydo bo'lgan menyu tugmalari orqali kerakli amalni tanlang:
    - **💸 Xarajat qo'shish**
    - **💰 Daromad qo'shish**
    - **📊 Balansni ko'rish**
    - **📈 Hisobot**
3.  Botning savollariga javob berib, ma'lumotlarni kiriting.