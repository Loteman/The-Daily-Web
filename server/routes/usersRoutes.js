const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { listUsers, createUser, updateUser, deleteUser } = require('../services/userService');
const { logEvent } = require('../utils/logger');

router.use(requireAuth, requireRole('editor'));
router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  res.json(await listUsers(search));
});
router.post('/', async (req, res) => {
  const user = await createUser(req.body);
  logEvent('user_created', { idNumber: user.idNumber, byIdNumber: req.user.idNumber });
  res.status(201).json(user);
});
router.put('/:idNumber', async (req, res) => {
  const user = await updateUser(req.params.idNumber, req.body);
  logEvent('user_updated', { idNumber: user.idNumber, byIdNumber: req.user.idNumber });
  res.json(user);
});
router.delete('/:idNumber', async (req, res) => {
  await deleteUser(req.params.idNumber, req.user);
  logEvent('user_deleted', { idNumber: req.params.idNumber, byIdNumber: req.user.idNumber });
  res.status(204).end();
});
module.exports = router;
