declare global {
  interface String {
    toProperCase(): string;
  }
}

export function toProperCase(str: string) {
  // console.log("Converting to proper case:", str);
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

String.prototype.toProperCase = function () {
  return toProperCase(this.toString());
};
