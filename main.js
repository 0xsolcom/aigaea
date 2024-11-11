import chalk from 'chalk';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import readline from 'readline';
import { randomUUID } from 'crypto';


import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//const browserIdsFilePath = path.join(__dirname, 'browser_ids.json');


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const browserIdsFilePath = path.join(__dirname, 'browser_ids.json');
const proxyFilePath = 'proxy.txt';

const headers = {
  Accept: 'application/json, text/plain, */*',
  Connection: 'keep-alive',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

async function question(query) {
  return new Promise((resolve) => rl.question(query, (answer) => resolve(answer)));
}

async function getBrowserIds() {
  try {
    const data = await fs.readFile(browserIdsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveBrowserIds(browserIds) {
  try {
    await fs.writeFile(browserIdsFilePath, JSON.stringify(browserIds, null, 2), 'utf-8');
    console.log('已将浏览器ID保存到文件。');
  } catch (error) {
    console.error('保存浏览器ID出错:', error);
  }
}

async function getBrowserIdForProxy(proxy) {
  const browserIds = await getBrowserIds();
  if (browserIds[proxy]) {
    console.log(`使用现有的 browser_id ${proxy} 的认证失败`);
    return browserIds[proxy];
  } else {
    const newBrowserId = randomUUID();
    browserIds[proxy] = newBrowserId;
    await saveBrowserIds(browserIds);
    console.log(`为代理 ${proxy} 生成新 browser_id: ${newBrowserId}`);
    return newBrowserId;
  }
}

function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

async function pingProxy(proxy, browserId, uid) {
  const timestamp = getCurrentTimestamp();
  const data = {
    uid,
    browser_id: browserId,
    timestamp,
    version: '1.0.0',
  };

  while (true) {
    try {
      const response = await request('https://api.aigaea.net/api/network/ping', 'POST', data, proxy);
      console.log(`代理 ${proxy} 的 ping 成功:`, response);
      if (response.data && response.data.score < 50) {
        console.log(`代理 ${proxy} 的得分低于 50，正在重新认证...`);
        await authProxy(proxy);
        break;
      }
    } catch (error) {
      console.error(`代理 ${proxy} 的 ping 失败:`, error);
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function authProxy(proxy) {
  const data = {};
  const response = await request('https://api.aigaea.net/api/auth/session', 'POST', data, proxy);
  if (response && response.data) {
    const uid = response.data.uid;
    const browserId = await getBrowserIdForProxy(proxy);
    console.log(`代理 ${proxy} 验证成功，uid: ${uid}, browser_id: ${browserId}`);
    pingProxy(proxy, browserId, uid);
  } else {
    console.error(`代理 ${proxy} 的认证失败`);
  }
}

async function request(url, method, data = null, proxy) {
  try {
    const agent = new HttpsProxyAgent(proxy);
    const options = {
      method,
      headers,
      agent,
    };
    if (method === 'POST') {
      options.body = JSON.stringify(data);
    }
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    console.error(`代理出错: ${proxy}`, error);
  }
}

async function main() {
  console.log(chalk.yellow('╔════════════════════════════════════════╗'));
  console.log(chalk.yellow('║\x20\x20\x20\x20\x20\x20🚀\x20\x20hanafuda自动工具\x20🚀\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20║'));
  console.log(chalk.yellow('║\x20\x20👤\x20\x20\x20\x20脚本编写：@qklxsqf\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20║'));
  console.log(chalk.yellow('║\x20\x20📢\x20\x20电报频道：https://t.me/ksqxszq\x20\x20\x20\x20║'));
  console.log(chalk.yellow('╚════════════════════════════════════════╝'));

  const accessToken = await question('请输入您的 accessToken : ');
  headers.Authorization = `Bearer ${accessToken}`;

  try {
    const proxyData = await fs.readFile(proxyFilePath, 'utf-8');
    const proxies = proxyData.split('\n').filter((proxy) => proxy.trim()).map((proxy) => proxy.trim());

    if (proxies.length === 0) {
      console.error('在 proxy.txt 中未找到代理');
      return;
    }
    await Promise.all(proxies.map((proxy) => authProxy(proxy)));
  } catch (error) {
    console.error('发生错误:', error);
  }
}

main();