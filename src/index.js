import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

import Fastify from 'fastify'
import fastifyJWT from '@fastify/jwt'
import crypto from 'crypto'
import mongodb from '@fastify/mongodb'
const fastify = Fastify({
    logger: true,
    trustProxy: true
})

import schema from './schemas/balance.js'
fastify.register(mongodb, { url: process.env.MONGODB })
fastify.register(fastifyJWT, {
    secret: process.env.JWT_SECRET
})
fastify.decorate('eternalAuthenticate', async (request, reply) => {
    try {
        await request.jwtVerify()
    } catch (error) {
        return reply.send(error)
    }
})

const requireAuth = {
    onRequest: [fastify.eternalAuthenticate]
  }

fastify.get("/", async (request, reply) => {
    return { hello: 'world' }
})

fastify.post('/eternal/create-user', async (request, reply) => {
    const users = fastify.mongo.db.collection('users')
    const { uuid, username } = request.body

    const existingUser = await users.findOne({ _id: uuid })
    if (existingUser) throw new Error('User already exists.')
    const code = crypto.randomBytes(6).toString('hex')
    const token = await fastify.jwt.sign({ uuid, username });
    console.log(token)
    const user = { _id: uuid, username, created: new Date(), verification: { verified: false, code, verifiedOn: null }, token }
    const newUser = await users.insertOne(user)
    if (!newUser.acknowledged) {
        console.error(newUser)
        throw new Error('Failed to acknowledge new user.')
    }
    return { uuid, username, code }
})

fastify.post('/eternal/verify-user', async (request, reply) => {
    const users = fastify.mongo.db.collection('users')
    const { uuid, username, code } = request.body;
    const query = { _id: uuid, username }
    const existingUser = await users.findOne(query)
    if (!existingUser) throw new Error('User does not exist.')
    if (existingUser.verification.verified) throw new Error('User is already verified.')

    if (existingUser.verification.code === code) {
        const update = {
            $set: {
                verification: {
                    verified: true,
                    code,
                    verifiedOn: new Date()
                }
            }
        }
        const updatedUser = await users.findOneAndUpdate(query, update)
        if (!updatedUser.ok) {
            console.error(updatedUser)
            throw new Error('Failed to acknowledge updated user.')
        }

        return { token, uuid, username }
    } else {
        throw new Error('Code is invalid.')
    }
})

fastify.post('/eternal/balance', { ...requireAuth, schema }, async (request, reply) => {
    const balances = fastify.mongo.db.collection('balances')
    const data = request.body;
    if (!data.date) data.date = new Date()

    const result = await balances.insertOne({ ...data })
    console.log(result)
    console.log(request.body)
    return request.body
})

const start = async () => {
    try {
        await fastify.listen({ port: 3000 })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()