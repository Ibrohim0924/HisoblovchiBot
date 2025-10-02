require('dotenv').config();
const { Bot, GrammyError, HttpError, Keyboard, InlineKeyboard, session } = require('grammy');
const { conversations, createConversation } = require('@grammyjs/conversations');
const db = require('./db');

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'];
const DEFAULT_LANGUAGE = 'uz';
const LANGUAGE_PROMPT_TEXT = "🌐 Tilni tanlang / Выберите язык / Choose a language:";
const LANGUAGE_ALERT_TEXT = "Tilni tanlang / Choose language";

const numberFormatters = {
    uz: new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }),
    ru: new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }),
    en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
};

const categories = [
    { code: 'food', labels: { uz: "Oziq-ovqat", ru: "Продукты", en: "Food" } },
    { code: 'transport', labels: { uz: "Transport", ru: "Транспорт", en: "Transport" } },
    { code: 'entertainment', labels: { uz: "Ko'ngilochar", ru: "Развлечения", en: "Entertainment" } },
    { code: 'utilities', labels: { uz: "Kommunal", ru: "Коммунальные", en: "Utilities" } },
    { code: 'other', labels: { uz: "Boshqa", ru: "Другое", en: "Other" } },
];

const LOCALES = {
    uz: {
        label: "O'zbekcha",
        locale: 'uz-UZ',
        currency: "so'm",
        help: `👋 Xush kelibsiz! Bu moliyaviy hisobotlar botiga!

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

Boshlash uchun quyidagi menyudan kerakli bo'limni tanlang! 👇`,
        menuText: (firstName) => `👋 Assalomu alaykum, ${firstName}!\n\nQuyidagi amallardan birini tanlang:`,
        buttons: {
            addExpense: "💸 Xarajat qo'shish",
            addIncome: "💰 Daromad qo'shish",
            viewBalance: "📊 Balansni ko'rish",
            report: "📈 Hisobot",
            resetBalance: "♻️ Balansni tozalash",
            setLimit: "⚙️ Xarajat limitini sozlash",
            settings: "🛠 Sozlamalar",
        },
        prompts: {
            chooseLanguage: LANGUAGE_PROMPT_TEXT,
            expenseName: "Xarajat nomini kiriting (bekor qilish uchun /cancel):",
            expenseAmount: "Summasini kiriting (faqat raqam):",
            incomeSource: "Daromad manbasini kiriting (bekor qilish uchun /cancel):",
            incomeAmount: "Summasini kiriting (faqat raqam):",
            limit: "Oylik xarajat limitini kiriting (faqat raqam):",
            category: "Kategoriyani tanlang:",
            expenseStart: "💸 Xarajat qo'shish jarayoni boshlanmoqda...",
            incomeStart: "💰 Daromad qo'shish jarayoni boshlanmoqda...",
            settings: "🛠 Sozlamalar\n\nQuyidagi sozlamalardan birini tanlang:",
            reportPeriod: "Qaysi davr uchun hisobot kerak?",
        },
        responses: {
            cancelProcess: "Jarayon bekor qilindi.",
            invalidAmount: "Noto'g'ri summa kiritildi. Jarayon bekor qilindi.",
            invalidCategory: "Noto'g'ri kategoriya tanlandi. Jarayon bekor qilindi.",
            expenseAdded: ({ name, amount, category }) => `✅ Xarajat muvaffaqiyatli qo'shildi!\n\n📝 Nomi: ${name}\n💰 Summa: ${amount}\n🏷 Kategoriya: ${category}`,
            limitExceeded: ({ limit, current, excess }) => `⚠️ Diqqat! Siz belgilangan oylik xarajat limitidan oshib ketdingiz!\n\nLimit: ${limit}\nJoriy xarajat: ${current}\nLimitdan oshgan summa: ${excess}`,
            incomeAdded: ({ source, amount }) => `✅ Daromad muvaffaqiyatli qo'shildi!\n\n📝 Manba: ${source}\n💰 Summa: ${amount}`,
            limitSet: ({ limit }) => `✅ Oylik xarajat limiti ${limit}ga o'rnatildi.`,
            currentLimitInfo: (limit) => `Joriy oylik limitingiz: ${limit}\n\nYangi limit o'rnatish uchun davom eting:`,
            balanceSummary: ({ income, expense, balance }) => `<b>📊 Umumiy balans</b>\n\n⬆️ Daromad: ${income}\n⬇️ Xarajat: ${expense}\n\n💰 Balans: <b>${balance}</b>`,
            reportTitle: (period) => `<b>📈 ${period} hisobot</b>\n\n`,
            reportExpensesTitle: "<b>Xarajatlar kategoriyalar bo'yicha:</b>\n",
            noExpenses: "Bu davrda xarajatlar bo'lmagan.\n",
            categoryLine: (category, amount) => `  - ${category}: ${amount}`,
            reportIncome: (amount) => `⬆️ Daromad: ${amount}`,
            reportExpense: (amount) => `⬇️ Xarajat: ${amount}`,
            reportBalance: (amount) => `💰 Balans: <b>${amount}</b>`,
            resetPrompt: "Balansingizdagi barcha daromad va xarajat yozuvlari o'chiriladi. Davom etasizmi?",
            resetConfirmed: "♻️ Balansingiz nolga qaytarildi. Endi qaytadan ma'lumot kiritishingiz mumkin.",
            languageChanged: "Til o'zgartirildi: O'zbekcha ✅",
            cancelAllActions: "Barcha amallar bekor qilindi.",
            error: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
            restartRequired: "Xatolik yuz berdi. /start buyrug'i bilan qayta boshlang.",
        },
        labels: {
            periodWeek: "Haftalik",
            periodMonth: "Oylik",
            confirmReset: "✅ Ha, tozalash",
            cancelReset: "⬅️ Bekor qilish",
            back: "⬅️ Orqaga",
            changeLanguage: "🌐 Tilni o'zgartirish",
            settings: "🛠 Sozlamalar",
        },
    },
    ru: {
        label: "Русский",
        locale: 'ru-RU',
        currency: "сум",
        help: `👋 Добро пожаловать! Это бот для финансовых отчётов!

📝 Возможности бота:
1. 💸 Добавление и отслеживание расходов
2. 💰 Добавление и отслеживание доходов
3. 📊 Просмотр текущего баланса
4. 📈 Получение ежедневных/ежемесячных отчётов
5. ⚙️ Установка лимита расходов

🔍 Основные команды:
/start - Запустить бота
/help - Получить помощь
/cancel - Отменить текущее действие

💡 Советы:
- Регулярно вносите доходы и расходы
- Устанавливайте лимит, чтобы контролировать траты
- Анализируйте отчёты, чтобы держать финансы под контролем

Выберите нужный пункт из меню ниже! 👇`,
        menuText: (firstName) => `👋 Здравствуйте, ${firstName}!\n\nВыберите один из вариантов:`,
        buttons: {
            addExpense: "💸 Добавить расход",
            addIncome: "💰 Добавить доход",
            viewBalance: "📊 Посмотреть баланс",
            report: "📈 Отчёт",
            resetBalance: "♻️ Обнулить баланс",
            setLimit: "⚙️ Настроить лимит расходов",
            settings: "🛠 Настройки",
        },
        prompts: {
            chooseLanguage: LANGUAGE_PROMPT_TEXT,
            expenseName: "Введите название расхода (для отмены /cancel):",
            expenseAmount: "Введите сумму (только число):",
            incomeSource: "Введите источник дохода (для отмены /cancel):",
            incomeAmount: "Введите сумму (только число):",
            limit: "Введите месячный лимит расходов (только число):",
            category: "Выберите категорию:",
            expenseStart: "💸 Процесс добавления расхода запущен...",
            incomeStart: "💰 Процесс добавления дохода запущен...",
            settings: "🛠 Настройки\n\nВыберите нужный пункт:",
            reportPeriod: "За какой период нужен отчёт?",
        },
        responses: {
            cancelProcess: "Процесс отменён.",
            invalidAmount: "Некорректная сумма. Процесс отменён.",
            invalidCategory: "Некорректная категория. Процесс отменён.",
            expenseAdded: ({ name, amount, category }) => `✅ Расход успешно добавлен!\n\n📝 Название: ${name}\n💰 Сумма: ${amount}\n🏷 Категория: ${category}`,
            limitExceeded: ({ limit, current, excess }) => `⚠️ Внимание! Вы превысили установленный месячный лимит расходов!\n\nЛимит: ${limit}\nТекущие расходы: ${current}\nПревышение: ${excess}`,
            incomeAdded: ({ source, amount }) => `✅ Доход успешно добавлен!\n\n📝 Источник: ${source}\n💰 Сумма: ${amount}`,
            limitSet: ({ limit }) => `✅ Месячный лимит расходов установлен: ${limit}.`,
            currentLimitInfo: (limit) => `Текущий месячный лимит: ${limit}\n\nЧтобы установить новый лимит, продолжайте:`,
            balanceSummary: ({ income, expense, balance }) => `<b>📊 Текущий баланс</b>\n\n⬆️ Доход: ${income}\n⬇️ Расход: ${expense}\n\n💰 Баланс: <b>${balance}</b>`,
            reportTitle: (period) => `<b>📈 ${period} отчёт</b>\n\n`,
            reportExpensesTitle: "<b>Расходы по категориям:</b>\n",
            noExpenses: "За этот период не было расходов.\n",
            categoryLine: (category, amount) => `  - ${category}: ${amount}`,
            reportIncome: (amount) => `⬆️ Доход: ${amount}`,
            reportExpense: (amount) => `⬇️ Расход: ${amount}`,
            reportBalance: (amount) => `💰 Баланс: <b>${amount}</b>`,
            resetPrompt: "Все доходы и расходы будут удалены. Продолжить?",
            resetConfirmed: "♻️ Баланс сброшен. Теперь можно вводить данные заново.",
            languageChanged: "Язык изменён: Русский ✅",
            cancelAllActions: "Все операции отменены.",
            error: "Произошла ошибка. Попробуйте ещё раз.",
            restartRequired: "Произошла ошибка. Запустите бота заново командой /start.",
        },
        labels: {
            periodWeek: "Недельный",
            periodMonth: "Месячный",
            confirmReset: "✅ Да, обнулить",
            cancelReset: "⬅️ Отмена",
            back: "⬅️ Назад",
            changeLanguage: "🌐 Изменить язык",
            settings: "🛠 Настройки",
        },
    },
    en: {
        label: "English",
        locale: 'en-US',
        currency: "UZS",
        help: `👋 Welcome! This is your financial assistant!

📝 What you can do:
1. 💸 Add and track expenses
2. 💰 Add and track income
3. 📊 See your current balance
4. 📈 Get daily/monthly reports
5. ⚙️ Set a spending limit

🔍 Main commands:
/start - Launch the bot
/help - Show help
/cancel - Cancel current action

💡 Tips:
- Enter income and expenses regularly
- Set a spending limit to stay on budget
- Review reports to understand your finances

Choose what you need from the menu below! 👇`,
        menuText: (firstName) => `👋 Hello, ${firstName}!\n\nSelect what you want to do:`,
        buttons: {
            addExpense: "💸 Add expense",
            addIncome: "💰 Add income",
            viewBalance: "📊 View balance",
            report: "📈 Report",
            resetBalance: "♻️ Reset balance",
            setLimit: "⚙️ Set spending limit",
            settings: "🛠 Settings",
        },
        prompts: {
            chooseLanguage: LANGUAGE_PROMPT_TEXT,
            expenseName: "Enter the expense name (type /cancel to abort):",
            expenseAmount: "Enter the amount (numbers only):",
            incomeSource: "Enter the income source (type /cancel to abort):",
            incomeAmount: "Enter the amount (numbers only):",
            limit: "Enter the monthly spending limit (numbers only):",
            category: "Choose a category:",
            expenseStart: "💸 Starting expense entry...",
            incomeStart: "💰 Starting income entry...",
            settings: "🛠 Settings\n\nPick one of the options:",
            reportPeriod: "Which period do you need a report for?",
        },
        responses: {
            cancelProcess: "Process cancelled.",
            invalidAmount: "Invalid amount. Process cancelled.",
            invalidCategory: "Invalid category selected. Process cancelled.",
            expenseAdded: ({ name, amount, category }) => `✅ Expense added successfully!\n\n📝 Name: ${name}\n💰 Amount: ${amount}\n🏷 Category: ${category}`,
            limitExceeded: ({ limit, current, excess }) => `⚠️ Warning! You've exceeded your monthly spending limit!\n\nLimit: ${limit}\nCurrent spending: ${current}\nExceeded by: ${excess}`,
            incomeAdded: ({ source, amount }) => `✅ Income added successfully!\n\n📝 Source: ${source}\n💰 Amount: ${amount}`,
            limitSet: ({ limit }) => `✅ Monthly spending limit set to ${limit}.`,
            currentLimitInfo: (limit) => `Your current monthly limit: ${limit}\n\nContinue to set a new limit:`,
            balanceSummary: ({ income, expense, balance }) => `<b>📊 Current balance</b>\n\n⬆️ Income: ${income}\n⬇️ Expense: ${expense}\n\n💰 Balance: <b>${balance}</b>`,
            reportTitle: (period) => `<b>📈 ${period} report</b>\n\n`,
            reportExpensesTitle: "<b>Expenses by category:</b>\n",
            noExpenses: "No expenses recorded for this period.\n",
            categoryLine: (category, amount) => `  - ${category}: ${amount}`,
            reportIncome: (amount) => `⬆️ Income: ${amount}`,
            reportExpense: (amount) => `⬇️ Expense: ${amount}`,
            reportBalance: (amount) => `💰 Balance: <b>${amount}</b>`,
            resetPrompt: "This will delete all income and expense records. Continue?",
            resetConfirmed: "♻️ Your balance has been reset. You can start entering data again.",
            languageChanged: "Language changed to English ✅",
            cancelAllActions: "All actions have been cancelled.",
            error: "Something went wrong. Please try again.",
            restartRequired: "Something went wrong. Restart with /start.",
        },
        labels: {
            periodWeek: "Weekly",
            periodMonth: "Monthly",
            confirmReset: "✅ Yes, reset",
            cancelReset: "⬅️ Cancel",
            back: "⬅️ Back",
            changeLanguage: "🌐 Change language",
            settings: "🛠 Settings",
        },
    },
};

function buildLanguageKeyboard() {
    return new InlineKeyboard()
        .text("🇺🇿 O'zbekcha", "set_lang_uz")
        .text("🇷🇺 Русский", "set_lang_ru")
        .text("🇬🇧 English", "set_lang_en");
}

function getLanguage(ctx) {
    if (!ctx || !ctx.session) {
        return DEFAULT_LANGUAGE;
    }
    const sessionLang = ctx.session.language;
    if (SUPPORTED_LANGUAGES.includes(sessionLang)) {
        return sessionLang;
    }
    if (SUPPORTED_LANGUAGES.includes(ctx.session.tempLanguage)) {
        return ctx.session.tempLanguage;
    }
    return DEFAULT_LANGUAGE;
}

function getLocale(lang) {
    return LOCALES[SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE];
}

function formatMoney(amount, lang) {
    const formatter = numberFormatters[lang] || numberFormatters[DEFAULT_LANGUAGE];
    const locale = getLocale(lang);
    return `${formatter.format(Number(amount) || 0)} ${locale.currency}`;
}

function buildMainMenu(lang) {
    const locale = getLocale(lang);
    return new InlineKeyboard()
        .text(locale.buttons.addExpense, "add_expense_action").row()
        .text(locale.buttons.addIncome, "add_income_action").row()
        .text(locale.buttons.viewBalance, "balance_action").row()
        .text(locale.buttons.report, "report_action").row()
        .text(locale.buttons.resetBalance, "reset_balance_action").row()
        .text(locale.buttons.setLimit, "set_limit_action").row()
        .text(locale.buttons.settings, "settings_action");
}

function buildReportKeyboard(lang) {
    const locale = getLocale(lang);
    return new InlineKeyboard()
        .text(locale.labels.periodWeek, "report_week")
        .text(locale.labels.periodMonth, "report_month").row()
        .text(locale.labels.back, "back_to_main");
}

function buildResetConfirmKeyboard(lang) {
    const locale = getLocale(lang);
    return new InlineKeyboard()
        .text(locale.labels.confirmReset, "confirm_reset_balance").row()
        .text(locale.labels.cancelReset, "back_to_main");
}

function buildSettingsKeyboard(lang) {
    const locale = getLocale(lang);
    return new InlineKeyboard()
        .text(locale.labels.changeLanguage, "change_language").row()
        .text(locale.labels.back, "back_to_main");
}

function buildCategoryKeyboard(lang) {
    const keyboard = new Keyboard().resized().oneTime();
    categories.forEach((category) => {
        keyboard.text(category.labels[lang]).row();
    });
    return keyboard;
}

function findCategoryByLabel(label) {
    if (!label) {
        return null;
    }
    const normalized = label.trim().toLowerCase();
    return categories.find((category) =>
        category.code === normalized ||
        Object.values(category.labels).some((value) => value.toLowerCase() === normalized)
    );
}

function localizeStoredCategory(value, lang) {
    const category = findCategoryByLabel(value);
    if (category) {
        return category.labels[lang] || value;
    }
    return value;
}

async function loadLanguage(ctx) {
    if (SUPPORTED_LANGUAGES.includes(ctx.session.language)) {
        return ctx.session.language;
    }
    const stored = await db.getUserLanguage(ctx.from.id);
    if (SUPPORTED_LANGUAGES.includes(stored)) {
        ctx.session.language = stored;
        return stored;
    }
    if (stored) {
        ctx.session.language = DEFAULT_LANGUAGE;
        await db.setUserLanguage(ctx.from.id, DEFAULT_LANGUAGE);
        return DEFAULT_LANGUAGE;
    }
    return null;
}

async function promptLanguageSelection(ctx, source = 'initial') {
    if (!ctx.session) {
        ctx.session = {};
    }
    ctx.session.awaitingLanguage = source;
    await ctx.reply(LANGUAGE_PROMPT_TEXT, { reply_markup: buildLanguageKeyboard() });
}

async function ensureLanguage(ctx) {
    const lang = await loadLanguage(ctx);
    if (lang) {
        return lang;
    }
    if (!ctx.session) {
        ctx.session = {};
    }
    ctx.session.tempLanguage = DEFAULT_LANGUAGE;
    await promptLanguageSelection(ctx, 'initial');
    return DEFAULT_LANGUAGE;
}

async function showMainMenu(ctx, editMessage = false) {
    const lang = getLanguage(ctx);
    const locale = getLocale(lang);
    const text = locale.menuText(ctx.from.first_name);
    const keyboard = buildMainMenu(lang);

    try {
        if (editMessage && ctx.callbackQuery) {
            await ctx.editMessageText(text, { reply_markup: keyboard });
        } else {
            await ctx.reply(text, { reply_markup: keyboard });
        }
    } catch (error) {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

async function expenseConversation(conversation, ctx) {
    const lang = getLanguage(ctx);
    const locale = getLocale(lang);

    try {
        await ctx.reply(locale.prompts.expenseName, { reply_markup: { remove_keyboard: true } });

        const nameCtx = await conversation.waitFor('message:text');
        const expenseName = nameCtx.message.text;
        if (expenseName.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await ctx.reply(locale.prompts.expenseAmount);
        const amountCtx = await conversation.waitFor('message:text');
        const amountText = amountCtx.message.text;
        if (amountText.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        const amountValue = parseFloat(amountText.replace(',', '.'));
        if (Number.isNaN(amountValue) || amountValue <= 0) {
            await ctx.reply(locale.responses.invalidAmount, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await ctx.reply(locale.prompts.category, { reply_markup: buildCategoryKeyboard(lang) });
        const categoryCtx = await conversation.waitFor('message:text');
        const categoryText = categoryCtx.message.text;
        if (categoryText.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        const category = findCategoryByLabel(categoryText);
        if (!category) {
            await ctx.reply(locale.responses.invalidCategory, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.addExpense(ctx.from.id, expenseName, amountValue, category.labels.uz);
        await ctx.reply(
            locale.responses.expenseAdded({
                name: expenseName,
                amount: formatMoney(amountValue, lang),
                category: category.labels[lang],
            }),
            { reply_markup: { remove_keyboard: true } }
        );

        const limitInfo = await db.checkExpenseLimit(ctx.from.id);
        if (limitInfo?.limitExceeded && !limitInfo.notificationSent) {
            await ctx.reply(
                locale.responses.limitExceeded({
                    limit: formatMoney(limitInfo.monthlyLimit, lang),
                    current: formatMoney(limitInfo.currentExpenses, lang),
                    excess: formatMoney(limitInfo.currentExpenses - limitInfo.monthlyLimit, lang),
                })
            );
        }
    } catch (error) {
        console.error("Xarajat qo'shishda xatolik:", error);
        await ctx.reply(locale.responses.error, { reply_markup: { remove_keyboard: true } });
    } finally {
        await showMainMenu(ctx);
    }
}

async function incomeConversation(conversation, ctx) {
    const lang = getLanguage(ctx);
    const locale = getLocale(lang);

    try {
        await ctx.reply(locale.prompts.incomeSource, { reply_markup: { remove_keyboard: true } });

        const sourceCtx = await conversation.waitFor('message:text');
        const source = sourceCtx.message.text;
        if (source.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await ctx.reply(locale.prompts.incomeAmount);
        const amountCtx = await conversation.waitFor('message:text');
        const amountText = amountCtx.message.text;
        if (amountText.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        const amountValue = parseFloat(amountText.replace(',', '.'));
        if (Number.isNaN(amountValue) || amountValue <= 0) {
            await ctx.reply(locale.responses.invalidAmount, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.addIncome(ctx.from.id, source, amountValue);
        await ctx.reply(
            locale.responses.incomeAdded({
                source,
                amount: formatMoney(amountValue, lang),
            }),
            { reply_markup: { remove_keyboard: true } }
        );
    } catch (error) {
        console.error("Daromad qo'shishda xatolik:", error);
        await ctx.reply(locale.responses.error, { reply_markup: { remove_keyboard: true } });
    } finally {
        await showMainMenu(ctx);
    }
}

async function setLimitConversation(conversation, ctx) {
    const lang = getLanguage(ctx);
    const locale = getLocale(lang);

    try {
        await ctx.reply(locale.prompts.limit, { reply_markup: { remove_keyboard: true } });
        const amountCtx = await conversation.waitFor('message:text');
        const limitText = amountCtx.message.text;

        if (limitText.startsWith('/')) {
            await ctx.reply(locale.responses.cancelProcess, { reply_markup: { remove_keyboard: true } });
            return;
        }

        const limitValue = parseFloat(limitText.replace(',', '.'));
        if (Number.isNaN(limitValue) || limitValue <= 0) {
            await ctx.reply(locale.responses.invalidAmount, { reply_markup: { remove_keyboard: true } });
            return;
        }

        await db.setExpenseLimit(ctx.from.id, limitValue);
        await ctx.reply(
            locale.responses.limitSet({
                limit: formatMoney(limitValue, lang),
            }),
            { reply_markup: { remove_keyboard: true } }
        );
    } catch (error) {
        console.error("Limit o'rnatishda xatolik:", error);
        await ctx.reply(locale.responses.error, { reply_markup: { remove_keyboard: true } });
    } finally {
        await showMainMenu(ctx);
    }
}

bot.use(createConversation(expenseConversation));
bot.use(createConversation(incomeConversation));
bot.use(createConversation(setLimitConversation));

bot.command('start', async (ctx) => {
    await ctx.conversation.exit().catch(() => {});
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    const lang = await ensureLanguage(ctx);
    if (!lang) {
        return;
    }
    const locale = getLocale(lang);
    await ctx.reply(locale.help);
    await showMainMenu(ctx);
});

bot.command('help', async (ctx) => {
    await db.findOrCreateUser(ctx.from.id, ctx.from.first_name);
    const lang = await ensureLanguage(ctx);
    if (!lang) {
        return;
    }
    const locale = getLocale(lang);
    await ctx.reply(locale.help);
    await showMainMenu(ctx);
});

bot.command('cancel', async (ctx) => {
    await ctx.conversation.exit().catch(() => {});
    const lang = await loadLanguage(ctx) || DEFAULT_LANGUAGE;
    const locale = getLocale(lang);
    await ctx.reply(locale.responses.cancelAllActions, {
        reply_markup: { remove_keyboard: true },
    });
    await showMainMenu(ctx);
});

bot.on('callback_query:data', async (ctx) => {
    const action = ctx.callbackQuery.data;

    if (!SUPPORTED_LANGUAGES.includes(ctx.session.language) && !action.startsWith('set_lang_')) {
        await ctx.answerCallbackQuery({ text: LANGUAGE_ALERT_TEXT, show_alert: true }).catch(() => {});
        return;
    }

    const lang = getLanguage(ctx);
    const locale = getLocale(lang);
    await ctx.answerCallbackQuery().catch(() => {});

    try {
        switch (action) {
            case 'add_expense_action':
                await ctx.reply(locale.prompts.expenseStart);
                await ctx.conversation.enter('expenseConversation');
                break;

            case 'add_income_action':
                await ctx.reply(locale.prompts.incomeStart);
                await ctx.conversation.enter('incomeConversation');
                break;

            case 'balance_action': {
                const { totalIncome, totalExpense, balance } = await db.getBalance(ctx.from.id);
                const message = locale.responses.balanceSummary({
                    income: formatMoney(totalIncome, lang),
                    expense: formatMoney(totalExpense, lang),
                    balance: formatMoney(balance, lang),
                });
                await ctx.reply(message, { parse_mode: 'HTML' });
                if (ctx.session) {
                    ctx.session.tempLanguage = ctx.session.language;
                }
                await showMainMenu(ctx);
                break;
            }

            case 'report_action': {
                const reportKeyboard = buildReportKeyboard(lang);
                await ctx.reply(locale.prompts.reportPeriod, { reply_markup: reportKeyboard });
                break;
            }

            case 'reset_balance_action': {
                const confirmKeyboard = buildResetConfirmKeyboard(lang);
                await ctx.reply(locale.responses.resetPrompt, { reply_markup: confirmKeyboard });
                break;
            }

            case 'confirm_reset_balance': {
                await ctx.conversation.exit().catch(() => {});
                await db.resetBalance(ctx.from.id);
                await ctx.reply(locale.responses.resetConfirmed);
                await showMainMenu(ctx);
                break;
            }

            case 'set_limit_action': {
                const currentLimit = await db.getExpenseLimit(ctx.from.id);
                if (currentLimit) {
                    await ctx.reply(locale.responses.currentLimitInfo(formatMoney(currentLimit, lang)));
                }
                await ctx.conversation.enter('setLimitConversation');
                break;
            }

            case 'settings_action': {
                const settingsKeyboard = buildSettingsKeyboard(lang);
                await ctx.reply(locale.prompts.settings, { reply_markup: settingsKeyboard });
                break;
            }

            case 'change_language':
                await promptLanguageSelection(ctx, 'settings');
                break;

            case 'back_to_main':
                await showMainMenu(ctx, true);
                break;

            case 'report_week':
            case 'report_month': {
                const period = action.split('_')[1];
                const periodLabel = period === 'week' ? locale.labels.periodWeek : locale.labels.periodMonth;
                const report = await db.getReport(ctx.from.id, period);

                let reportText = locale.responses.reportTitle(periodLabel);

                if (report.expensesByCategory.length > 0) {
                    reportText += locale.responses.reportExpensesTitle;
                    report.expensesByCategory.forEach((item) => {
                        const categoryLabel = localizeStoredCategory(item.category, lang);
                        reportText += `${locale.responses.categoryLine(categoryLabel, formatMoney(item.total, lang))}\n`;
                    });
                } else {
                    reportText += locale.responses.noExpenses;
                }

                reportText += `\n${locale.responses.reportIncome(formatMoney(report.totalIncome, lang))}\n`;
                reportText += `${locale.responses.reportExpense(formatMoney(report.totalExpense, lang))}\n`;
                reportText += `${locale.responses.reportBalance(formatMoney(report.netBalance, lang))}`;

                await ctx.reply(reportText, { parse_mode: 'HTML' });
                await showMainMenu(ctx);
                break;
            }

            case 'set_lang_uz':
            case 'set_lang_ru':
            case 'set_lang_en': {
                const selectedLang = action.split('_')[2];
                if (!SUPPORTED_LANGUAGES.includes(selectedLang)) {
                    break;
                }

                await db.setUserLanguage(ctx.from.id, selectedLang);
                if (!ctx.session) {
                    ctx.session = {};
                }
                ctx.session.language = selectedLang;
                ctx.session.tempLanguage = selectedLang;
                const previousStage = ctx.session.awaitingLanguage;
                ctx.session.awaitingLanguage = null;

                const selectedLocale = getLocale(selectedLang);
                try {
                    await ctx.editMessageText(selectedLocale.responses.languageChanged);
                } catch (error) {
                    await ctx.reply(selectedLocale.responses.languageChanged);
                }

                if (previousStage === 'initial') {
                    await ctx.reply(selectedLocale.help);
                }

                await showMainMenu(ctx);
                break;
            }
        }
    } catch (error) {
        console.error("Callback query ishlovida xatolik:", error);
        await ctx.reply(locale.responses.error);
        await showMainMenu(ctx);
    }
});

bot.catch(async (err) => {
    const ctx = err.ctx;
    console.error(`Error for update ${ctx?.update?.update_id}:`, err.error);
    const lang = ctx ? getLanguage(ctx) : DEFAULT_LANGUAGE;
    const locale = getLocale(lang);
    if (ctx) {
        await ctx.reply(locale.responses.restartRequired).catch(() => {});
    }
});

async function startBot() {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    bot.start({
        drop_pending_updates: true,
        onStart: (botInfo) => console.log(`Bot @${botInfo.username} ishga tushdi...`),
    });
}

startBot();
