#!/usr/bin/env node

import { greet, add, getSystemInfo, getCurrentDir } from '@ai-cli-project/core';

console.log('=== 测试 Core 模块功能 ===');

// 1. 测试原有的函数
console.log(greet('User'));
console.log(`2 + 3 = ${add(2, 3)}`);

// 2. 测试新增的 Node.js API 封装函数
console.log('\n--- 系统信息 ---');
const sysInfo = getSystemInfo();
console.log('平台:', sysInfo.platform);
console.log('架构:', sysInfo.arch);
console.log('CPU核心数:', sysInfo.cpus);
console.log('总内存:', (sysInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2) + ' GB');

console.log('\n--- 当前目录 ---');
console.log(getCurrentDir());