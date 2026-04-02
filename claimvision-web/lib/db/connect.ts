import mongoose from 'mongoose';
import { ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
  // eslint-disable-next-line no-var
  var mongooseListenersAttached: boolean | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cache;

function invalidateCache() {
  cache.conn = null;
  cache.promise = null;
}

function isLive() {
  return mongoose.connection.readyState === 1;
}

if (!global.mongooseListenersAttached) {
  mongoose.connection.on('disconnected', () => {
    invalidateCache();
  });
  // Do not clear the pool on transient `error` — that cascades into TLS reuse bugs
  // (MongoNetworkError: illegal parameter / bad record mac) under concurrent requests.
  mongoose.connection.on('error', (err) => {
    console.error('[DB] connection error:', err);
  });
  global.mongooseListenersAttached = true;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (isLive()) {
    cache.conn = mongoose;
    return mongoose;
  }

  if (cache.promise) {
    try {
      await cache.promise;
      if (isLive()) {
        cache.conn = mongoose;
        return mongoose;
      }
    } catch {
      invalidateCache();
    }
  }

  if (!cache.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 20_000,
      socketTimeoutMS: 45_000,
      connectTimeoutMS: 20_000,
      // Do not set `family: 4` — forcing IPv4 breaks many Atlas + macOS / DNS setups
      // (MongoNetworkError during server selection).
      maxIdleTimeMS: 60_000,
      // Stable wire protocol with Atlas; avoids some TLS edge cases on Node + OpenSSL 3
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: false,
      },
    };

    cache.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log('[DB] MongoDB connected');
      return m;
    });
  }

  try {
    await cache.promise;
    if (!isLive()) {
      invalidateCache();
      throw new Error('MongoDB connection did not become ready');
    }
    cache.conn = mongoose;
    return cache.conn;
  } catch (err) {
    invalidateCache();
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name?: string }).name === 'MongooseServerSelectionError'
    ) {
      console.error(
        '[DB] MongoDB Atlas: server selection failed. In Atlas → Network Access, add your public IP or 0.0.0.0/0 (dev only). Ensure MONGODB_URI uses the SRV string from Atlas and credentials are URL-encoded. See https://www.mongodb.com/docs/atlas/security-whitelist/'
      );
    }
    throw err;
  }
}

export default connectDB;
