// index.ts
import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import crypto from 'crypto'; // 引入 Node.js 的加密模块
import nacl from 'tweetnacl';
import bs58 from "bs58"

const app = express();
const port = 3000;

app.use(express.json());

// 环境变量 (在生产环境中考虑使用 .env 文件)
const SOLANA_RPC_URL:    string = process.env.SOLANA_RPC_URL!;
const PROGRAM_ID_STR:    string = process.env.PROGRAM_ID!; // 替换成你实际的程序 ID
const DECRYPTION_KEY:    string = process.env.DECRYPTION_KEY!; // 用于对称解密的密钥
const IP_ID:             string = process.env.IP_ID!; // 知识产权的 ID
const ENCRYPTED_CONTENT: string = process.env.ENCRYPTED_CONTENT!; // 加密的知识产权内容（实际场景中可能从 IPFS 或 Arweave 获取）
const IV_BASE64:         string = process.env.IV_BASE64!; // 初始化向量 (IV), Base64 编码

// 检查必要的环境变量是否已设置
if (!DECRYPTION_KEY || !IP_ID || !ENCRYPTED_CONTENT || !IV_BASE64) {
    console.error("错误: 必须设置 DECRYPTION_KEY, IP_ID, ENCRYPTED_CONTENT 和 IV_BASE64 环境变量。");
    process.exit(1);
}

const PROGRAM_ID: PublicKey = new PublicKey(PROGRAM_ID_STR);
const IV: Buffer = Buffer.from(IV_BASE64, 'base64'); // 将 Base64 编码的 IV 转换为 Buffer
const ENCRYPTION_ALGORITHM = 'aes-256-cbc'; // 使用的对称加密算法

// 解密 POST 接口
app.post('/decrypt', async (req: any, res: any) => {
    const { buyerPublicKey, signature, message } = req.body;

    // 检查请求体中是否包含必要的参数
    if (!buyerPublicKey || !signature || !message) {
        return res.status(400).send({ error: '请求体中缺少 buyerPublicKey, signature 或 message' });
    }

    try {

        // 验证签名
        const isVerified = nacl.sign.detached.verify(
            Buffer.from(message, 'utf-8'),
            bs58.decode(signature),
            bs58.decode(buyerPublicKey)
        );

        if (!isVerified) {
            console.log(`签名验证失败，来自: ${buyerPublicKey}`);
            return res.status(401).send({ error: '签名验证失败，请求来源不明' });
        }

        // 连接到 Solana 网络
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const buyerKey = new PublicKey(buyerPublicKey);
        const ipIdBuffer = Buffer.from(IP_ID, 'utf8');

        // 推导合约发行账户 (CIAccount) 的 PDA 地址
        const [ciAccountPublicKey, _ciAccountBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('ci', 'utf8'), ipIdBuffer],
            PROGRAM_ID
        );

        // 推导合约支付账户 (CPAccount) 的 PDA 地址
        const [cpAccountPublicKey, _cpAccountBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('cp', 'utf8'), buyerKey.toBuffer(), ciAccountPublicKey.toBuffer()],
            PROGRAM_ID
        );

        // 获取 CPAccount 的信息
        const cpAccountInfo = await connection.getAccountInfo(cpAccountPublicKey);

        // 验证购买记录是否存在
        if (cpAccountInfo) {
            // 购买已验证，进行解密操作
            console.log(`已验证购买者: ${buyerPublicKey}`);

            // 创建解密器
            const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, DECRYPTION_KEY, IV);
            let decrypted = decipher.update(ENCRYPTED_CONTENT, 'base64', 'utf8'); // 指定输入编码为 base64，输出编码为 utf8
            decrypted += decipher.final('utf8');

            // 发送解密后的内容
            res.send({ decryptedContent: decrypted });
        } else {
            // 未找到购买记录
            console.log(`未找到购买者: ${buyerPublicKey} 的购买记录`);
            res.status(404).send({ error: '未找到购买记录' });
        }
    } catch (error: any) {
        // 处理验证购买过程中的错误
        console.error('验证购买时发生错误:', error);
        res.status(500).send({ error: '验证购买失败' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`解密服务正在监听端口 ${port}`);
});