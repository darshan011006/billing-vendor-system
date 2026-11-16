// Creates the MongoDB collections, schema validator and indexes (Section 6 of the report).
// Used by scripts/setup-db.mjs; safe to run again.

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

async function initMongo(db) {
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);

  if (!existing.includes('notification_logs')) {
    await db.createCollection('notification_logs', { validator: notificationValidator, validationAction: 'error' });
  } else {
    await db.command({ collMod: 'notification_logs', validator: notificationValidator, validationAction: 'error' });
  }
  if (!existing.includes('otp_sessions')) await db.createCollection('otp_sessions');

  const logs = db.collection('notification_logs');
  await logs.createIndex({ type: 1, status: 1, createdAt: -1 });
  await logs.createIndex({ 'ref.table': 1, 'ref.id': 1 });
  await logs.createIndex({ createdAt: 1 }, { partialFilterExpression: { status: 'failed' }, name: 'failed_by_date' });
  await logs.createIndex({ waMessageId: 1 }, { sparse: true });

  const otp = db.collection('otp_sessions');
  await otp.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
  await otp.createIndex({ userId: 1 });
}

module.exports = { initMongo };
