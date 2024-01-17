// 引入必要的模块
const express = require('express');
const cors = require('cors'); // 引入 CORS 模組
const mysql = require('mysql2');
const matter = require('gray-matter');
const path = require('path');
const port = 8080;
const fs = require('fs');
const fs_promises = require('fs/promises');
const app = express();
const { v4: uuidv4 } = require('uuid');
// 上傳用的套 multer
const multer = require('multer');
const cookieParser = require('cookie-parser');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
// 設定 Multer 存入的空間
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploadsImages/'); // 指定存儲的目錄
//   },
//   filename: function (req, file, cb) {
//     // 使用原始檔名，但避免名稱冲突
//     const uniqueFilename = `${uuidv4()}.jpg`;
//     cb(null, uniqueFilename);
//   },
// });

// 設定 Multer
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploadsImages/'); // 指定存儲的目錄
    },
    filename: function (req, file, cb) {
      // 使用原始檔名，但避免名稱冲突
      const uniqueFilename = `${uuidv4()}.jpg`;
      cb(null, uniqueFilename);
    },
  }),
  limits: {
    fileSize: Infinity,
  },
  fileFilter: (req, file, cb) => {
    // 檢查文件的類型，只接受圖片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});
app.use(cookieParser());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://portfolio-next-neon.vercel.app'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://portfolio-next-neon.vercel.app',
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header('Access-Control-Allow-Credentials', 'true');

  next();
});
// 開啟 CORS
app.use('/uploadsImages', express.static('uploadsImages'));
app.use('/uploadsMarkdown', express.static('uploadsMarkdown'));
app.use('/public', express.static('public'));
// 创建 Express 应用
require('dotenv').config();
// 创建数据库连接
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
});
db.connect((err) => {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }
  console.log('Connected to database');
});
// 使用中間件解析 JSON 格式的請求主體
app.use(express.json());
app.get('/', (req, res) => {
  res.cookie('mycookie', 'myvalue', {
    sameSite: 'None',
    secure: true,
  });
  res.send('Hello World!');
});
app.get('/public/quotationList.xlsx', (req, res) => {
  // 其他程式碼...
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  // 組合絕對路徑，注意這裡使用 __dirname 取得當前檔案的目錄
  const filePath = path.join(__dirname, 'public', 'quotationList.xlsx');
  // 發送 Excel 檔案
  res.sendFile(filePath);
});

// TODO:權限登入驗證
// 定义验证凭证的路由
app.post('/api/auth/verify-credentials', async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);
  try {
    // 1. 从数据库中检索用户记录
    const queryEmail = 'SELECT * FROM user_account WHERE email = ?';
    const [user] = await db.promise().query(queryEmail, [email]);

    if (user.length === 1) {
      // 2. 检查密码是否匹配
      const hashedPassword = user[0].password;
      // const passwordMatch = await bcrypt.compare(password, hashedPassword);
      console.log(hashedPassword, 'password in DB');
      // TODO: 密碼要hash過才能存入
      if (password === hashedPassword) {
        console.log('使用者登入成功');
        console.log(user);
        const userId = user[0].id;
        res.status(200).json({
          message: '用户验证成功',
          user: {
            id: user[0].id, // 用户的 ID
            name: user[0].name, // 用户的名称
            email: user[0].email,
            accountType: user[0].account_type,
            image: user[0].image,
          },
        });
      } else {
        console.log('密码不匹配');
        res.status(401).json({ error: '密碼不匹配' });
      }
    } else {
      console.log('找不到用户');
      res.status(401).json({ message: '找不到用户' });
    }
  } catch (error) {
    console.error('数据库查询错误:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// 定义一个简单的路由，从数据库获取数据
app.get('/api/works', (req, res) => {
  // 执行数据库查询
  console.log('Received API request');
  db.query('SELECT * FROM works LIMIT 8', (error, results, fields) => {
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
// 验证文件类型为Markdown
const markdownfileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'text/markdown' ||
    file.mimetype === 'application/octet-stream'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only Markdown files are allowed'), false);
  }
};
const storage = multer.memoryStorage();
const uploadMarkdown = multer({
  storage: storage,
  fileFilter: markdownfileFilter,
});
// 前端上傳md黨存到後端
// app.post(
//   '/api/posts/markDown',
//   uploadMarkdown.single('file'),
//   async (req, res) => {
//     try {
//       const {
//         title,
//         subTitle,
//         category,
//         tags,
//         contentType,
//         coverImg,
//         create_date,
//       } = JSON.parse(req.body.postDetail);
//       const markdownBuffer = req.file.buffer;

//       console.log(title, subTitle, category, JSON.stringify(tags), contentType);
//       const markdownContent = markdownBuffer.toString('utf-8');
//       // const uploadFolderPath = path.join(__dirname, 'uploadsMd');
//       // const fileName = `markdown_${Date.now()}.md`;
//       // const filePath = path.join(uploadFolderPath, fileName);
//       // 使用 markdown-it 将 Markdown 转换为 HTML
//       const htmlContent = md.render(markdownContent);
//       const savedHtmlContent = htmlContent.toString();
//       // console.log(savedHtmlContent, '轉成html標籤字串');
//       // console.log(htmlContent, '轉成html');
//       // console.log(markdownContent, '直接存成markdown格式');
//       // console.log(markdownBuffer, 'buttfr 2進位檔案');
//       const sql =
//         'INSERT INTO posts (title, subTitle, category, tags, content, contentType, coverImage, create_date,authur) VALUES (?, ?, ?, ?, ?, ? ,? ,? ,?)';

//       db.query(
//         sql,
//         [
//           title,
//           subTitle,
//           category,
//           JSON.stringify(tags),
//           markdownContent,
//           contentType,
//           coverImg,
//           create_date,
//           1,
//         ],
//         (err, result) => {
//           if (err) {
//             console.error('Error storing data in MySQL:', err);
//             res
//               .status(500)
//               .json({ success: false, error: 'Error storing data' });
//           } else {
//             console.log('Data stored in MySQL:', result);
//             res
//               .status(200)
//               .json({ success: true, htmlContent: markdownContent });
//           }
//         }
//       );

//       // // 确保文件夹存在，如果不存在则创建
//       // if (!fs.existsSync(uploadFolderPath)) {
//       //   fs.mkdirSync(uploadFolderPath, { recursive: true });
//       // }

//       // // 写入文件
//       // fs.writeFileSync(filePath, markdownContent);

//       // // 将HTML内容保存到文件或数据库，这里只是简单地打印出来
//       console.log(savedHtmlContent);

//       // res.status(200).json({ success: true, htmlContent: savedHtmlContent });
//     } catch (error) {
//       console.error('Error processing file:', error);
//       res.status(500).json({ success: false, error: 'Error processing file' });
//     }
//   }
// );
// 取得後端的md靜態欓 渲染到前端
app.get('/api/posts/markdown', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'uploadsMd', 'markdowntest.md');
    const markdownContent = await fs_promises.readFile(filePath, 'utf-8');
    console.log(markdownContent);
    res.json({ markdownContent: markdownContent });
  } catch (error) {
    console.error('Error reading Markdown file:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/saveLoginData', (req, res) => {
  const { name, email, password } = req.body;
  // TODO: 檢查email是否重複 有重複返回 該信箱已註冊的提示
  const queryEmailTaken = 'SELECT * FROM user_account WHERE email = ?';
  db.query(queryEmailTaken, [email], (err, queryRes) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    // 如果查詢結果中有資料，表示 email 已被使用
    if (queryRes.length > 0) {
      console.log(queryRes);
      res.status(400).json({ message: 'Email already registered' });
      return;
    } else {
      // 如果查詢結果中沒有資料，表示 email 未被使用，執行新增資料的操作
      const queryInsertNew =
        'INSERT INTO user_account (name, email, password, account_type) VALUES (?, ?, ?, 1)';
      db.query(queryInsertNew, [name, email, password], (err, insertRes) => {
        if (err) {
          console.error('Error executing insert query: ' + err.stack);
          res.status(500).send('Internal Server Error');
          return;
        }
        console.log('Insert query executed successfully');
        res.status(200).json({ message: 'Data saved successfully' });
      });
    }
  });
});
app.post('/api/json/saveFile', (req, res) => {
  const jsonData = req.body.data;
  const title = req.body.title;
  console.log(jsonData);
  const outputPath = path.join(__dirname, 'public', 'database'); // 指定目錄 'output'
  // const jsonString = JSON.stringify(jsonData, null, 2);
  // res.setHeader('Content-Type', 'application/json'); // 設定 Content-Type 為 application/json
  fs.writeFileSync(path.join(outputPath, `${title}.json`), jsonData);
  res.status(200).json({ message: 'Data saved successfully.' });
});
app.get('/api/json/readFile', (req, res) => {
  const fileTitle = req.query.fileName;
  const filePath = path.join(
    __dirname,
    'public',
    'database',
    `${fileTitle}.json`
  );
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      try {
        const jsonData = JSON.parse(data);
        res.json(jsonData);
      } catch (parseError) {
        console.error('Error parsing JSON data:', parseError);
        res.status(500).json({ error: 'Error parsing JSON data' });
      }
    }
  });
});
app.put('/api/user/update', (req, res) => {
  const updatedUserData = req.body; // 從請求主體中獲取更新的用戶數據
  const { name, gender, password, character, image, id } = updatedUserData;
  const queryId =
    'UPDATE user_account SET name=?, gender=?, password=?, userType=?, image=? WHERE id=?';
  db.query(
    queryId,
    [name, gender, password, character, image, id],
    (err, queryRes) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log('Insert query executed successfully');
      res.status(200).json({ message: 'Data saved successfully' });
    }
  );
  // 在這裡執行更新數據到數據庫的邏輯
  // 這裡的邏輯應該根據你的數據庫結構進行修改
});
// TODO: 上傳圖片預覽檔案
//uploadImage.single('image')
app.post('/api/uploadImages', (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No image provided');
    }
    // 在 req.file 中可以獲取上傳的文件信息
    const filePath = path.join(__dirname, 'uploadsImages', req.file.filename);
    // 可以在這裡進行進一步的處理，例如將檔案路徑存入資料庫

    res.status(200).json({
      message: 'Image uploaded successfully',
      // uniqueFilename: req.file.filename, //
      // filePath: filePath,
    });
  } catch (error) {
    console.error('Error uploading image:', error.message);
    res.status(400).json({ error: error.message });
  }
});
app.get('/api/quotes/:id', (req, res) => {
  // 执行数据库查询
  const quoteId = req.params.id;
  console.log(quoteId);
  console.log('Received API request');
  db.query(
    'SELECT * FROM quotationList WHERE id=?',
    [quoteId],
    (error, results, fields) => {
      if (error) {
        console.error('Error executing query: ' + error.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log(results, 'rr');
      // console.log('Query executed successfully');
      res.json(results);
      // 将查询结果发送给前端
    }
  );
});
app.get('/api/posts/:id', (req, res) => {
  // 执行数据库查询
  const postId = req.params.id;

  console.log(postId, 'postID');
  console.log('Received API request');
  db.query(
    'SELECT * FROM posts WHERE id=?',
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
// app.get('/api/posts/markdownPost/:id', (req, res) => {
//   const postId = req.params.id;
//   //指定資料夾位置
//   // 建立一個路徑，表示要讀取的目錄。path.join(process.cwd(), 'post_md') 會返回一個絕對路徑，這個路徑是當前工作目錄（process.cwd()）下的 post_md 目錄。
//   const postsDirectory = path.join(process.cwd(), 'post_md');
//   // 使用 fs.readdirSync 同步讀取目錄下的所有檔案名稱，將這些名稱存儲在 fileNames 陣列中。
//   const fileNames = fs.readdirSync(postsDirectory);

//   const allPostsData = fileNames.map((fileName) => {
//     // 移除名稱中的 ".md"，並將它當作 id
//     const id = fileName.replace(/\.md$/, '');
//     // 將 markdown 內容轉換為字串
//     //fullPath：使用 path.join 組合目錄路徑和檔案名稱，得到檔案的完整路徑。
//     const fullPath = path.join(postsDirectory, fileName);
//     //fileContents：使用 fs.readFileSync 同步讀取檔案的內容，得到檔案內容的字串。
//     const fileContents = fs.readFileSync(fullPath, 'utf8');
//     // 使用 gray-matter 解析 metadata 區塊
//     const matterResult = matter(fileContents);
//     // 將資料與 id 結合
//     return {
//       id,
//       ...matterResult,
//     };
//   });
//   res.json(allPostsData);
// });
app.get('/api/todoList', (req, res) => {
  const querySelect = 'SELECT * FROM todoList where user_id=?';

  db.query(querySelect, [1], (err, result) => {
    if (err) {
      console.error('Error executing insert query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    console.log('Insert query executed successfully');
    res.json(result);
    // res.status(200).json({ message: 'Data query successfully' });
  });
});
app.get('/api/quotations', (req, res) => {
  // const { select } = req.query;
  console.log(req.query);
  // 从查询参数中获取 selectedRows
  const { selected } = req.query;
  // 将 selectedRows 转换为数组
  let selectedRowsArray;
  let querySelect;
  if (selected) {
    selectedRowsArray = selected.split(',');
    querySelect = `SELECT * FROM quotationList WHERE id IN (${selectedRowsArray.join(
      ','
    )})`;
  } else {
    querySelect = `SELECT * FROM quotationList`;
  }

  db.query(querySelect, (err, result) => {
    if (err) {
      console.error('Error executing insert query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }

    res.json(result);
    // res.status(200).json({ message: 'Data query successfully' });
  });
});
app.post('/api/quotationAdd', (req, res) => {
  const { quote } = req.body;
  console.log(quote, 'qqq');
  let {
    userId,
    createDate,
    lastRevise,
    state,
    fabricInfo: {
      clientId,
      fabricItem,
      description,
      width,
      gsm,
      gy,
      brand,
      fabricSpecStr,
    },
    yarnCost: {
      machineType,
      machineSpec,
      other,
      densityWarp,
      densityWeft,
      fabricProcessFee,
      fabricCost,
      totalWastage,
      totalYarnCost,
      portionText,
      yarnTextStr,
      yarnInfoList, //TBA
    },
    salesCost: {
      excuteCost,
      shippingCost,
      testingCost,
      profit,
      exchangeRate,
      tradeTerm,
      quoteDueDate,
      quoteUSDY,
      quoteUSDM,
      quoteTWDY,
      quoteTWDM,
      costTWDKG,
      costUSDKG,
      costUSDY,
    },
    dyeCost: {
      dyeAverageCost,
      process,
      specialProcess,
      RDReference,
      totalCost,
    },
  } = quote;
  const columnValues = {
    userId: userId,
    team: 1,
    createDate: createDate,
    lastRevise: lastRevise,
    state: state,
    fabricSpecStr: fabricSpecStr,
    clientId: clientId,
    fabricItem: fabricItem,
    description: description,
    width: width,
    gsm: gsm,
    gy: gy,
    brand: brand,
    machineType: machineType,
    machineSpec: machineSpec,
    other: other,
    densityWarp: densityWarp,
    densityWeft: densityWeft,
    fabricProcessFee: fabricProcessFee,
    fabricCost: fabricCost,
    totalWastage: totalWastage,
    totalYarnCost: totalYarnCost,
    portionText: portionText,
    yarnTextStr: yarnTextStr,
    dyeCost: dyeAverageCost,
    process: JSON.stringify(process),
    specialProcess: JSON.stringify(specialProcess),
    totalCost: totalCost,
    RDReference: RDReference,
    excuteCost: excuteCost,
    shippingCost: shippingCost,
    testingCost: testingCost,
    profit: profit,
    exchangeRate: exchangeRate,
    tradeTerm: tradeTerm,
    quoteDue: quoteDueDate,
    quoteUSDY: quoteUSDY,
    quoteUSDM: quoteUSDM,
    quoteTWDY: quoteTWDY,
    quoteTWDM: quoteTWDM,
    costTWDKG: costTWDKG,
    costUSDKG: costUSDKG,
    costUSDY: costUSDY,
    yarnInfoList: JSON.stringify(yarnInfoList),
  };
  console.log(columnValues, 'v');
  const columns = Object.keys(columnValues).join(',');
  console.log(Object.keys(columnValues));
  const values = Object.values(columnValues);
  const placeholders = values.map(() => '?').join(',');
  const queryInsertNew = `INSERT INTO quotationList (${columns}) VALUES (${placeholders})`;
  console.log(values);
  db.query(queryInsertNew, values, (error, results) => {
    if (error) {
      console.error('執行插入查詢時發生錯誤：' + error.stack);
      res.status(500).send('內部伺服器錯誤');
      return;
    }
    console.log('插入查詢成功執行');
    // 在數據庫操作完成後發送回應
    res.status(200).json({ message: '數據傳遞成功' });
  });
});
app.post('/api/todoList', (req, res) => {
  const { todos } = req.body;
  todos.forEach((todo) => {
    const { todoContent, complete, date } = todo;
    const queryInsertNew =
      'INSERT INTO todoList (user_id, text, date, complete) VALUES (1, ?, ?, ?)';

    db.query(queryInsertNew, [todoContent, date, complete], (err, result) => {
      if (err) {
        console.error('Error executing insert query: ' + err.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log('Insert query executed successfully');
    });
  });

  res.status(200).json({ message: 'Data saved successfully' });
});
///=====//
app.get('/api/posts', (req, res) => {
  console.log('filter:', req.query);
  const { order, dateRangeFrom, dateRangeTo, category, keywordSearch, tags } =
    req.query;
  console.log(tags);
  // tags切換為陣列
  const tagsArray = tags ? tags.split(',') : [];
  // console.log(tagsArray.join(','), 'a');
  console.log(tagsArray);
  // 构建 SQL 查询语句
  let sqlQuery = 'SELECT * FROM posts WHERE 1 = 1';
  if (dateRangeFrom) {
    sqlQuery += ` AND create_date >= '${dateRangeFrom}'`;
  }
  if (dateRangeTo) {
    sqlQuery += ` AND create_date <= '${dateRangeTo}'`;
  }
  if (category) {
    sqlQuery += ` AND category = '${category}'`;
  }
  if (keywordSearch) {
    sqlQuery += ` AND TRIM(title) LIKE '%${keywordSearch}%'`;
  }
  if (tagsArray.length > 0) {
    sqlQuery += `AND JSON_CONTAINS(tags, '${JSON.stringify(tagsArray)}') = 1`;
  }
  if (order) {
    sqlQuery += ` ORDER BY create_date ${order}`;
  }
  console.log(sqlQuery);
  db.query(sqlQuery, (error, results) => {
    if (error) {
      console.error('查詢時發生錯誤: ' + error.stack);
      res.status(500).send('內部伺服器錯誤');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    // 返回 JSON 數據
    // console.log(sqlQuery, 'jiji');
    console.log('Query executed successfully');
    // console.log(results);
    res.json(results);
    // 將查詢結果發送給前端
  });
});
app.post(
  '/api/posts/mdFile',
  uploadMarkdown.single('file'),
  async (req, res) => {
    console.log('inin', req.body);
    try {
      const {
        title,
        subTitle,
        category,
        tags,
        contentType,
        coverImg,
        create_date,
      } = JSON.parse(req.body.postDetail);
      const markdownBuffer = req.file.buffer;
      console.log(markdownBuffer, 'bb');
      const markdownContent = markdownBuffer.toString('utf-8');
      // 使用 markdown-it 将 Markdown 转换为 HTML
      const htmlContent = md.render(markdownContent);
      const savedHtmlContent = htmlContent.toString();
      console.log(savedHtmlContent, '轉成html標籤字串');
      // console.log(htmlContent, '轉成html');
      // console.log(markdownContent, '直接存成markdown格式');
      // console.log(markdownBuffer, 'buttfr 2進位檔案');
      const sql =
        'INSERT INTO posts (title, subTitle, category, tags, content, contentType, coverImage, create_date,authur) VALUES (?, ?, ?, ?, ?, ? ,? ,? ,?)';
      db.query(
        sql,
        [
          title,
          subTitle,
          category,
          JSON.stringify(tags),
          markdownContent,
          contentType,
          coverImg,
          create_date,
          1,
        ],
        (err, result) => {
          if (err) {
            console.error('Error storing data in MySQL:', err);
            res
              .status(500)
              .json({ success: false, error: 'Error storing data' });
          } else {
            console.log('Data stored in MySQL:', result);
            res
              .status(200)
              .json({ success: true, htmlContent: markdownContent });
          }
        }
      );
      console.log(savedHtmlContent);
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ success: false, error: 'Error processing file' });
    }
  }
);
app.post('/api/posts', (req, res) => {
  try {
    console.log(req.body);
    const {
      title,
      subTitle,
      category,
      tags,
      contentType,
      coverImg,
      content,
      create_date,
      coverB64,
    } = req.body;
    console.log(
      title,
      subTitle,
      category,
      tags,
      contentType,
      coverImg,
      create_date,
      content,
      coverB64
    );
    const sql =
      'INSERT INTO posts (title, subTitle, category, tags, content, contentType, coverImage, create_date,authur) VALUES (?, ?, ?, ?, ?, ? ,? ,? ,1)';
    db.query(
      sql,
      [
        title,
        subTitle,
        category,
        JSON.stringify(tags),
        content,
        contentType,
        coverImg,
        create_date,
        1,
      ],
      (err, result) => {
        if (err) {
          console.error('Error storing data in MySQL:', err);
          res.status(500).json({ success: false, error: 'Error storing data' });
        } else {
          console.log('Data stored in MySQL:', result);
          res.status(200).json({ success: true, htmlContent: content });
        }
      }
    );
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({ success: false, err: 'Error processing file' });
  }
});

// 启动 Express 应用
const PORT = process.env.PORT || port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
