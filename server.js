// 引入必要的模块
const express = require('express');
const cors = require('cors'); // 引入 CORS 模組
const mysql = require('mysql2');
const fs = require('fs');
const matter = require('gray-matter');
const path = require('path');
const port = 8080;
const app = express();
app.use(
  cors({
    origin: '*',
    optionsSuccessStatus: 200,
  })
);
// 创建 Express 应用
require('dotenv').config();
// 创建数据库连接
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to database');
});

// 定义一个简单的路由，从数据库获取数据
app.get('/api/works', (req, res) => {
  // 执行数据库查询
  console.log('Received API request');
  db.query('SELECT * FROM works', (error, results, fields) => {
    if (error) {
      console.error('Error executing query: ' + error.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    console.log('Query executed successfully');
    res.json(results);
    // 将查询结果发送给前端
  });
});
app.get('/api/skills', (req, res) => {
  // 执行数据库查询
  console.log('Received API request');
  db.query('SELECT * FROM skills', (error, results, fields) => {
    if (error) {
      console.error('Error executing query: ' + error.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    // console.log('Query executed successfully');
    res.json(results);
    // 将查询结果发送给前端
  });
});
app.get('/api/posts', (req, res) => {
  // 执行数据库查询
  console.log('Received API request');
  db.query('SELECT * FROM posts', (error, results, fields) => {
    if (error) {
      console.error('Error executing query: ' + error.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    // console.log('Query executed successfully');
    res.json(results);
    // 将查询结果发送给前端
  });
});
app.get('/api/posts/:id', (req, res) => {
  // 执行数据库查询
  const postId = req.params.id;
  console.log('Received API request');
  db.query(
    'SELECT * FROM post_Detail WHERE id=?',
    [postId],
    (error, results, fields) => {
      if (error) {
        console.error('Error executing query: ' + error.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      // console.log('Query executed successfully');
      res.json(results);
      // 将查询结果发送给前端
    }
  );
});
app.get('/api/posts/markdownPost/:id', (req, res) => {
  const postId = req.params.id;
  console.log(postId);
  //指定資料夾位置
  // 建立一個路徑，表示要讀取的目錄。path.join(process.cwd(), 'post_md') 會返回一個絕對路徑，這個路徑是當前工作目錄（process.cwd()）下的 post_md 目錄。
  const postsDirectory = path.join(process.cwd(), 'post_md');
  // 使用 fs.readdirSync 同步讀取目錄下的所有檔案名稱，將這些名稱存儲在 fileNames 陣列中。
  const fileNames = fs.readdirSync(postsDirectory);

  const allPostsData = fileNames.map((fileName) => {
    // 移除名稱中的 ".md"，並將它當作 id
    const id = fileName.replace(/\.md$/, '');
    // 將 markdown 內容轉換為字串
    //fullPath：使用 path.join 組合目錄路徑和檔案名稱，得到檔案的完整路徑。
    const fullPath = path.join(postsDirectory, fileName);
    //fileContents：使用 fs.readFileSync 同步讀取檔案的內容，得到檔案內容的字串。
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    // 使用 gray-matter 解析 metadata 區塊
    const matterResult = matter(fileContents);
    // 將資料與 id 結合
    return {
      id,
      ...matterResult,
    };
  });
  res.json(allPostsData);
});

// 启动 Express 应用
const PORT = process.env.PORT || port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
