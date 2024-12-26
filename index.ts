// index.ts
import express from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from "bs58"
import 'dotenv/config';
import path from 'path';

// Environment variables (consider using .env files in production)
const PORT:                 number = 6415
const WEBSITE_URL:          string = process.env.WEBSITE_URL!;
const SOLANA_RPC_URL:       string = process.env.SOLANA_RPC_URL!;
const PROGRAM_ID_STR:       string = process.env.PROGRAM_ID!; // Replace with your actual program ID
const PASS_WORD:            string | undefined = process.env.PASS_WORD;

const PROGRAM_ID: PublicKey = new PublicKey(PROGRAM_ID_STR);
const SECRETS: Map<string, { key: string, iv: string }> = new Map();

const corsOptions = {
    origin: WEBSITE_URL, // Allow requests
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTION', // Allowed HTTP methods
    credentials: true, // Set to true if cross-domain cookie is needed
    allowedHeaders: 'Content-Type,Authorization', // Allowed request headers
};

console.log("CORS Configuration:", corsOptions)

const app = express();
app.use(cors(corsOptions)); // Use cors middleware
app.use(express.json());

// Authentication middleware
const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (PASS_WORD === undefined) {
        console.warn("PASS_WORD environment variable not set, skipping authentication.");
        return next(); // Skip authentication if no password is set (for development only, be sure to set it in production)
    }

    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token === PASS_WORD) {
            next();
        } else {
            res.status(401).send({ error: 'Authentication failed, incorrect password' });
        }
    } else {
        res.status(401).send({ error: 'Authentication failed, missing Authorization header' });
    }
};

app.post('/ping', async (req: any, res: any)=>{
    const {ipid} = req.body
    if(SECRETS.has(ipid)){
        return res.send({ success: true });
    } else {
        console.log(`Key service for IPID ${ipid} is not yet configured`);
        return res.status(500).send({ error: `Key service for IPID ${ipid} is not yet configured` });
    }
})

// Get all keys (returns only the IPID list)
app.get('/keys', authenticate, (req: any, res: any) => {
    const ipids = Array.from(SECRETS.keys());
    res.json(ipids.map(ipid=>({
        ipid: ipid,
        key:  SECRETS.get(ipid)?.key,
        iv:   SECRETS.get(ipid)?.iv,
    })));
});

// Add key
app.post('/keys/add', authenticate, (req: any, res: any) => {
    const { ipid, key, iv } = req.body;
    if (!ipid || !key || !iv) {
        return res.status(400).send({ error: 'Missing ipid, key, or iv parameter' });
    }
    SECRETS.set(ipid, { key, iv });
    console.log(`Successfully added key. IPID: ${ipid}, KEY: ${key}, IV: ${iv}`);
    res.send({ success: true, message: `Successfully added key for IPID: ${ipid}` });
});

// Delete key
app.delete('/keys/delete/:ipid', authenticate, (req: any, res: any) => {
    const { ipid } = req.params;
    if (!ipid) {
        return res.status(400).send({ error: 'Missing ipid parameter' });
    }
    if (SECRETS.has(ipid)) {
        SECRETS.delete(ipid);
        console.log(`Successfully deleted key for IPID: ${ipid}`);
        res.send({ success: true, message: `Successfully deleted key for IPID: ${ipid}` });
    } else {
        res.status(404).send({ error: `Key for IPID: ${ipid} not found` });
    }
});

// Decrypt POST interface
app.post('/decrypt', async (req: any, res: any) => {
    const { buyerPublicKey, signature, message, ipid } = req.body;

    // Check if the request body contains the necessary parameters
    if (!buyerPublicKey || !signature || !message || !ipid) {
        return res.status(400).send({ error: 'Missing buyerPublicKey, signature, or message in the request body' });
    }

    // Check if a decryption key exists for the requested IPID
    if (!SECRETS.has(ipid)) {
        console.log(`Decryption key not found for IPID: ${ipid}`);
        return res.status(400).send({ error: `Decryption key not found for IPID: ${ipid}` });
    }

    const secret = SECRETS.get(ipid);
    const key = secret?.key;
    const iv  = secret?.iv;

    console.log("Processing request...")
    console.log(`KEY: ${key}`)
    console.log(`IV:  ${iv}`)

    try {

        // Verify signature
        const isVerified = nacl.sign.detached.verify(
            Buffer.from(message, 'utf-8'),
            bs58.decode(signature),
            bs58.decode(buyerPublicKey)
        );

        if (!isVerified) {
            console.log(`Signature verification failed, from: ${buyerPublicKey}`);
            return res.status(401).send({ error: 'Signature verification failed, unknown request source' });
        }

        // Connect to Solana network
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const buyerKey   = new PublicKey(buyerPublicKey);

        // Derive the PDA address of the Contract Issuer Account (CIAccount)
        const [ciAccountPublicKey, _ciAccountBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('ci', 'utf8'), new PublicKey(ipid).toBuffer()],
            PROGRAM_ID
        );

        // Derive the PDA address of the Contract Payment Account (CPAccount)
        const [cpAccountPublicKey, _cpAccountBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('cp', 'utf8'), buyerKey.toBuffer(), ciAccountPublicKey.toBuffer()],
            PROGRAM_ID
        );

        // Get CPAccount information
        const cpAccountInfo = await connection.getAccountInfo(cpAccountPublicKey);

        // Verify if the purchase record exists
        if (cpAccountInfo) {
            // Purchase verified, proceed with decryption
            console.log(`Verified buyer: ${buyerPublicKey}`);
            console.log(`Sending key: ${key} ; IV: ${iv}`)
            // Send the decrypted content
            res.send({ key: key, iv: iv });
        } else {
            // Purchase record not found
            console.log(`Purchase record not found for buyer: ${buyerPublicKey}`);
            res.status(404).send({ error: 'Purchase record not found' });
        }
    } catch (error: any) {
        // Handle errors during purchase verification
        console.error('Error occurred during purchase verification:', error);
        res.status(500).send({ error: 'Purchase verification failed' });
    }
});


// Client
app.use(express.static(path.join(__dirname, "..", 'client', 'dist'))); // 注意这里是 'client/dist'

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "..",'client', 'dist', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Decryption service is listening on port ${PORT}`);
});