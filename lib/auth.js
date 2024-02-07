function authMiddleware(req, res, next) {
  if (req.session.user) {
    console.log('已驗證');
    next();
  } else {
    console.log('尚未驗證');
    res.json({ success: false, message: '尚未驗證' });
    return;
  }
}

module.exports = authMiddleware;
