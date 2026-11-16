// MongoDB client singleton. tryMongo() returns null (instead of throwing) when MongoDB is
// down, so billing never fails just because the notification log is unavailable. After a
// failed connection it waits 30 s before trying again, so pages stay fast meanwhile.
import { MongoClient } from 'mongodb';

const g = globalThis;
const RETRY_AFTER_MS = 30_000;

export async function getMongo() {
  if (!g.__mongoDb) {
    if (g.__mongoDownUntil && Date.now() < g.__mongoDownUntil) throw new Error('MongoDB is not reachable');
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
    g.__mongoDb = client
      .connect()
      .then((c) => {
        g.__mongoDownUntil = 0;
        return c.db();
      })
      .catch((err) => {
        g.__mongoDb = null;
        g.__mongoDownUntil = Date.now() + RETRY_AFTER_MS;
        client.close().catch(() => {});
        throw err;
      });
  }
  return g.__mongoDb;
}

export async function tryMongo() {
  try {
    return await getMongo();
  } catch {
    return null;
  }
}
