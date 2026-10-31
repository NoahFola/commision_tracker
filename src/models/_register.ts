import type { Model, Schema } from 'mongoose';
import mongoose from 'mongoose';

/**
 * Registers a Mongoose model exactly once, even across Next.js hot reloads
 * and serverless cold starts. Without this, dev reloads throw
 * "OverwriteModelError: Cannot overwrite `X` model once compiled."
 *
 * Always register models through this helper.
 */
export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
