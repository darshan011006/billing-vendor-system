// Creates the MongoDB collections, schema validators and indexes. Safe to run again.
//   notification_logs  every WhatsApp message (bill, order status, vendor payment, OTP, low stock)
//   otp_sessions       login codes awaiting verification (TTL index deletes them after 5 minutes)
//   product_vectors    one 256-number embedding per product, for vector similarity search
const { DIMS } = require('./embedding');

const notificationValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['type', 'to', 'template', 'status', 'createdAt'],
    properties: {
      type: { enum: ['bill', 'order_status', 'vendor_payment', 'otp', 'low_stock'] },
      to: { bsonType: 'string', pattern: '^91[0-9]{10}$' },
      template: { bsonType: 'string' },
      status: { enum: ['queued', 'sent', 'delivered', 'read', 'failed'] },
      attempts: { bsonType: 'int', minimum: 0, maximum: 5 },
      ref: { bsonType: 'object', properties: { table: { bsonType: 'string' }, id: { bsonType: 'int' } } },
      payload: { bsonType: 'object' },
      createdAt: { bsonType: 'date' },
    },
  },
};

const vectorValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['productId', 'name', 'embedding', 'model', 'updatedAt'],
    properties: {
      productId: { bsonType: 'int' },
      name: { bsonType: 'string' },
      embedding: { bsonType: 'array', minItems: DIMS, maxItems: DIMS, items: { bsonType: ['double', 'int'] } },
      model: { bsonType: 'string' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

async function ensureCollection(db, existing, name, validator) {
  if (!existing.includes(name)) {
    await db.createCollection(name, validator ? { validator, validationAction: 'error' } : {});
  } else if (validator) {
    await db.command({ collMod: name, validator, validationAction: 'error' });
  }
}

async function initMongo(db) {
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  await ensureCollection(db, existing, 'notification_logs', notificationValidator);
  await ensureCollection(db, existing, 'otp_sessions');
  await ensureCollection(db, existing, 'product_vectors', vectorValidator);

  const logs = db.collection('notification_logs');
  await logs.createIndex({ type: 1, status: 1, createdAt: -1 });
  await logs.createIndex({ 'ref.table': 1, 'ref.id': 1 });
  await logs.createIndex({ createdAt: 1 }, { partialFilterExpression: { status: 'failed' }, name: 'failed_by_date' });
  await logs.createIndex({ waMessageId: 1 }, { sparse: true });

  const otp = db.collection('otp_sessions');
  await otp.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
  await otp.createIndex({ userId: 1 });

  await db.collection('product_vectors').createIndex({ productId: 1 }, { unique: true });
}

module.exports = { initMongo };
