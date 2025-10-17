const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 確保上傳目錄存在
const ensureUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// 通用 multer 配置
const createUploadConfig = (destination, filenamePrefix) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../../uploads', destination);
      ensureUploadDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // 生成唯一文件名：前綴 + 時間戳 + 隨機數 + .jpg
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${filenamePrefix}-${uniqueSuffix}.jpg`);
    }
  });

  return multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB 限制
    },
    fileFilter: function (req, file, cb) {
      // 檢查文件類型
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('只允許上傳 JPEG、JPG、PNG、WEBP 格式的圖片'));
      }
    }
  });
};

// 圖片處理中間件 - 統一轉換為 JPG 並調整尺寸
const processImage = (targetWidth, targetHeight) => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      const inputPath = req.file.path;
      const inputExt = path.extname(inputPath).toLowerCase();
      const outputPath = inputPath.replace(/\.[^/.]+$/, '.jpg'); // 替換擴展名為 .jpg
      
      // 如果原文件已經是 JPG，創建臨時文件
      let tempPath = inputPath;
      if (inputExt === '.jpg' || inputExt === '.jpeg') {
        tempPath = inputPath.replace(/\.(jpg|jpeg)$/i, '_temp.jpg');
        fs.renameSync(inputPath, tempPath);
      }
      
      // 使用 sharp 處理圖片
      await sharp(tempPath)
        .resize(targetWidth, targetHeight, {
          fit: 'cover', // 保持比例，裁剪多餘部分
          position: 'center' // 從中心裁剪
        })
        .jpeg({ 
          quality: 85,
          progressive: true 
        })
        .toFile(outputPath);
      
      // 刪除臨時文件
      if (tempPath !== outputPath) {
        fs.unlinkSync(tempPath);
      }
      
      // 更新文件路徑
      req.file.path = outputPath;
      req.file.filename = path.basename(outputPath);
      
      next();
    } catch (error) {
      console.error('圖片處理錯誤:', error);
      res.status(500).json({ 
        success: false, 
        message: '圖片處理失敗',
        error: error.message 
      });
    }
  };
};

// 場地上傳配置 (1920x1280)
const courtUpload = createUploadConfig('courts', 'court');
const processCourtImage = processImage(1920, 1280);

// 活動上傳配置 (800x600)
const activityUpload = createUploadConfig('activities', 'activity');
const processActivityImage = processImage(800, 600);

// 刪除文件的中間件
const deleteFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('刪除文件錯誤:', error);
  }
};

module.exports = {
  // 場地上傳
  courtUpload,
  processCourtImage,
  
  // 活動上傳
  activityUpload,
  processActivityImage,
  
  // 通用功能
  deleteFile,
  ensureUploadDir
};
