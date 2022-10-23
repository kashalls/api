import crypto from 'crypto'

const keypair = crypto.generateKeyPairSync(
    'ed25519', 
    {
      privateKeyEncoding: { format: 'pem', type: 'pkcs8' }, 
      publicKeyEncoding: { format: 'pem', type: 'spki' }
    }
  )
  
  console.log(keypair.privateKey)
  console.log(keypair.publicKey)