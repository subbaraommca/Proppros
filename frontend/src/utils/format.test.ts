import { date, label, money, ordinal, toCents } from "./format";

describe("money helpers", () => {
  it("parses dollar input to cents", () => {
    expect(toCents("1,250.50")).toBe(125050);
    expect(toCents("$99")).toBe(9900);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("")).toBeNull();
    expect(toCents("abc")).toBeNull();
  });

  it("formats cents as currency", () => {
    expect(money(150000)).toBe("$1,500.00");
    expect(money(null)).toBe("—");
  });
});

describe("date and label helpers", () => {
  it("formats calendar dates without timezone shift", () => {
    expect(date("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("labels and ordinals", () => {
    expect(label("in_progress")).toBe("In progress");
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(13)).toBe("13th");
  });
});
