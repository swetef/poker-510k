// 在终端运行：node scripts/generate_context.js

const fs = require('fs');
const path = require('path');

// --- 配置项 ---
// 【修改点】：这里改成 'client' 和 'server'，对应你截图里的文件夹名
const SEARCH_DIRS = ['client', 'server']; 

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
    'images', 
    'generate_context.js',
    'public', // (可选) 如果public里只有图标，可以忽略；如果有逻辑代码请保留
    '.vscode'
];
// 只读取这些后缀的文件
const INCLUDE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html']; // 加了个 .html 以防万一

// --- 主逻辑 (保持不变) ---

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (IGNORE_PATTERNS.includes(file)) return;

        const fullPath = path.join(dirPath, file);

        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
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
        // 这里的 .. 代表回到根目录，然后进入 client 或 server
        const rootPath = path.join(__dirname, '..', dir); 
        
        if (!fs.existsSync(rootPath)) {
            console.warn(`Warning: Directory ${dir} not found at ${rootPath}`);
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