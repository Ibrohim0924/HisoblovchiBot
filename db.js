const { Pool } = require('pg');
require('dotenv').config();

const toNumber = (value) => {
    if (value === null || value === undefined) {
        return 0;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function findOrCreateUser(userId, firstName) {
    const res = await pool.query('SELECT telegram_id, first_name FROM users WHERE telegram_id = $1', [userId]);
    if (res.rowCount === 0) {
        await pool.query('INSERT INTO users (telegram_id, first_name) VALUES ($1, $2)', [userId, firstName]);
    } else if (firstName && res.rows[0].first_name !== firstName) {
        await pool.query('UPDATE users SET first_name = $1 WHERE telegram_id = $2', [firstName, userId]);
    }
}

async function getUserLanguage(userId) {
    const res = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [userId]);
    return res.rows[0]?.language || null;
}

async function setUserLanguage(userId, language) {
    await pool.query('UPDATE users SET language = $1 WHERE telegram_id = $2', [language, userId]);
}

async function addIncome(userId, source, amount) {
    await pool.query(
        'INSERT INTO incomes (user_id, source, amount) VALUES ($1, $2, $3)',
        [userId, source, amount]
    );
}

async function addExpense(userId, name, amount, category) {
    await pool.query(
        'INSERT INTO expenses (user_id, name, amount, category) VALUES ($1, $2, $3, $4)',
        [userId, name, amount, category]
    );
}

async function resetBalance(userId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM incomes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getBalance(userId) {
    const result = await pool.query(`
        SELECT
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS total_expense,
            COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS balance
        FROM (
            SELECT amount, 'income'::text AS type FROM incomes WHERE user_id = $1
            UNION ALL
            SELECT amount, 'expense'::text AS type FROM expenses WHERE user_id = $1
        ) movements
    `, [userId]);

    const row = result.rows[0] || {};
    const totalIncome = toNumber(row.total_income);
    const totalExpense = toNumber(row.total_expense);
    const balance = toNumber(row.balance);

    return { totalIncome, totalExpense, balance };
}

async function getReport(userId, period = 'month') {
    const interval = period === 'week' ? '7 days' : '30 days';

    const expenseReport = await pool.query(
        `SELECT category, SUM(amount) as total
         FROM expenses
         WHERE user_id = $1 AND created_at >= NOW() - $2::interval
         GROUP BY category`,
        [userId, interval]
    );

    const incomeRes = await pool.query(
        `SELECT SUM(amount) as total
         FROM incomes
         WHERE user_id = $1 AND created_at >= NOW() - $2::interval`,
        [userId, interval]
    );

    const expenseRes = await pool.query(
        `SELECT SUM(amount) as total
         FROM expenses
         WHERE user_id = $1 AND created_at >= NOW() - $2::interval`,
        [userId, interval]
    );

    const totalIncome = toNumber(incomeRes.rows[0].total);
    const totalExpense = toNumber(expenseRes.rows[0].total);

    return {
        expensesByCategory: expenseReport.rows.map((row) => ({
            category: row.category,
            total: toNumber(row.total),
        })),
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
    };
}

async function setExpenseLimit(userId, limit) {
    await pool.query(
        'INSERT INTO expense_limits (user_id, monthly_limit) VALUES ($1, $2) ' +
        'ON CONFLICT (user_id) DO UPDATE SET monthly_limit = $2, notification_sent = false, updated_at = NOW()',
        [userId, limit]
    );
}

async function checkExpenseLimit(userId) {
    const result = await pool.query(`
        WITH monthly_expenses AS (
            SELECT COALESCE(SUM(amount), 0) as total
            FROM expenses
            WHERE user_id = $1
            AND created_at >= DATE_TRUNC('month', NOW())
        ),
        user_limit AS (
            SELECT monthly_limit, notification_sent
            FROM expense_limits
            WHERE user_id = $1
        )
        SELECT 
            monthly_expenses.total as current_expenses,
            user_limit.monthly_limit,
            user_limit.notification_sent
        FROM monthly_expenses, user_limit
    `, [userId]);

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    const currentExpenses = toNumber(row.current_expenses);
    const monthlyLimit = toNumber(row.monthly_limit);
    const notificationSent = !!row.notification_sent;
    const limitExceeded = monthlyLimit > 0 && currentExpenses >= monthlyLimit;

    let updatedNotificationSent = notificationSent;

    if (limitExceeded && !notificationSent) {
        await pool.query(
            'UPDATE expense_limits SET notification_sent = true WHERE user_id = $1',
            [userId]
        );
        updatedNotificationSent = true;
    } else if (!limitExceeded && notificationSent) {
        await pool.query(
            'UPDATE expense_limits SET notification_sent = false WHERE user_id = $1',
            [userId]
        );
        updatedNotificationSent = false;
    }

    return {
        currentExpenses,
        monthlyLimit,
        limitExceeded,
        notificationSent: updatedNotificationSent,
    };
}

async function getExpenseLimit(userId) {
    const result = await pool.query(
        'SELECT monthly_limit FROM expense_limits WHERE user_id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return toNumber(result.rows[0].monthly_limit);
}

module.exports = {
    findOrCreateUser,
    getUserLanguage,
    setUserLanguage,
    addIncome,
    addExpense,
    resetBalance,
    getBalance,
    getReport,
    setExpenseLimit,
    checkExpenseLimit,
    getExpenseLimit,
};
