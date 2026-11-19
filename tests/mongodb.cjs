const assert = require('node:assert/strict');
const db = require('../backend/db.cjs');

async function runTest() {
  console.log('Testing MongoDB connection and operations...');

  // 1. Check connection
  const conn = await db.checkConnection();
  assert.equal(conn.status, 'connected');
  assert.equal(conn.database, 'mealday');
  console.log('✓ MongoDB connection OK');

  // 2. Create test user
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const user = await db.createUser(testEmail, testPassword);
  assert(user.id);
  assert.equal(user.email, testEmail);
  console.log('✓ User creation OK');

  // 3. Verify user authentication
  const verified = await db.verifyUser(testEmail, testPassword);
  assert(verified);
  assert.equal(verified.id, user.id);
  const badAuth = await db.verifyUser(testEmail, 'wrong-password');
  assert.equal(badAuth, null);
  console.log('✓ Password verification OK');

  // 4. Session management
  const token = await db.createSession(user.id);
  assert(token);
  const session = await db.getSession(token);
  assert(session);
  assert.equal(session.user.id, user.id);
  assert.equal(session.user.email, testEmail);
  console.log('✓ Session creation & lookup OK');

  // 5. Account save & revision control
  const initialProfile = { name: 'Test User', people: 2, diet: 'Vegetarian' };
  const initialKitchen = { plan: [{ day: 0, recipeId: 'tomato-pasta' }], pantry: { tomato: 2 } };

  const saved1 = await db.saveAccount(user.id, initialProfile, initialKitchen, 0);
  assert.equal(saved1.revision, 1);
  assert.equal(saved1.profile.name, 'Test User');

  const fetched = await db.getAccount(user.id);
  assert.equal(fetched.revision, 1);
  assert.equal(fetched.profile.diet, 'Vegetarian');

  // Save next revision
  const saved2 = await db.saveAccount(user.id, { ...initialProfile, budget: 200 }, initialKitchen, 1);
  assert.equal(saved2.revision, 2);
  assert.equal(saved2.profile.budget, 200);

  // Test revision conflict
  await assert.rejects(
    async () => {
      await db.saveAccount(user.id, initialProfile, initialKitchen, 1); // Stale revision
    },
    /SYNC_CONFLICT/
  );
  console.log('✓ Account snapshot & atomic revision check OK');

  // 6. Plan history
  await db.savePlanHistory(user.id, [{ recipe_id: 'tomato-pasta' }, { recipe_id: 'lentil-rice' }]);
  const history = await db.getPlanHistory(user.id);
  assert.equal(history.length, 2);
  await db.clearPlanHistory(user.id);
  const cleared = await db.getPlanHistory(user.id);
  assert.equal(cleared.length, 0);
  console.log('✓ Plan history operations OK');

  // 7. Cleanup test data
  await db.deleteAccount(user.id);
  const afterDelete = await db.getAccount(user.id);
  assert.equal(afterDelete, null);
  console.log('✓ Cleanup OK');

  console.log('\nALL MONGODB TESTS PASSED SUCCESSFULLY! ✓\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
