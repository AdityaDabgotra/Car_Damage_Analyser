import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  provider: 'credentials' | 'google';
  providerId?: string;
  role: 'user' | 'admin';
  /** E.164-style or local digits; required before dashboard (collected post-login). */
  phone?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      select: false, // never return by default
      minlength: [8, 'Password must be at least 8 characters'],
    },
    provider: {
      type: String,
      enum: ['credentials', 'google'],
      required: true,
      default: 'credentials',
    },
    providerId: { type: String },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number is too long'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (email index comes from unique: true above)
UserSchema.index({ provider: 1, providerId: 1 });

// Virtual: cars
UserSchema.virtual('cars', {
  ref: 'Car',
  localField: '_id',
  foreignField: 'userId',
});

UserSchema.virtual('claims', {
  ref: 'Claim',
  localField: '_id',
  foreignField: 'userId',
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
