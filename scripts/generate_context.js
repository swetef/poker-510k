// 在终端运行：node scripts/generate_context.js

const fs = require('fs');
const path = require('path');

// --- 配置项 ---
// 你想要扫描的目录
const SEARCH_DIRS = ['src', 'server'];
// 输出文件名
const OUTPUT_FILE = 'project_context.txt';
// 忽略的文件或文件夹
const IGNORE_PATTERNS = [
    'node_modules', 
    '.git', 
    '.DS_Store', 
    'package-lock.json', 
    'yarn.lock', 
    'dist', 
    'build',
    'images', // 图片文件夹通常忽略
    'generate_context.js' // 忽略自己
];
// 只读取这些后缀的文件
const INCLUDE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json'];

// --- 主逻辑 ---

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        // 检查是否在忽略列表中
        if (IGNORE_PATTERNS.includes(file)) return;

        const fullPath = path.join(dirPath, file);

        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            // 检查后缀名
            const ext = path.extname(file);
            if (INCLUDE_EXTS.includes(ext)) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

function mergeFiles() {
    let output = `Project Context Generated at ${new Date().toLocaleString()}\n\n`;
    let fileCount = 0;

    SEARCH_DIRS.forEach(dir => {
        const rootPath = path.join(__dirname, '..', dir); // 假设脚本在 scripts/ 目录下，向上找一级
        if (!fs.existsSync(rootPath)) {
            console.warn(`Warning: Directory ${dir} not found.`);
            return;
        }

        const files = getAllFiles(rootPath);
        
        files.forEach(filePath => {
            const relativePath = path.relative(path.join(__dirname, '..'), filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            
            output += `\n================================================================================\n`;
            output += `FILE PATH: ${relativePath}\n`;
            output += `================================================================================\n`;
            output += content + `\n`;
            
            fileCount++;
            console.log(`Included: ${relativePath}`);
        });
    });

    const outputPath = path.join(__dirname, '..', OUTPUT_FILE);
    fs.writeFileSync(outputPath, output);
    console.log(`\n✅ Success! Merged ${fileCount} files into "${OUTPUT_FILE}"`);
}

mergeFiles();