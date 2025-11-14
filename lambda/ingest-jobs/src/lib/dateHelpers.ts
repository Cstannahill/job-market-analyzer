const months = [
  { month: 1, days: 31 },
  { month: 2, days: 28 },
  { month: 3, days: 31 },
  { month: 4, days: 30 },
  { month: 5, days: 31 },
  { month: 6, days: 30 },
  { month: 7, days: 31 },
  { month: 8, days: 31 },
  { month: 9, days: 30 },
  { month: 10, days: 31 },
  { month: 11, days: 30 },
  { month: 12, days: 31 },
];

export const getDayOfYear = (): number => {
  const date = new Date();
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();
  let computedDate = 0;
  for (let i = 0; i <= month; i++) {
    computedDate += months[i].days;
  }
  computedDate += Number(day);
  return Number(`${year}${computedDate}`);
};
