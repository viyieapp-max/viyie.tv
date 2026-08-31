export function getCurrentPeriodKey() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const day = now.getDate();
  if (day < 16) {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-16`;
}

export function isDateInCurrentPeriod(dateValue: any): boolean {
  if (!dateValue) return false;
  
  let date: Date;
  if (dateValue && typeof dateValue.toDate === 'function') {
    date = dateValue.toDate();
  } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    return false;
  }

  const periodStart = new Date(getCurrentPeriodKey());
  
  // Period ends on the 15th of the next month relative to periodStart
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(15);
  periodEnd.setHours(23, 59, 59, 999);
  
  return date.getTime() >= periodStart.getTime() && date.getTime() <= periodEnd.getTime();
}
