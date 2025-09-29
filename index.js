require('dotenv').config();
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const db = require('./db');

const bot = new Bot(process.env.BOT_TOKEN);

// Session va Conversation middleware'larini o'rnatish
bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

// --- Suhbatlar (Conversations) ---

// Xarajat qo'shish suhbati
async function addExpenseConversation(conversation, ctx) {
    await ctx.reply("Xarajat nomini kiriting:");
    const nameCtx = await conversation.waitFor('message:text');
    const name = nameCtx.message.text;

    await ctx.reply("Summasini kiriting (faqat raqam):");
    const amountCtx = await conversation.waitFor('message:text');
    const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply("Noto'g'ri summa kiritildi. Iltimos, musbat raqam kiriting.");
        return;
    }

    const categories = ["Oziq-ovqat", "Transport", "Ko'ngilochar", "Kommunal", "Boshqa"];
    const keyboard = new Keyboard().resized().oneTime();
    categories.forEach(cat => keyboard.text(cat).row());
    await ctx.reply("Kategoriyani tanlang:", { reply_markup: keyboard });
    
    const categoryCtx = await conversation.waitFor('message:text');
    const category = categoryCtx.message.text;

    if (!categories.includes(category)) {
        await ctx.reply("Iltimos, quyidagi kategoriyalardan birini tanlang.", { reply_markup: { remove_keyboard: true } });
        return;
    }

    await db.addExpense(ctx.from.id, name, amount, category);
    await ctx.reply(`✅ "${name}" nomli ${amount.toLocaleString('uz-UZ')} so'mlik xarajat "${category}" kategoriyasiga qo'shildi.`, {
        reply_markup: { remove_keyboard: true },
    });
}

// Daromad qo'shish suhbati
async function addIncomeConversation(conversation, ctx) {
    await ctx.reply("Daromad manbasini kiriting (masalan: Ish haqi):");
    const sourceCtx = await conversation.waitFor('message:text');
    const source = sourceCtx.message.text;

    await ctx.reply("Summasini kiriting (faqat raqam):");
    const amountCtx = await conversation.waitFor('message:text');
    const amount = parseFloat(amountCtx.message.text.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
        await ctx.reply("Noto'g'ri summa kiritildi. Iltimos, musbat raqam kiriting.");
        return;
    }

    await db.addIncome(ctx.from.id, source, amount);
    await ctx.reply(`✅ "${source}" manbasidan ${amount.toLocaleString('uz-UZ')} so'mlik daromad qo'shildi.`);
}

bot.use(createConversation(addExpenseConversation));
bot.use(createConversation(addIncomeConversation));

// --- Asosiy Menyu ---

const mainMenu = new InlineKeyboard()
    .text("💸 Xarajat qo'shish", "add_expense_action").row()
    .text("💰 Daromad qo'shish", "add_income_action").row()
    .text("📊 Balansni ko'rish", "balance_action").row()
    .text("📈 Hisobot", "report_action");

// --- Buyruq Handler'lari ---

// /start buyrug'i
bot.command("start", async (ctx) => {
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    await ctx.reply(
        `Assalomu alaykum, ${ctx.from.first_name}! Shaxsiy moliya botiga xush kelibsiz!\n\nQuyidagi amallardan birini tanlang:`,
        { reply_markup: mainMenu }
    );
});

// /add_expense buyrug'i (qo'shimcha qulaylik uchun)
bot.command("add_expense", async (ctx) => {
    await ctx.conversation.enter("addExpenseConversation");
});

// /add_income buyrug'i (qo'shimcha qulaylik uchun)
bot.command("add_income", async (ctx) => {
    await ctx.conversation.enter("addIncomeConversation");
});

// /balance buyrug'i (qo'shimcha qulaylik uchun)
bot.command("balance", async (ctx) => {
    const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
    await ctx.reply(
        `<b>📊 Umumiy Balans</b>\n\n` +
        `⬆️ Umumiy daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
        `⬇️ Umumiy xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n\n` +
        `💰 Sof balans: <b>${balance.toLocaleString('uz-UZ')} so'm</b>`,
        { parse_mode: "HTML" }
    );
});

// /report buyrug'i (qo'shimcha qulaylik uchun)
bot.command("report", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("Haftalik", "report_week")
        .text("Oylik", "report_month");
    await ctx.reply("Qaysi davr uchun hisobot kerak?", { reply_markup: keyboard });
});

// --- Tugma Handler'lari (Callback Queries) ---

// Xarajat qo'shish tugmasi
bot.callbackQuery("add_expense_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("addExpenseConversation");
});

// Daromad qo'shish tugmasi
bot.callbackQuery("add_income_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("addIncomeConversation");
});

// Balansni ko'rish tugmasi
bot.callbackQuery("balance_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
    await ctx.reply(
        `<b>📊 Umumiy Balans</b>\n\n` +
        `⬆️ Umumiy daromad: ${totalIncome.toLocaleString('uz-UZ')} so'm\n` +
        `⬇️ Umumiy xarajat: ${totalExpense.toLocaleString('uz-UZ')} so'm\n\n` +
        `💰 Sof balans: <b>${balance.toLocaleString('uz-UZ')} so'm</b>`,
        { parse_mode: "HTML" }
    );
    await ctx.reply("Boshqa amalni tanlang:", { reply_markup: mainMenu });
});

// Hisobot tugmasi
bot.callbackQuery("report_action", async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard()
        .text("Haftalik", "report_week")
        .text("Oylik", "report_month");
    await ctx.reply("Qaysi davr uchun hisobot kerak?", { reply_markup: keyboard });
});

// Hisobot davrini tanlash tugmasi
bot.callbackQuery(/report_(week|month)/, async (ctx) => {
    await ctx.answerCallbackQuery();
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
    reportText += `💰 Sof balans: <b>${netBalance.toLocaleString('uz-UZ')} so'm</b>`;

    // editMessageText o'rniga reply ishlatamiz, chunki avvalgi xabar "Qaysi davr..." edi
    await ctx.reply(reportText, { parse_mode: "HTML" });
    await ctx.reply("Boshqa amalni tanlang:", { reply_markup: mainMenu });
});


// --- Xatoliklarni ushlash ---
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
});

// Botni ishga tushirish
bot.start();
console.log("Bot ishga tushdi...");