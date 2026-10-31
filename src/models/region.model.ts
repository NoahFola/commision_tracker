import { Schema, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from './_register';

/**
 * Region.
 *
 * Flat collection (no hierarchy). Exactly one Region per Agent.
 * `name` is unique case-insensitively via the normalized `nameKey` field.
 * Deactivation uses `isActive` — Regions are never deleted, because Agents
 * reference them and historical reports must remain readable.
 */
const regionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // Normalized (lowercased, trimmed) form of `name`. Enforces case-insensitive
    // uniqueness. Maintained by the pre-validate hook below.
    nameKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true, collection: 'regions' },
);

regionSchema.pre('validate', function () {
  if (typeof this.name === 'string') {
    this.nameKey = this.name.trim().toLowerCase();
  }
});

export type RegionDoc = InferSchemaType<typeof regionSchema>;

export const Region: Model<RegionDoc> = registerModel<RegionDoc>('Region', regionSchema);
