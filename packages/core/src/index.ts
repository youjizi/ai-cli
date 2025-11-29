// ==================== Node.js API 使用示例 ====================

// 1. 文件系统操作
import * as fs from 'fs';
import * as path from 'path';

// 2. 进程信息
import * as process from 'process';

// 3. 操作系统信息
import * as os from 'os';

// ==================== 原有的导出 ====================
export function greet(name: string): string {
    return `Hello, ${name}!`;
}

export function add(a: number, b: number): number {
    return a + b;
}

// ==================== 新增：使用 Node.js API ====================

/**
 * 读取文件内容
 * 这里用到了 fs 模块，需要 @types/node 提供类型
 */
export function readFile(filePath: string): string {
    // fs.readFileSync 的类型来自 @types/node
    // 如果没有 @types/node，TypeScript 不知道这个方法的参数和返回值类型
    return fs.readFileSync(filePath, 'utf-8');
}

/**
 * 获取当前工作目录
 * 使用 process 模块
 */
export function getCurrentDir(): string {
    // process.cwd() 的类型来自 @types/node
    return process.cwd();
}

/**
 * 获取系统信息
 * 使用 os 模块
 */
export function getSystemInfo(): {
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
} {
    // os 模块的所有方法类型都来自 @types/node
    return {
        platform: os.platform(),      // 'win32' | 'darwin' | 'linux'
        arch: os.arch(),              // 'x64' | 'arm64' 等
        cpus: os.cpus().length,       // CPU 核心数
        totalMemory: os.totalmem()    // 总内存（字节）
    };
}

/**
 * 路径拼接
 * 使用 path 模块
 */
export function joinPath(...paths: string[]): string {
    // path.join 的类型来自 @types/node
    return path.join(...paths);
}