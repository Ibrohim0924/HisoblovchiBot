const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Foydalanuvchi mavjudligini tekshirish va qo'shish
async function findOrCreateUser(userId, firstName) {
    const res = await pool.query('SELECT telegram_id FROM users WHERE telegram_id = $1', [userId]);
    if (res.rowCount === 0) {
        await pool.query('INSERT INTO users (telegram_id, first_name) VALUES ($1, $2)', [userId, firstName]);
    }
}

// Daromad qo'shish
async function addIncome(userId, source, amount) {
    await pool.query(
        'INSERT INTO incomes (user_id, source, amount) VALUES ($1, $2, $3)',
        [userId, source, amount]
    );
}

// Xarajat qo'shish
async function addExpense(userId, name, amount, category) {
    await pool.query(
        'INSERT INTO expenses (user_id, name, amount, category) VALUES ($1, $2, $3, $4)',
        [userId, name, amount, category]
    );
}

// Balansni hisoblash
async function getBalance(userId) {
    const incomeRes = await pool.query('SELECT SUM(amount) as total FROM incomes WHERE user_id = $1', [userId]);
    const expenseRes = await pool.query('SELECT SUM(amount) as total FROM expenses WHERE user_id = $1', [userId]);

    const totalIncome = parseFloat(incomeRes.rows[0].total) || 0;
    const totalExpense = parseFloat(expenseRes.rows[0].total) || 0;

    return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
    };
}

// Hisobot olish
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
        netBalance: totalIncome - totalExpense,
    };
}

module.exports = {
    findOrCreateUser,
    addIncome,
    addExpense,
    getBalance,
    getReport,
};