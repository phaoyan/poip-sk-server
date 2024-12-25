// index.ts
import express from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from "bs58"
import 'dotenv/config';

const corsOptions = {
    origin: 'http://localhost:3000', // 允许来自 http://localhost:3000 的请求
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTION', // 允许的 HTTP 方法
    credentials: true, // 如果需要跨域传递 cookie，则设置为 true
    allowedHeaders: 'Content-Type,Authorization', // 允许的请求头
};

console.log("CORS配置：", corsOptions)

const app = express();
const port = 4000;

app.use(cors(corsOptions)); // 使用 cors 中间件
app.use(express.json());

// 环境变量 (在生产环境中考虑使用 .env 文件)
const SOLANA_RPC_URL:       string = process.env.SOLANA_RPC_URL!;
const PROGRAM_ID_STR:       string = process.env.PROGRAM_ID!; // 替换成你实际的程序 ID
const KEYS_JSON:            string = process.env.KEYS_JSON!;
const IVS_JSON:             string = process.env.IVS_JSON!;

const PROGRAM_ID: PublicKey = new PublicKey(PROGRAM_ID_STR);
const KEYS: Map<string, string> = new Map();
const IVS: Map<string, string> = new Map();
// 尝试从环境变量中加载解密密钥
if (KEYS_JSON) {
    try {
        const parsedKeys: Record<string, string> = JSON.parse(KEYS_JSON);
        for (const ipid in parsedKeys) {
            KEYS.set(ipid, parsedKeys[ipid]);
            console.log(`成功从环境变量加载解密密钥。IPID: ${ipid}, KEY: ${parsedKeys[ipid]}`);
        }
    } catch (error) {
        console.error("解析 DECRYPTION_KEYS_JSON 环境变量失败:", error);
    }
} else {
    console.warn("未设置 DECRYPTION_KEYS_JSON 环境变量，解密密钥将为空。");
}
// 尝试从环境变量中加载IV
if (IVS_JSON) {
    try {
        const parsedIVs: Record<string, string> = JSON.parse(IVS_JSON);
        for (const ipid in parsedIVs) {
            IVS.set(ipid, parsedIVs[ipid]);
            console.log(`成功从环境变量加载IV。IV: ${ipid}, KEY: ${parsedIVs[ipid]}`);
        }
    } catch (error) {
        console.error("解析 IVS_JSON 环境变量失败:", error);
    }
} else {
    console.warn("未设置 IVS_JSON 环境变量，IVs将为空。");
}

app.post('/ping', async (req: any, res: any)=>{
    const {ipid} = req.body
    if(KEYS.has(ipid)){
        return res.send({ success: true });
    } else {
        console.log(`IPID ${ipid} 的密钥服务尚未配置`);
        return res.status(500).send({ error: `IPID ${ipid} 的密钥服务尚未配置` });
    }
})

// 解密 POST 接口
app.post('/decrypt', async (req: any, res: any) => {
    const { buyerPublicKey, signature, message, ipid } = req.body;

    // 检查请求体中是否包含必要的参数
    if (!buyerPublicKey || !signature || !message || !ipid) {
        return res.status(400).send({ error: '请求体中缺少 buyerPublicKey, signature 或 message' });
    }

    // 检查请求的 IPID 是否存在对应的解密密钥
    if (!KEYS.has(ipid)) {
        console.log(`未找到 IPID: ${ipid} 对应的解密密钥`);
        return res.status(400).send({ error: `未找到 IPID: ${ipid} 对应的解密密钥` });
    }

    const key = KEYS.get(ipid);
    const iv            = IVS.get(ipid);
    console.log("处理请求...")
    console.log(`KEY: ${key}`)
    console.log(`IV:  ${iv}`)

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
        const buyerKey   = new PublicKey(buyerPublicKey);

        // 推导合约发行账户 (CIAccount) 的 PDA 地址
        const [ciAccountPublicKey, _ciAccountBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('ci', 'utf8'), new PublicKey(ipid).toBuffer()],
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
            console.log(`发送密钥： ${key} ; IV: ${iv}`)
            // 发送解密后的内容
            res.send({ key: key, iv: iv });
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