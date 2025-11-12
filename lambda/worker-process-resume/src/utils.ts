export const calculateDemandScore = (count: number): number => {
  let res: number = 0;
  try {
    res = count / 20;
    res = res * 100;
  } catch (err) {
    console.error(err);
  }

  return res;
};
