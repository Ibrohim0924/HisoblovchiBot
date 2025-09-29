require('dotenv').config();
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const db = require('./db');

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

// --- Asosiy Menyu ---
const mainMenuText = (firstName) => `Assalomu alaykum, ${firstName}! Asosiy menyu.\n\nQuyidagi amallardan birini tanlang:`;
const mainMenu = new InlineKeyboard()
    .text("💸 Xarajat qo'shish", "add_expense_action").row()
    .text("💰 Daromad qo'shish", "add_income_action").row()
    .text("📊 Balansni ko'rish", "balance_action").row()
    .text("📈 Hisobot", "report_action");

async function showMainMenu(ctx) {
    const text = mainMenuText(ctx.from.first_name);
    // Agar bu callback orqali kelgan bo'lsa, eski xabarni tahrirlaymiz
    if (ctx.callbackQuery) {
        try {
            await ctx.editMessageText(text, { reply_markup: mainMenu });
        } catch (e) {
            // Agar tahrirlash imkoni bo'lmasa (masalan, xabar juda eski), yangisini yuboramiz
            await ctx.reply(text, { reply_markup: mainMenu });
        }
    } else {
        await ctx.reply(text, { reply_markup: mainMenu });
    }
}

// --- Suhbatlar ---
async function expenseConversation(conversation, ctx) {
    try {
        await ctx.reply("Xarajat nomini kiriting (bekor qilish uchun /cancel):");
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
            await ctx.reply("Iltimos, tugmalardan birini bosing. Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.addExpense(ctx.from.id, name, amount, category);
        await ctx.reply(`✅ Xarajat muvaffaqiyatli qo'shildi!`, { reply_markup: { remove_keyboard: true } });
    } catch (e) {
        console.error("Suhbatda xatolik yoki vaqt tugashi:", e);
    } finally {
        // Jarayon tugagach, asosiy menyuni ko'rsatish
        await showMainMenu(ctx);
    }
}

async function incomeConversation(conversation, ctx) {
    try {
        await ctx.reply("Daromad manbasini kiriting (bekor qilish uchun /cancel):");
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
        await ctx.reply(`✅ Daromad muvaffaqiyatli qo'shildi!`);
    } catch (e) {
        console.error("Suhbatda xatolik yoki vaqt tugashi:", e);
    } finally {
        // Jarayon tugagach, asosiy menyuni ko'rsatish
        await showMainMenu(ctx);
    }
}

bot.use(createConversation(expenseConversation));
bot.use(createConversation(incomeConversation));

// --- Buyruqlar ---
bot.command("start", async (ctx) => {
    await ctx.conversation.exit();
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    await showMainMenu(ctx);
});

bot.command("cancel", async (ctx) => {
    await ctx.conversation.exit();
    await ctx.reply("Barcha amallar bekor qilindi.");
    await showMainMenu(ctx);
});

// --- Tugmalar ---
bot.on("callback_query:data", async (ctx) => {
    const action = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    switch (action) {
        case "add_expense_action":
            await ctx.editMessageText("💸 Xarajat qo'shish jarayoni boshlanmoqda...");
            await ctx.conversation.enter("expenseConversation");
            break;
        case "add_income_action":
            await ctx.editMessageText("💰 Daromad qo'shish jarayoni boshlanmoqda...");
            await ctx.conversation.enter("incomeConversation");
            break;
        case "balance_action":
            const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
            const balanceText = `<b>📊 Umumiy Balans</b>\n\n` +
                `⬆️ Daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
                `⬇️ Xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n\n` +
                `💰 Balans: <b>${balance.toLocaleString('uz-UZ')} so'm</b>`;
            await ctx.editMessageText(balanceText, { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("⬅️ Orqaga", "back_to_main") });
            break;
        case "report_action":
            const reportKeyboard = new InlineKeyboard()
                .text("Haftalik", "report_week").text("Oylik", "report_month").row()
                .text("⬅️ Orqaga", "back_to_main");
            await ctx.editMessageText("Qaysi davr uchun hisobot kerak?", { reply_markup: reportKeyboard });
            break;
        case "back_to_main":
            await showMainMenu(ctx);
            break;
        case "report_week":
        case "report_month":
            const period = action.split('_')[1];
            const report = await db.getReport(ctx.from.id, period);
            let reportText = `<b>📈 ${period === 'week' ? 'Haftalik' : 'Oylik'} Hisobot</b>\n\n`;
            if (report.expensesByCategory.length > 0) {
                report.expensesByCategory.forEach(item => {
                    reportText += `  - ${item.category}: ${parseFloat(item.total).toLocaleString('uz-UZ')} so'm\n`;
                });
            } else {
                reportText += "Bu davrda xarajatlar bo'lmagan.\n";
            }
            reportText += `\n⬆️ Daromad: ${report.totalIncome.toLocaleString('uz-UZ')} so'm\n`;
            reportText += `⬇️ Xarajat: ${report.totalExpense.toLocaleString('uz-UZ')} so'm\n`;
            reportText += `💰 Balans: <b>${report.netBalance.toLocaleString('uz-UZ')} so'm</b>`;
            await ctx.editMessageText(reportText, { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("⬅️ Orqaga", "back_to_main") });
            break;
    }
});

// --- Xatoliklar ---
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