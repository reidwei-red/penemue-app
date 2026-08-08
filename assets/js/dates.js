// DDL 是无时区的纯日期字符串；所有判断都在字符串和民用日期层面完成。
export function localToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function civilDayNumber(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const adjustedYear = month <= 2 ? year - 1 : year;
  const adjustedMonth = month <= 2 ? month + 12 : month;
  return 365 * adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) + Math.floor((153 * (adjustedMonth - 3) + 2) / 5) + day - 1;
}

// 只用于纯日期的天数差，不把 due 交给 Date 解析，避开时区跨日问题。
export function daysBetween(fromDate, toDate) {
  return civilDayNumber(toDate) - civilDayNumber(fromDate);
}

export function deadlineState(due, completed = false, today = localToday()) {
  if (!due || completed) return '';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (daysBetween(today, due) <= 3) return 'soon';
  return '';
}

export function deadlineText(due, today = localToday()) {
  const difference = daysBetween(today, due);
  if (difference < 0) return `已过期 ${Math.abs(difference)} 天`;
  if (difference === 0) return '今天到期';
  return `还剩 ${difference} 天`;
}
