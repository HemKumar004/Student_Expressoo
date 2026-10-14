const { Prisma } = require("@prisma/client");

const Decimal = Prisma.Decimal;
const ZERO = new Decimal(0);

const dec = (value) => (value instanceof Decimal ? value : new Decimal(value ?? 0));

/** Serialise a DECIMAL for JSON as a fixed 2-dp string (never a float). */
const money = (value) => dec(value).toFixed(2);

/** Net payable for a fee record (amount − discount). */
const netAmount = (record) => dec(record.amount).minus(dec(record.discount));

const balanceOf = (record) => {
  const balance = netAmount(record).minus(dec(record.amountPaid));
  return balance.isNegative() ? ZERO : balance;
};

/** Derive the fee status from amounts — the single source of truth for FeeStatus. */
function feeStatusFor({ amount, discount, amountPaid }) {
  const net = dec(amount).minus(dec(discount));
  if (net.lte(0)) return "WAIVED";
  if (dec(amountPaid).gte(net)) return "PAID";
  if (dec(amountPaid).gt(0)) return "PARTIAL";
  return "UNPAID";
}

module.exports = { Decimal, ZERO, dec, money, netAmount, balanceOf, feeStatusFor };
