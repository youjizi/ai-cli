/**
 * esbuild 构建配置
 * 
 * 目的: 将 packages/cli 打包成单个可执行文件
 * 类比: Java Maven 的 assembly 配置，用于打包 fat JAR
 */

import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// 获取当前文件所在目录 (因为 ES Module 没有 __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 读取根目录的 package.json 获取版本号
const pkg = require(path.resolve(__dirname, 'package.json'));

/**
 * 基础配置
 * 这些配置会应用到所有构建任务
 */
const baseConfig = {
    bundle: true,        // 打包所有依赖 (类似 Maven fat JAR)
    platform: 'node',    // 目标平台是 Node.js (不是浏览器)
    format: 'esm',       // 输出 ES Module 格式 (使用 import/export)
    loader: {
        '.node': 'file'    // .node 文件是原生模块，作为文件处理
    },
    write: true,         // 直接写入文件系统
};

/**
 * CLI 应用配置
 * 打包 packages/cli 成为可执行文件
 */
const cliConfig = {
    ...baseConfig,

    // 📌 入口文件: 从哪里开始打包
    entryPoints: ['packages/cli/src/index.ts'],

    // 📌 输出文件: 打包后的文件放在哪里
    outfile: 'bundle/cli-demo.js',

    // 📌 Banner: 在生成的文件开头注入的代码
    // 目的: 因为 ESM 没有 require、__filename、__dirname
    // 这里手动创建这些变量以兼容某些老代码
    banner: {
        js: `// 兼容性代码: 提供 CommonJS 的 require, __filename, __dirname
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.__filename = require('url').fileURLToPath(import.meta.url);
globalThis.__dirname = require('path').dirname(globalThis.__filename);`
    },

    // 📌 Define: 定义编译时常量
    // 类似于 Java 的编译时常量替换
    define: {
        'process.env.CLI_VERSION': JSON.stringify(pkg.version)
    },

    // 📌 External: 不打包的依赖，运行时从 node_modules 加载
    // 为什么? 某些原生模块(包含 .node 文件)不能打包
    external: [
        // 暂时没有，后续如果用到原生模块再添加
    ],
};

// 执行构建
console.log('🔨 开始构建 CLI 应用...');
console.log(`📦 入口: ${cliConfig.entryPoints[0]}`);
console.log(`📂 输出: ${cliConfig.outfile}`);
console.log(`🏷️  版本: ${pkg.version}`);

esbuild.build(cliConfig)
    .then(() => {
        console.log('✅ 构建成功!');
        console.log(`📁 生成文件: ${cliConfig.outfile}`);
    })
    .catch((error) => {
        console.error('❌ 构建失败:', error);
        process.exit(1);
    });
