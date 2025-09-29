require('dotenv').config();
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const db = require('./db');

const bot = new Bot(process.env.BOT_TOKEN);

// Session va Conversation middleware'larini o'rnatish
bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

// --- Asosiy Menyu ---
const mainMenuText = (firstName) => `Assalomu alaykum, ${firstName}! Shaxsiy moliya botiga xush kelibsiz!\n\nQuyidagi amallardan birini tanlang:`;
const mainMenu = new InlineKeyboard()
    .text("💸 Xarajat qo'shish", "add_expense_action").row()
    .text("💰 Daromad qo'shish", "add_income_action").row()
    .text("📊 Balansni ko'rish", "balance_action").row()
    .text("📈 Hisobot", "report_action");

async function sendOrEditMainMenu(ctx) {
    const text = mainMenuText(ctx.from.first_name);
    if (ctx.callbackQuery) {
        // Agar tugma bosilgan bo'lsa, eski xabarni tahrirlaymiz
        await ctx.editMessageText(text, { reply_markup: mainMenu }).catch(console.error);
    } else {
        // Agar buyruq kelsa, yangi xabar yuboramiz
        await ctx.reply(text, { reply_markup: mainMenu });
    }
}

// --- Suhbatlar (Conversations) ---
async function addExpenseConversation(conversation, ctx) {
    try {
        await ctx.reply("Xarajat nomini kiriting (bekor qilish uchun /cancel):");
        let nameCtx = await conversation.waitFor('message:text');
        const name = nameCtx.message.text;

        await ctx.reply("Summasini kiriting (faqat raqam):");
        let amountCtx = await conversation.waitFor('message:text');
        const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("Noto'g'ri summa kiritildi. Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }

        const categories = ["Oziq-ovqat", "Transport", "Ko'ngilochar", "Kommunal", "Boshqa"];
        const keyboard = new Keyboard().resized().oneTime();
        categories.forEach(cat => keyboard.text(cat).row());
        await ctx.reply("Kategoriyani tanlang:", { reply_markup: keyboard });
        
        const categoryCtx = await conversation.waitFor('message:text');
        const category = categoryCtx.message.text;

        if (!categories.includes(category)) {
            await ctx.reply("Iltimos, taqdim etilgan tugmalardan birini bosing. Jarayon bekor qilindi.", { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.addExpense(ctx.from.id, name, amount, category);
        await ctx.reply(`✅ Xarajat muvaffaqiyatli qo'shildi!`, { reply_markup: { remove_keyboard: true } });

    } catch (e) {
        await ctx.reply("Jarayon bekor qilindi yoki vaqt tugadi.", { reply_markup: { remove_keyboard: true } });
    } finally {
        await sendOrEditMainMenu(ctx);
    }
}

async function addIncomeConversation(conversation, ctx) {
    try {
        await ctx.reply("Daromad manbasini kiriting (bekor qilish uchun /cancel):");
        let sourceCtx = await conversation.waitFor('message:text');
        const source = sourceCtx.message.text;

        await ctx.reply("Summasini kiriting (faqat raqam):");
        let amountCtx = await conversation.waitFor('message:text');
        const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

        if (isNaN(amount) || amount <= 0) {
            await ctx.reply("Noto'g'ri summa kiritildi. Jarayon bekor qilindi.");
            return;
        }

        await db.addIncome(ctx.from.id, source, amount);
        await ctx.reply(`✅ Daromad muvaffaqiyatli qo'shildi!`);
    } catch (e) {
        await ctx.reply("Jarayon bekor qilindi yoki vaqt tugadi.");
    } finally {
        await sendOrEditMainMenu(ctx);
    }
}

bot.use(createConversation(addExpenseConversation));
bot.use(createConversation(addIncomeConversation));

// --- Buyruq Handler'lari ---
bot.command("start", async (ctx) => {
    await ctx.conversation.exit();
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    await sendOrEditMainMenu(ctx);
});

bot.command("cancel", async (ctx) => {
    await ctx.conversation.exit();
    await ctx.reply("Barcha amallar bekor qilindi.");
    await sendOrEditMainMenu(ctx);
});

// --- Tugma Handler'lari (Callback Queries) ---
bot.callbackQuery("add_expense_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("💸 Xarajat qo'shish jarayoni boshlandi...");
    await ctx.conversation.enter("addExpenseConversation");
});

bot.callbackQuery("add_income_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("💰 Daromad qo'shish jarayoni boshlandi...");
    await ctx.conversation.enter("addIncomeConversation");
});

bot.callbackQuery("balance_action", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏳ Balans hisoblanmoqda..." });
    const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
    const text = `<b>📊 Umumiy Balans</b>\n\n` +
                 `⬆️ Umumiy daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
                 `⬇️ Umumiy xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n\n` +
                 `💰 Sof balans: <b>${balance.toLocaleString('uz-UZ')} so'm</b>\n\n` +
                 `Quyidagi amallardan birini tanlang:`;
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: mainMenu });
});

bot.callbackQuery("report_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard()
        .text("Haftalik", "report_week").text("Oylik", "report_month").row()
        .text("⬅️ Asosiy menyu", "back_to_main");
    await ctx.editMessageText("Qaysi davr uchun hisobot kerak?", { reply_markup: keyboard });
});

bot.callbackQuery("back_to_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendOrEditMainMenu(ctx);
});

bot.callbackQuery(/report_(week|month)/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "⏳ Hisobot tayyorlanmoqda..." });
    const period = ctx.match[1];
    const { expensesByCategory, totalIncome, totalExpense, netBalance } = await db.getReport(ctx.from.id, period);

    let reportText = `<b>📈 ${period === 'week' ? 'Haftalik' : 'Oylik'} Hisobot</b>\n\n`;
    if (expensesByCategory.length > 0) {
        reportText += "<b>Xarajatlar kategoriyalar bo'yicha:</b>\n";
        expensesByCategory.forEach(item => {
            reportText += `  - ${item.category}: ${parseFloat(item.total).toLocaleString('uz-UZ')} so'm\n`;
        });
    } else {
        reportText += "Bu davrda xarajatlar bo'lmagan.\n";
    }
    reportText += `\n⬆️ Umumiy daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n`;
    reportText += `⬇️ Umumiy xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n`;
    reportText += `💰 Sof balans: <b>${netBalance.toLocaleString('uz-UZ')} so'm</b>\n\n`;
    reportText += `Quyidagi amallardan birini tanlang:`;

    await ctx.editMessageText(reportText, { parse_mode: "HTML", reply_markup: mainMenu });
});

// --- Xatoliklarni ushlash ---
bot.catch(async (err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
    await ctx.reply("Xatolik yuz berdi. Iltimos, /start buyrug'ini yuborib, qaytadan urunib ko'ring.").catch(console.error);
});

// Botni ishga tushirish
async function startBot() {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    bot.start({
        drop_pending_updates: true,
        onStart: (botInfo) => {
            console.log(`Bot @${botInfo.username} ishga tushdi...`);
        },
    });
}

startBot();