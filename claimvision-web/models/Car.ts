import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICar extends Omit<Document, 'model'> {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  brand: string;
  model: string;
  year: number;
  licensePlate?: string;
  color?: string;
  vin?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CarSchema = new Schema<ICar>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      maxlength: [50, 'Brand cannot exceed 50 characters'],
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
      maxlength: [50, 'Model cannot exceed 50 characters'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1900, 'Year must be after 1900'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },
    licensePlate: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [20, 'License plate too long'],
    },
    color: { type: String, trim: true, maxlength: [30, 'Color name too long'] },
    vin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [17, 'VIN must be 17 characters'],
      minlength: [17, 'VIN must be 17 characters'],
    },
  },
  { timestamps: true }
);

CarSchema.index({ userId: 1, createdAt: -1 });

const Car: Model<ICar> = mongoose.models.Car || mongoose.model<ICar>('Car', CarSchema);
export default Car;
