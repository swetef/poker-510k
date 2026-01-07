/**
 * 510K 项目双模生成器
 * 1. 生成 project_context.txt (完整代码)
 * 2. 生成 project_index_skeleton.txt (精简逻辑地图)
 */

const fs = require('fs');
const path = require('path');

// --- 配置区域 ---
const CONFIG = {
    // 扫描目录：根据你的项目结构，通常是根目录下的 client 和 server
    searchDirs: ['client', 'server'],
    
    // 输出文件名
    fullOutputFile: 'project_context.txt',
    skeletonOutputFile: 'project_index_skeleton.txt',

    // 忽略的模式
    ignorePatterns: [
        'node_modules', '.git', '.DS_Store', 'package-lock.json', 'yarn.lock',
        'dist', 'build', 'images', 'public', '.vscode', 'assets', 'sounds'
    ],

    // 允许包含在【完整版】的文件后缀
    fullExts: ['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html'],

    // 允许包含在【精简版/地图】的文件后缀（仅逻辑文件）
    skeletonExts: ['.js', '.jsx', '.ts', '.tsx']
};

// --- 核心逻辑：脱水/折叠函数体 ---
function dehydrateCode(code) {
    const lines = code.split('\n');
    let dehydrated = [];
    let isSkipping = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // 保留核心导出、定义和 Hook 声明
        const isDefinition = /^(export|const|function|class|let|var|import)/.test(line);
        const isHook = line.startsWith('const use') || line.startsWith('export const use');
        const isComment = line.startsWith('//') || line.startsWith('/*');

        if (isDefinition || isHook || (isComment && line.length > 5)) {
            dehydrated.push(lines[i]);
            
            if (line.includes('{') && !line.includes('}')) {
                dehydrated.push('    // ... [Logic Folded] ...');
                isSkipping = true;
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            }
            continue;
        }

        if (isSkipping) {
            const openBraces = (line.match(/{/g) || []).length;
            const closeBraces = (line.match(/}/g) || []).length;
            braceCount += openBraces - closeBraces;

            if (braceCount <= 0) {
                isSkipping = false;
                if (line.includes('}')) dehydrated.push(lines[i]);
            }
        } else if (line === '}' || line === '};') {
            dehydrated.push(lines[i]);
        }
    }
    return dehydrated.join('\n');
}

// --- 文件遍历逻辑 ---
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(file => {
        if (CONFIG.ignorePatterns.includes(file)) return;
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

// --- 主生成逻辑 ---
function runGenerator() {
    console.log('🚀 开始生成项目上下文...');
    
    let fullOutput = `Project Context (Full) - Generated at ${new Date().toLocaleString()}\n\n`;
    let skeletonOutput = `Project Index Skeleton (Map) - Generated at ${new Date().toLocaleString()}\n\n`;
    
    let fullFileCount = 0;
    let skeletonFileCount = 0;

    // 确定项目根目录（假设脚本在根目录运行，或者在 scripts 目录下）
    // 如果脚本在 scripts 文件夹里，改为 path.join(__dirname, '..')
    const projectRoot = process.cwd(); 

    CONFIG.searchDirs.forEach(dir => {
        const targetPath = path.join(projectRoot, dir);
        if (!fs.existsSync(targetPath)) {
            console.warn(`⚠️ 目录未找到: ${dir}`);
            return;
        }

        const files = getAllFiles(targetPath);

        files.forEach(filePath => {
            const ext = path.extname(filePath);
            const relativePath = path.relative(projectRoot, filePath);
            const content = fs.readFileSync(filePath, 'utf8');

            // 1. 处理完整版
            if (CONFIG.fullExts.includes(ext)) {
                fullOutput += `\n${'='.repeat(80)}\nFILE: ${relativePath}\n${'='.repeat(80)}\n`;
                fullOutput += content + '\n';
                fullFileCount++;
            }

            // 2. 处理精简版
            if (CONFIG.skeletonExts.includes(ext)) {
                skeletonOutput += `\n${'='.repeat(80)}\nFILE: ${relativePath}\n${'='.repeat(80)}\n`;
                skeletonOutput += dehydrateCode(content) + '\n';
                skeletonFileCount++;
            }

            console.log(`Processed: ${relativePath}`);
        });
    });

    // 写入文件
    fs.writeFileSync(path.join(projectRoot, CONFIG.fullOutputFile), fullOutput);
    fs.writeFileSync(path.join(projectRoot, CONFIG.skeletonOutputFile), skeletonOutput);

    console.log(`\n✅ 完成!`);
    console.log(`- 完整版: "${CONFIG.fullOutputFile}" (${fullFileCount} 个文件)`);
    console.log(`- 精简版: "${CONFIG.skeletonOutputFile}" (${skeletonFileCount} 个文件)`);
    console.log(`\n提示: 以后对话中，如果提示超出窗口，请先发 "${CONFIG.skeletonOutputFile}" 给我！`);
}

runGenerator();