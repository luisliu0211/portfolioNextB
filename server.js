// 引入必要的模块
const express = require('express');
const session = require('express-session');
const cors = require('cors'); // 引入 CORS 模組
const mysql = require('mysql2');
const path = require('path');
const port = 8080;
const fs = require('fs');
const fs_promises = require('fs/promises');
const app = express();
const { v4: uuidv4 } = require('uuid');
// 上傳用的套 multer
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();
const auth = require('./lib/auth');
const verifyToken = require('./lib/verifyToken');
const generateToken = require('./lib/generateCrypto');
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
// 使用中間件解析 JSON 格式的請求主體
app.use(express.json());

app.use(cookieParser());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://portfolio-next-neon.vercel.app',
      'https://luis.zeabur.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  })
);
app.use(
  session({
    secret: 'luisgood', // 用於簽署 session ID 的密鑰
    name: 'luistestsession', // 存放在cookie的key，如果不寫的話預設是connect.sid
    resave: false,
    //如果設定為true，則在一個request中，無論session有沒有被修改過，都會強制保存原本的session在session store。
    // 會有這個設定是因為每個session store會有不一樣的配置，有些會定期去清理session，如果不想要session被清理掉的話，就要把這個設定為true。
    saveUninitialized: false,
    //設定為false可以避免存放太多空的session進入session store。
    //另外，如果設為false，session在還沒被修改前也不會被存入cookie。
    cookie: {
      maxAge: 900000, // 這裡設定 session 的過期時間
      httpOnly: true,
    },
  })
);
app.use((req, res, next) => {
  // 設定全域header
  const allowedOrigins = [
    'http://localhost:3000',
    'https://portfolio-next-neon.vercel.app',
    'https://luis.zeabur.app',
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
// 提供靜態資源
// 當使用者訪問這個路徑時，Express 會去 該資料夾中尋找相對應的靜態資源並回傳給使用者
app.use('/uploadsImages', express.static('uploadsImages'));
app.use('/uploadsMarkdown', express.static('uploadsMarkdown'));
app.use('/public', express.static('public'));
require('dotenv').config();
// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE,
//   port: process.env.DB_PORT,
// });
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
// 测试连接池
pool.getConnection((err, connection) => {
  if (err) {
    console.error('数据库连接池错误:', err);
    console.error('环境变量:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_DATABASE,
      port: process.env.DB_PORT,
    });
    return;
  }
  console.log('数据库连接池创建成功');
  console.log('当前数据库配置:', {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
  });
  connection.release(); // 记得释放连接
});
// 添加错误监听
pool.on('error', (err) => {
  console.error('连接池错误:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('数据库连接丢失，请检查数据库状态');
  }
});
// db.connect((err) => {
//   if (err) {
//     console.error('Database connection failed: ' + err.stack);
//     return;
//   }
//   console.log('Connected to database');
//   console.log(process.env.DB_HOST);
//   console.log(process.env.DB_USER);
//   console.log(process.env.DB_PASSWORD);
//   console.log(process.env.DB_DATABASE);
//   console.log(process.env.DB_PORT);
// });

app.get('/', (req, res) => {
  res.send('welcom to my world');
});
app.get('/public/quotationList.xlsx', (req, res) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  // 使用 __dirname 取得當前檔案的目錄
  const filePath = path.join(__dirname, 'public', 'quotationList.xlsx');
  // 發送 Excel 檔案
  res.sendFile(filePath);
});

// TODO:權限登入驗證
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
app.get('/api/works', (req, res) => {
  console.log('查詢作品集');
  pool.query('SELECT * FROM works LIMIT 8', (error, results, fields) => {
    if (error) {
      console.error('Error executing query: ' + error.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(results);
  });
});
app.get('/api/skills', (req, res) => {
  console.log('查詢技能表');
  pool.query(
    'SELECT skills.id,skills.name AS skill_name,skills.level,skills.description,skill_categories.category_name FROM skills JOIN skill_categories ON skills.category_id = skill_categories.id;',
    (error, results, fields) => {
      if (error) {
        console.error('Error executing query: ' + error.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.json(results);
    }
  );
});
// 驗證文件是否是Markdown
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
app.get('/api/test', (req, res) => {
  res.json({ message: 'API 测试路由正常' });
});
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
  pool.query(queryEmailTaken, [email], (err, queryRes) => {
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
      pool.query(queryInsertNew, [name, email, password], (err, insertRes) => {
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
  const updatedUserData = req.body;
  const { name, gender, password, character, image, id } = updatedUserData;
  const queryId =
    'UPDATE user_account SET name=?, gender=?, password=?, userType=?, image=? WHERE id=?';
  pool.query(
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
  const quoteId = req.params.id;
  console.log('查詢報價');
  pool.query(
    'SELECT * FROM quotationList WHERE id=?',
    [quoteId],
    (error, results, fields) => {
      if (error) {
        console.error('Error executing query: ' + error.stack);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log(results, 'rr');
      res.json(results);
    }
  );
});
app.get('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  console.log(postId, 'postID');
  console.log('查詢文章');
  pool.query(
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
  pool.query(querySelect, [1], (err, result) => {
    if (err) {
      console.error('Error executing insert query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(result);
  });
});
app.patch('/api/todoList/:id', (req, res) => {
  const todoId = req.params.id;
  const querySelect = 'UPDATE todoList SET complete=1 WHERE id=?';
  pool.query(querySelect, [todoId], (err, result) => {
    if (err) {
      console.error('Error executing insert query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    console.log('todoList complete狀態更新成功');
    res.json(result);
  });
});
app.get('/api/quotations', (req, res) => {
  console.log(req.query);
  const { selected } = req.query;
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
  pool.query(querySelect, (err, result) => {
    if (err) {
      console.error('Error executing insert query: ' + err.stack);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.json(result);
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
  const columns = Object.keys(columnValues).join(',');
  const values = Object.values(columnValues);
  const placeholders = values.map(() => '?').join(',');
  const queryInsertNew = `INSERT INTO quotationList (${columns}) VALUES (${placeholders})`;
  pool.query(queryInsertNew, values, (error, results) => {
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

    pool.query(queryInsertNew, [todoContent, date, complete], (err, result) => {
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
app.get('/api/env-check', (req, res) => {
  res.json({
    database: {
      host: process.env.DB_HOST ? '已设置' : '未设置',
      user: process.env.DB_USER ? '已设置' : '未设置',
      database: process.env.DB_DATABASE ? '已设置' : '未设置',
      port: process.env.DB_PORT ? '已设置' : '未设置',
    },
    time: new Date().toISOString(),
  });
});

app.get('/api/posts', (req, res) => {
  console.log('filter:', req.query);
  const { order, dateRangeFrom, dateRangeTo, category, keywordSearch, tags } =
    req.query;
  console.log(tags);
  // tags切換為陣列
  const tagsArray = tags ? tags.split(',') : [];
  console.log(tagsArray);
  // SQL
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
    sqlQuery += ` AND JSON_CONTAINS(tags, '${JSON.stringify(tagsArray)}') = 1`;
  }
  if (order) {
    sqlQuery += ` ORDER BY create_date ${order}`;
  }
  console.log(sqlQuery);
  pool.query(sqlQuery, (error, results) => {
    if (error) {
      console.error('查詢時發生錯誤: ' + error.stack);
      res.status(500).send('內部伺服器錯誤');
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.json(results);
    // 將查詢結果發送給前端
  });
});
app.post('/api/mdFile', uploadMarkdown.single('file'), async (req, res) => {
  try {
    const {
      title,
      subTitle,
      category,
      tags,
      contentType,
      coverImage,
      create_date,
    } = JSON.parse(req.body.postDetail);
    const markdownBuffer = req.file.buffer;
    console.log(markdownBuffer, 'bb');
    const markdownContent = markdownBuffer.toString('utf-8');
    // 使用 markdown-it 将 Markdown 转换为 HTML
    const htmlContent = md.render(markdownContent);
    const savedHtmlContent = htmlContent.toString();
    console.log(savedHtmlContent, '轉成html標籤字串');
    const sql =
      'INSERT INTO posts (title, subTitle, category, tags, content, contentType, coverImage, create_date,authur) VALUES (?, ?, ?, ?, ?, ? ,? ,? ,?)';
    pool.query(
      sql,
      [
        title,
        subTitle,
        category,
        JSON.stringify(tags),
        markdownContent,
        contentType,
        coverImage,
        create_date,
        1,
      ],
      (err, result) => {
        if (err) {
          console.error('Error storing data in MySQL:', err);
          res.status(500).json({ success: false, error: 'Error storing data' });
        } else {
          console.log('Data stored in MySQL:', result);
          res.status(200).json({ success: true, htmlContent: markdownContent });
        }
      }
    );
    console.log(savedHtmlContent);
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ success: false, error: 'Error processing file' });
  }
});
app.post('/api/posts', (req, res) => {
  console.log(req.body.id);
  if (req.body.id !== undefined) {
    console.log('有資料');
    try {
      const {
        id,
        title,
        subTitle,
        category,
        tags,
        contentType,
        coverImage,
        content,
        revised_date,
      } = req.body;
      console.log(coverImage);
      const sql = `UPDATE posts SET title=?, subTitle=?, category=?, tags=?, content=?, contentType=?, coverImage=?, revised_date=?, authur=? WHERE id= ${id}`;
      pool.query(
        sql,
        [
          title,
          subTitle,
          category,
          JSON.stringify(tags),
          content,
          contentType,
          coverImage,
          revised_date,
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
            res.status(200).json({ success: true, htmlContent: content });
          }
        }
      );
    } catch (err) {
      console.error('Error processing file:', err);
      res.status(500).json({ success: false, err: 'Error processing file' });
    }
  } else {
    try {
      const {
        title,
        subTitle,
        category,
        tags,
        contentType,
        coverImage,
        content,
        create_date,
      } = req.body;
      const sql =
        'INSERT INTO posts (title, subTitle, category, tags, content, contentType, coverImage, create_date,authur) VALUES (?, ?, ?, ?, ?, ? ,? ,? ,1)';
      pool.query(
        sql,
        [
          title,
          subTitle,
          category,
          JSON.stringify(tags),
          content,
          contentType,
          coverImage,
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
            res.status(200).json({ success: true, htmlContent: content });
          }
        }
      );
    } catch (err) {
      console.error('Error processing file:', err);
      res.status(500).json({ success: false, err: 'Error processing file' });
    }
  }
});
const jwtSecretKey = 'luistest1234';
app.post('/api/loginTest', (req, res) => {
  const { username, password } = req.body;

  if (username === 'luis' && password === '1234') {
    const token = jwt.sign({ username }, jwtSecretKey, {
      expiresIn: '900s',
    });
    // 設定一個持久性的 Cookie，存儲 Token
    res.cookie('userToken', token, {
      maxAge: 900000,
      httpOnly: true,
      sameSite: 'None',
      secure: true,
    });
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(200).json({ message: 'oh no!' });
  }
});
app.get('/api/getDataTest', verifyToken, (req, res) => {
  // 檢查 session
  console.log('get data sucessfully');
  const decoded = req.decodedToken;
  const { username } = decoded;
  let testToken = generateToken();
  console.log(testToken, 'token');
  res.json({ success: true, message: '驗證成功 抓取資料', username });
});
app.get('/api/logoutTest', (req, res) => {
  // 清除 session
  req.session.destroy();
  // 清除 Cookie
  res.clearCookie('userToken');
  res.json({ success: true, message: 'Logout successful' });
});

app.post('/api/loginCookieSession', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT * FROM user_list WHERE email = ? AND password = ?';
  pool.query(sql, [email, password], (err, results) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: 'Internal server error' });
    }
    if (results.length === 0) {
      return res.status(401).json({ success: false, message: '找不到使用者' });
    }
    req.session.user = results[0].name;
    console.log(req.session.user);
    res.json({ success: true, message: `歡迎登入${results[0].name}` });
  });
});
app.get('/api/getdataCookieSesison', auth, (req, res) => {
  console.log('get data sucessfully');
  console.log(req.session);
  res.json({ success: true, message: '抓取資料成功' });
});
app.get('/api/logoutCookieSession', (req, res) => {
  req.session.destroy();
  res.clearCookie('luistestsession');
  res.json({ success: true, message: '登出成功' });
});
const PORT = process.env.PORT || port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
