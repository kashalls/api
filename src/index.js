import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

import Fastify from 'fastify'
import mongodb from '@fastify/mongodb'
const fastify = Fastify({
    logger: true,
    trustProxy: true
})

fastify.register(mongodb, { url: process.env.MONGODB })

fastify.get("/", async (request, reply) => {
    return { hello: 'world' }
})

fastify.post('/eternal/balance', async (request, reply) => {
    const balances = fastify.mongo.db.collection('balances')
    const { balance, uuid } = request.body;
    const result = await balances.insertOne({ balance, uuid, date: new Date() })
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