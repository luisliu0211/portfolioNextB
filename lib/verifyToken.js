const jwt = require('jsonwebtoken');
const jwtSecretKey = 'luistest1234';
function verifyToken(req, res, next) {
  const token = req.cookies.userToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // 驗證 Token
  jwt.verify(token, jwtSecretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 將解碼後的用戶信息附加到 req 中
    req.decodedToken = decoded;
    next();
  });
}

module.exports = verifyToken;
