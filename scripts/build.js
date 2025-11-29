/**
 * 主构建脚本
 * 
 * 构建流程:
 * 1. 检查并安装依赖 (npm install)
 * 2. 编译各个 package (tsc)
 * 3. 打包最终的 CLI 应用 (esbuild)
 * 
 * 后端类比: 相当于 Maven 的 'mvn clean install' 完整流程
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

console.log('🚀 开始完整构建流程...\n');

// Step 1: 检查依赖
console.log('📦 Step 1: 检查依赖');
if (!existsSync(join(root, 'node_modules'))) {
    console.log('   未发现 node_modules，正在安装依赖...');
    execSync('npm install', { stdio: 'inherit', cwd: root });
} else {
    console.log('   ✅ 依赖已安装\n');
}

// Step 2: 编译所有 packages (使用 TypeScript)
console.log('🔧 Step 2: 编译所有 packages (tsc)');
console.log('   这会生成 packages/*/dist/ 目录');
execSync('npm run build --workspaces', { stdio: 'inherit', cwd: root });
console.log('   ✅ 所有 packages 编译完成\n');

// Step 3: 打包 CLI 应用 (使用 esbuild)
console.log('📦 Step 3: 打包 CLI 应用 (esbuild)');
console.log('   这会生成 bundle/my-cli.js 文件');
execSync('node esbuild.config.js', { stdio: 'inherit', cwd: root });
console.log('   ✅ CLI 应用打包完成\n');

console.log('🎉 构建完成！');
console.log('💡 运行 "node bundle/my-cli.js" 来测试');
