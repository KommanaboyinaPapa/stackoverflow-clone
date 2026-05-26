const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { deletePost } = require('../controllers/socialController');

// DELETE /api/posts/:id
router.delete('/:id', auth, deletePost);

module.exports = router;
