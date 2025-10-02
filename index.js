require('dotenv').config();
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const db = require('./db');

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

// Start va help komandalari uchun qo'llanma
const helpText = `👋 Xush kelibsiz! Bu moliyaviy hisobotlar botiga!

📝 Bot imkoniyatlari:
1. 💸 Xarajatlarni qo'shish va kuzatish
2. 💰 Daromadlarni qo'shish va kuzatish
3. 📊 Joriy balansni ko'rish
4. 📈 Kunlik/Oylik hisobotlarni olish
5. ⚙️ Xarajat limitini o'rnatish

🔍 Asosiy buyruqlar:
/start - Botni ishga tushirish
/help - Yordam olish
/cancel - Joriy amalni bekor qilish

💡 Maslahat: 
- Xarajat va daromadlarni muntazam kiritib boring
- Xarajat limitini o'rnatish orqali ortiqcha xarajatlarni nazorat qiling
- Hisobotlarni ko'rib chiqish orqali moliyaviy holatni tahlil qiling
    
Boshlash uchun quyidagi menyudan kerakli bo'limni tanlang! 👇`;

bot.command(["start", "help"], async (ctx) => {
    const helpText = `👋 Xush kelibsiz! Bu moliyaviy hisobotlar botiga!

📝 Bot imkoniyatlari:
1. 💸 Xarajatlarni qo'shish va kuzatish
2. 💰 Daromadlarni qo'shish va kuzatish
3. 📊 Joriy balansni ko'rish
4. 📈 Kunlik/Oylik hisobotlarni olish
5. ⚙️ Xarajat limitini o'rnatish

🔍 Asosiy buyruqlar:
/start - Botni ishga tushirish
/help - Yordam olish
/cancel - Joriy amalni bekor qilish

💡 Maslahat: 
- Xarajat va daromadlarni muntazam kiritib boring
- Xarajat limitini o'rnatish orqali ortiqcha xarajatlarni nazorat qiling
- Hisobotlarni ko'rib chiqish orqali moliyaviy holatni tahlil qiling

Boshlash uchun quyidagi menyudan kerakli bo'limni tanlang! 👇`;

    await ctx.reply(helpText);
    await showMainMenu(ctx);
});

// --- Asosiy Menyu ---
const mainMenuText = (firstName) => `👋 Assalomu alaykum, ${firstName}!\n\nQuyidagi amallardan birini tanlang:`;
const mainMenu = new InlineKeyboard()
    .text("💸 Xarajat qo'shish", "add_expense_action").row()
    .text("💰 Daromad qo'shish", "add_income_action").row()
    .text("📊 Balansni ko'rish", "balance_action").row()
    .text("📈 Hisobot", "report_action").row()
    .text("⚙️ Xarajat limitini sozlash", "set_limit_action");

async function showMainMenu(ctx, editMessage = false) {
    const text = mainMenuText(ctx.from.first_name);
    try {
        if (editMessage && ctx.callbackQuery) {
            await ctx.editMessageText(text, { reply_markup: mainMenu });
        } else {
            await ctx.reply(text, { reply_markup: mainMenu });
        }
    } catch (error) {
        await ctx.reply(text, { reply_markup: mainMenu });
    }
}

// --- Suhbatlar ---
async function expenseConversation(conversation, ctx) {
    try {
        await ctx.reply("Xarajat nomini kiriting (bekor qilish uchun /cancel):", {
            reply_markup: { remove_keyboard: true }
        });
        
        let nameCtx = await conversation.waitFor('message:text');
        if (nameCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }
        const name = nameCtx.message.text;

        await ctx.reply("Summasini kiriting (faqat raqam):");
        let amountCtx = await conversation.waitFor('message:text');
        if (amountCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }
        const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("Noto'g'ri summa kiritildi. Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }

        const categories = ["Oziq-ovqat", "Transport", "Ko'ngilochar", "Kommunal", "Boshqa"];
        const keyboard = new Keyboard().resized().oneTime();
        categories.forEach(cat => keyboard.text(cat).row());
        await ctx.reply("Kategoriyani tanlang:", { reply_markup: keyboard });

        let categoryCtx = await conversation.waitFor('message:text');
        if (categoryCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }
        const category = categoryCtx.message.text;

        if (!categories.includes(category)) {
            await ctx.reply("Noto'g'ri kategoriya tanlandi. Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.addExpense(ctx.from.id, name, amount, category);
        await ctx.reply(`✅ Xarajat muvaffaqiyatli qo'shildi!\n\n📝 Nomi: ${name}\n💰 Summa: ${amount.toLocaleString('uz-UZ')} so'm\n🏷 Kategoriya: ${category}`, {
            reply_markup: { remove_keyboard: true }
        });

        // Xarajat limitini tekshirish
        const limitInfo = await db.checkExpenseLimit(ctx.from.id);
        if (limitInfo?.limitExceeded && !limitInfo.notificationSent) {
            const excess = limitInfo.currentExpenses - limitInfo.monthlyLimit;
            await ctx.reply(
                `⚠️ Diqqat! Siz belgilangan oylik xarajat limitidan oshib ketdingiz!\n\n` +
                `Limit: ${limitInfo.monthlyLimit.toLocaleString('uz-UZ')} so'm\n` +
                `Joriy xarajat: ${limitInfo.currentExpenses.toLocaleString('uz-UZ')} so'm\n` +
                `Limitdan oshgan summa: ${excess.toLocaleString('uz-UZ')} so'm`
            );
        }
    } catch (error) {
        console.error("Xarajat qo'shishda xatolik:", error);
        await ctx.reply("Xatolik yuz berdi. Qaytadan urinib ko'ring.", { reply_markup: { remove_keyboard: true } });
    } finally {
        await showMainMenu(ctx);
    }
}

async function incomeConversation(conversation, ctx) {
    try {
        await ctx.reply("Daromad manbasini kiriting (bekor qilish uchun /cancel):", {
            reply_markup: { remove_keyboard: true }
        });
        
        let sourceCtx = await conversation.waitFor('message:text');
        if (sourceCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.");
            return;
        }
        const source = sourceCtx.message.text;

        await ctx.reply("Summasini kiriting (faqat raqam):");
        let amountCtx = await conversation.waitFor('message:text');
        if (amountCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.");
            return;
        }
        const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("Noto'g'ri summa kiritildi. Jarayon bekor qilindi.");
            return;
        }

        await db.addIncome(ctx.from.id, source, amount);
        await ctx.reply(`✅ Daromad muvaffaqiyatli qo'shildi!\n\n📝 Manba: ${source}\n💰 Summa: ${amount.toLocaleString('uz-UZ')} so'm`);
    } catch (error) {
        console.error("Daromad qo'shishda xatolik:", error);
        await ctx.reply("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
        await showMainMenu(ctx);
    }
}

async function setLimitConversation(conversation, ctx) {
    try {
        await ctx.reply("Oylik xarajat limitini kiriting (faqat raqam):");
        const amountCtx = await conversation.waitFor('message:text');
        
        if (amountCtx.message.text.startsWith('/')) {
            await ctx.reply("Jarayon bekor qilindi.");
            return;
        }

        const limit = parseFloat(amountCtx.message.text.replace(',', '.'));
        if (isNaN(limit) || limit <= 0) {
            await ctx.reply("Noto'g'ri summa kiritildi. Jarayon bekor qilindi.");
            return;
        }

        await db.setExpenseLimit(ctx.from.id, limit);
        await ctx.reply(`✅ Oylik xarajat limiti ${limit.toLocaleString('uz-UZ')} so'mga o'rnatildi.`);
    } catch (error) {
        console.error("Limit o'rnatishda xatolik:", error);
        await ctx.reply("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
        await showMainMenu(ctx);
    }
}

bot.use(createConversation(expenseConversation));
bot.use(createConversation(incomeConversation));
bot.use(createConversation(setLimitConversation));

// --- Buyruqlar ---
bot.command("start", async (ctx) => {
    await ctx.conversation.exit();
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    await showMainMenu(ctx);
});

bot.command("cancel", async (ctx) => {
    await ctx.conversation.exit();
    await ctx.reply("Barcha amallar bekor qilindi.", {
        reply_markup: { remove_keyboard: true }
    });
    await showMainMenu(ctx);
});

// --- Tugmalar ---
bot.on("callback_query:data", async (ctx) => {
    const action = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    try {
        switch (action) {
            case "add_expense_action":
                await ctx.reply("💸 Xarajat qo'shish jarayoni boshlanmoqda...");
                await ctx.conversation.enter("expenseConversation");
                break;

            case "add_income_action":
                await ctx.reply("💰 Daromad qo'shish jarayoni boshlanmoqda...");
                await ctx.conversation.enter("incomeConversation");
                break;

            case "balance_action":
                const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
                await ctx.reply(
                    `<b>📊 Umumiy Balans</b>\n\n` +
                    `⬆️ Daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
                    `⬇️ Xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n\n` +
                    `💰 Balans: <b>${balance.toLocaleString('uz-UZ')} so'm</b>`,
                    { parse_mode: "HTML" }
                );
                await showMainMenu(ctx);
                break;

            case "report_action":
                const reportKeyboard = new InlineKeyboard()
                    .text("Haftalik", "report_week")
                    .text("Oylik", "report_month").row()
                    .text("⬅️ Orqaga", "back_to_main");
                await ctx.reply("Qaysi davr uchun hisobot kerak?", { reply_markup: reportKeyboard });
                break;

            case "set_limit_action":
                const currentLimit = await db.getExpenseLimit(ctx.from.id);
                if (currentLimit) {
                    await ctx.reply(
                        `Joriy oylik limitingiz: ${currentLimit.toLocaleString('uz-UZ')} so'm\n\n` +
                        `Yangi limit o'rnatish uchun davom eting:`
                    );
                }
                await ctx.conversation.enter("setLimitConversation");
                break;

            case "back_to_main":
                await showMainMenu(ctx, true);
                break;

            case "report_week":
            case "report_month":
                const period = action.split('_')[1];
                const report = await db.getReport(ctx.from.id, period);
                let reportText = `<b>📈 ${period === 'week' ? 'Haftalik' : 'Oylik'} Hisobot</b>\n\n`;
                
                if (report.expensesByCategory.length > 0) {
                    reportText += "<b>Xarajatlar kategoriyalar bo'yicha:</b>\n";
                    report.expensesByCategory.forEach(item => {
                        reportText += `  - ${item.category}: ${parseFloat(item.total).toLocaleString('uz-UZ')} so'm\n`;
                    });
                } else {
                    reportText += "Bu davrda xarajatlar bo'lmagan.\n";
                }
                
                reportText += `\n⬆️ Daromad: ${report.totalIncome.toLocaleString('uz-UZ')} so'm\n`;
                reportText += `⬇️ Xarajat: ${report.totalExpense.toLocaleString('uz-UZ')} so'm\n`;
                reportText += `💰 Balans: <b>${report.netBalance.toLocaleString('uz-UZ')} so'm</b>`;
                
                await ctx.reply(reportText, { parse_mode: "HTML" });
                await showMainMenu(ctx);
                break;
        }
    } catch (error) {
        console.error("Callback query ishlovida xatolik:", error);
        await ctx.reply("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
        await showMainMenu(ctx);
    }
});

// --- Xatoliklarni ushlash ---
bot.catch(async (err) => {
    const ctx = err.ctx;
    console.error(`Error for update ${ctx.update.update_id}:`, err.error);
    if (ctx) {
        await ctx.reply("Xatolik yuz berdi. /start buyrug'i bilan qayta boshlang.").catch(console.error);
    }
});

// --- Botni ishga tushirish ---
async function startBot() {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    bot.start({
        drop_pending_updates: true,
        onStart: (botInfo) => console.log(`Bot @${botInfo.username} ishga tushdi...`),
    });
}

startBot();