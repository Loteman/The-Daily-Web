// View statistics are grouped by the hour in Israel time, as "YYYY-MM-DDTHH:00" (the format the statistics page
// reads). The same format is produced by MongoDB's $dateToString with this timezone when totals are rebuilt.
const TIMEZONE = 'Asia/Jerusalem';
const HOUR_FORMAT = '%Y-%m-%dT%H:00';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
});

function hourKey(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}

module.exports = { TIMEZONE, HOUR_FORMAT, hourKey };
