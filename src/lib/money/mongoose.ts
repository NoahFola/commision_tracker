import { Schema } from 'mongoose';
import { type Currency, isCurrency, isValidMinorAmount } from './currency';

export type MoneyDoc = { amount: number; currency: Currency };

/**
 * Mongoose sub-schema for Money. Embed this — do not register as a model.
 * Enforces: integer minor units, known currency, currency is required.
 *
 * Note: the cross-field check (amount must be integer in *this* currency)
 * lives in a pre('validate') hook on the sub-schema, not in the amount
 * validator, because the validator's `this` type is the parent hydrated
 * document (or a Query), not the sub-document.
 */
export const MoneySchema = new Schema<MoneyDoc>(
  {
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (v: number): boolean =>
          typeof v === 'number' &&
          Number.isFinite(v) &&
          Number.isInteger(v) &&
          Number.isSafeInteger(v),
        message: 'amount must be a safe integer in the smallest unit of the currency',
      },
    },
    currency: {
      type: String,
      required: true,
      enum: ['XAF', 'USD', 'EUR'],
      validate: {
        validator: (v: string): boolean => isCurrency(v),
        message: 'unsupported currency',
      },
    },
  },
  { _id: false },
);

/**
 * Cross-field validation: amount must be valid for the declared currency.
 * Runs before Mongoose's built-in validation, with `this` correctly typed
 * as the hydrated sub-document at runtime.
 */
MoneySchema.pre('validate', function () {
  const doc = this as unknown as MoneyDoc;
  if (!isValidMinorAmount(doc.amount, doc.currency)) {
    this.invalidate(
      'amount',
      'amount must be a valid integer minor-unit value for the given currency',
    );
  }
});
