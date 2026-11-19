const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load .env file
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'mealday';

let client = null;
let db = null;

async function getClient() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB);

    // Initialize collections and indexes
    const users = db.collection('users');
    const sessions = db.collection('sessions');
    const accounts = db.collection('accounts');
    const planHistory = db.collection('plan_history');
    const recipes = db.collection('recipes');

    await users.createIndex({ email: 1 }, { unique: true });
    await sessions.createIndex({ token: 1 }, { unique: true });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await accounts.createIndex({ userId: 1 }, { unique: true });
    await planHistory.createIndex({ userId: 1, recipeId: 1 }, { unique: true });
    await recipes.createIndex({ id: 1 }, { unique: true });
  }
  return { client, db };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function createUser(email, password) {
  const { db } = await getClient();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.collection('users').findOne({ email: normalizedEmail });
  if (existing) {
    throw new Error('User already exists');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const userId = crypto.randomUUID();

  const user = {
    _id: userId,
    email: normalizedEmail,
    passwordHash,
    salt,
    createdAt: new Date()
  };

  await db.collection('users').insertOne(user);
  return { id: userId, email: normalizedEmail };
}

async function verifyUser(email, password) {
  const { db } = await getClient();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    return null;
  }

  const hash = hashPassword(password, user.salt);
  if (crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash))) {
    return { id: user._id, email: user.email };
  }
  return null;
}

async function createSession(userId) {
  const { db } = await getClient();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.collection('sessions').insertOne({
    token,
    userId,
    createdAt: new Date(),
    expiresAt
  });

  return token;
}

async function getSession(token) {
  if (!token) return null;
  const { db } = await getClient();
  const session = await db.collection('sessions').findOne({
    token,
    expiresAt: { $gt: new Date() }
  });
  if (!session) return null;

  const user = await db.collection('users').findOne({ _id: session.userId });
  if (!user) return null;

  return {
    access_token: token,
    user: { id: user._id, email: user.email }
  };
}

async function deleteSession(token) {
  if (!token) return;
  const { db } = await getClient();
  await db.collection('sessions').deleteOne({ token });
}

async function getAccount(userId) {
  const { db } = await getClient();
  const account = await db.collection('accounts').findOne({ userId });
  if (!account) return null;
  return {
    user_id: account.userId,
    profile: account.profile || {},
    kitchen: account.kitchen || {},
    revision: account.revision || 1,
    updated_at: account.updatedAt || new Date()
  };
}

async function saveAccount(userId, profile, kitchen, clientRevision) {
  const { db } = await getClient();
  const accounts = db.collection('accounts');
  const current = await accounts.findOne({ userId });

  if (!current) {
    // First save
    const newDoc = {
      userId,
      profile: profile || {},
      kitchen: kitchen || {},
      revision: 1,
      updatedAt: new Date()
    };
    await accounts.insertOne(newDoc);
    return {
      user_id: userId,
      profile: newDoc.profile,
      kitchen: newDoc.kitchen,
      revision: 1
    };
  }

  // Revision conflict check
  const currentRev = Number(current.revision || 1);
  const expectedRev = Number(clientRevision || 0);

  if (expectedRev !== 0 && expectedRev !== currentRev) {
    throw new Error('SYNC_CONFLICT: Reload your account before saving');
  }

  const nextRev = currentRev + 1;
  const updated = await accounts.findOneAndUpdate(
    { userId, revision: currentRev },
    {
      $set: {
        profile: profile || {},
        kitchen: kitchen || {},
        revision: nextRev,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw new Error('SYNC_CONFLICT: Reload your account before saving');
  }

  return {
    user_id: userId,
    profile: updated.profile,
    kitchen: updated.kitchen,
    revision: updated.revision
  };
}

async function deleteAccount(userId) {
  const { db } = await getClient();
  await db.collection('users').deleteOne({ _id: userId });
  await db.collection('accounts').deleteOne({ userId });
  await db.collection('sessions').deleteMany({ userId });
  await db.collection('plan_history').deleteMany({ userId });
  return { deleted: true };
}

async function getPlanHistory(userId) {
  const { db } = await getClient();
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const rows = await db.collection('plan_history')
    .find({ userId, suggestedAt: { $gte: cutoff } })
    .sort({ suggestedAt: -1 })
    .limit(1000)
    .toArray();

  return rows.map(r => ({
    recipe_id: r.recipeId,
    suggested_at: r.suggestedAt.toISOString()
  }));
}

async function savePlanHistory(userId, items) {
  const { db } = await getClient();
  const col = db.collection('plan_history');
  const now = new Date();

  for (const item of items) {
    await col.updateOne(
      { userId, recipeId: item.recipe_id },
      { $set: { suggestedAt: now } },
      { upsert: true }
    );
  }
}

async function clearPlanHistory(userId) {
  const { db } = await getClient();
  await db.collection('plan_history').deleteMany({ userId });
}

async function seedCatalogueIfEmpty(recipes, ingredients) {
  const { db } = await getClient();
  const count = await db.collection('recipes').countDocuments();
  if (count === 0 && Array.isArray(recipes) && recipes.length > 0) {
    const docs = recipes.map(r => ({
      id: r.id,
      cuisine: r.cuisine || 'UAE mix',
      data: r,
      ingredients: ingredients || {},
      published: true,
      updatedAt: new Date()
    }));
    await db.collection('recipes').insertMany(docs);
  }
}

async function getCatalogue() {
  const { db } = await getClient();
  return await db.collection('recipes').find({ published: true }).limit(500).toArray();
}

async function checkConnection() {
  const { client, db } = await getClient();
  await db.command({ ping: 1 });
  return {
    status: 'connected',
    uri: MONGODB_URI,
    database: MONGODB_DB
  };
}

module.exports = {
  getClient,
  createUser,
  verifyUser,
  createSession,
  getSession,
  deleteSession,
  getAccount,
  saveAccount,
  deleteAccount,
  getPlanHistory,
  savePlanHistory,
  clearPlanHistory,
  seedCatalogueIfEmpty,
  getCatalogue,
  checkConnection,
  MONGODB_URI,
  MONGODB_DB
};
