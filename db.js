const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function findOrCreateUser(userId, firstName) {
    const res = await pool.query('SELECT telegram_id FROM users WHERE telegram_id = $1', [userId]);
    if (res.rowCount === 0) {
        await pool.query('INSERT INTO users (telegram_id, first_name) VALUES ($1, $2)', [userId, firstName]);
    }
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

async function getBalance(userId) {
    const incomeRes = await pool.query('SELECT SUM(amount) as total FROM incomes WHERE user_id = $1', [userId]);
    const expenseRes = await pool.query('SELECT SUM(amount) as total FROM expenses WHERE user_id = $1', [userId]);
    
    const totalIncome = parseFloat(incomeRes.rows[0].total) || 0;
    const totalExpense = parseFloat(expenseRes.rows[0].total) || 0;
    
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
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

    const totalIncome = parseFloat(incomeRes.rows[0].total) || 0;
    const totalExpense = parseFloat(expenseRes.rows[0].total) || 0;

    return {
        expensesByCategory: expenseReport.rows,
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense
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

    if (result.rows.length === 0) return null;

    const { current_expenses, monthly_limit, notification_sent } = result.rows[0];
    const limitExceeded = current_expenses >= monthly_limit;

    if (limitExceeded && !notification_sent) {
        await pool.query(
            'UPDATE expense_limits SET notification_sent = true WHERE user_id = $1',
            [userId]
        );
    } else if (!limitExceeded && notification_sent) {
        await pool.query(
            'UPDATE expense_limits SET notification_sent = false WHERE user_id = $1',
            [userId]
        );
    }

    return {
        currentExpenses: current_expenses,
        monthlyLimit: monthly_limit,
        limitExceeded,
        notificationSent: notification_sent
    };
}

async function getExpenseLimit(userId) {
    const result = await pool.query(
        'SELECT monthly_limit FROM expense_limits WHERE user_id = $1',
        [userId]
    );
    return result.rows[0]?.monthly_limit || null;
}

module.exports = {
    findOrCreateUser,
    addIncome,
    addExpense,
    getBalance,
    getReport,
    setExpenseLimit,
    checkExpenseLimit,
    getExpenseLimit
};