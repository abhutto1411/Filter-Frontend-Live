import {
    formatCardDateTime,
    formatDateSeparator,
    formatListDateTime,
    formatMessageDateTime,
} from '../src/utils/platformChatDateTime.js';

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const now = new Date();
const todayIso = now.toISOString();

const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayIso = yesterday.toISOString();

const older = new Date(now);
older.setFullYear(older.getFullYear() - 1);
const olderIso = older.toISOString();

assert(formatDateSeparator(todayIso) === 'Today', 'today separator');
assert(formatDateSeparator(yesterdayIso) === 'Yesterday', 'yesterday separator');
assert(formatListDateTime(todayIso).startsWith('Today,'), 'list today has date+time');
assert(formatListDateTime(yesterdayIso).startsWith('Yesterday,'), 'list yesterday has date+time');
assert(formatMessageDateTime(olderIso).includes(String(older.getFullYear())), 'older message includes year');
assert(formatCardDateTime(todayIso).includes('·'), 'card datetime has separator');
assert(formatCardDateTime(todayIso).length > 10, 'card datetime not empty');

console.log('PASS: platform chat datetime helpers');
