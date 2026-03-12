const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatRunDate(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()];
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${dd}-${mon}-${yyyy}_${hh}${mm}`;
}
