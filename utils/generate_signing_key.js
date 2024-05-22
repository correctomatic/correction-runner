import fs from 'fs'
import { generateKeyPairSync, createPrivateKey } from 'crypto'

const keypair = generateKeyPairSync('ec', { namedCurve: 'P-256' })

const passphrase = 'banana'

// Encrypt the private key with a passphrase
const encryptedPrivateKey = createPrivateKey({
  key: keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  passphrase: passphrase
});

// fs.writeFileSync('privateKey.pem', keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }))
fs.writeFileSync('privateKey.pem', encryptedPrivateKey.export({ type: 'pkcs8', format: 'pem' }))
fs.writeFileSync('publicKey.pem',keypair.publicKey.export({ type: 'spki', format: 'pem' }))

