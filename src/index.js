import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

import crypto from 'crypto'

import { v4 as uuidv4 } from 'uuid'
import Fastify from 'fastify'
import FastifyJWT from '@fastify/jwt'
import FastifyWS from '@fastify/websocket'
import mongodb from '@fastify/mongodb'
const fastify = Fastify({
    logger: true,
    trustProxy: true
})

import schema from './schemas/balance.js'
import { readFileSync } from 'fs'
fastify.register(FastifyWS, {
    options: {
        clientTracking: true
    }
})
fastify.register(mongodb, { url: process.env.MONGODB })
fastify.register(FastifyJWT, {
    secret: {
        private: readFileSync(new URL('./keys/private.key', import.meta.url), 'utf8'),
        public: readFileSync(new URL('./keys/public.key', import.meta.url), 'utf8')
    },
    sign: {
        algorithm: 'EdDSA',
        iss: 'api.kashall.dev'
    },
    verify: {
        allowedIss: 'api.kashall.dev'
    }
})

const subscriptions = {}

fastify.register(async function (fastify) {
    const balances = await fastify.mongo.db.collection('balances')
    fastify.get('/socket', { websocket: true }, (connection, request) => {

        connection.socket.id = uuidv4();
        connection.socket.pingthing = {
            timer: setInterval(() => {
                if (!connection.socket.pingthing.pinged) connection.socket.close(1006, 'HEARTBEAT_MISSED')
                connection.socket.pingthing.pinged = false
            }, 35000),
            pinged: false
        }

        connection.socket.send(JSON.stringify({
            op: 1,
            d: {
                heartbeat_interval: 30000
            }
        }))

        connection.socket.on('message', async (message) => {
            const [err, result] = safeJsonParse(message.toString())
            if (err || !result.op) return connection.socket.close(4006, 'invalid_payload')
            if (result.d == null || typeof result.d !== 'object' || Object.keys(result.d).length === 0) {
                return connection.socket.close(4005, 'requires_data_object')
            }
            switch (result.op) {
                case 2:
                    const uuids = result.d.subscribe_to_uuids
                    if (!Array.isArray(uuids) || uuids.length === 0) {
                        return connection.socket.close(4006, 'invalid_payload')
                    }
                    const data = new Map()

                    for await (const uuid of uuids) {
                        const bal = await balances.findOne({ uuid }, { sort: { date: -1 }, limit: 1 })
                        if (!bal) continue;
                        if (!subscriptions[uuid]) {
                            subscriptions[uuid] = []
                        }
                        subscriptions[uuid].push(connection.socket.id)
                        delete bal._id
                        delete bal.uuid
                        data.set(uuid, bal)
                    }

                    if (data.size === 0) return connection.socket.close(4006, 'invalid_payload')
                    return connection.socket.send(
                        JSON.stringify({
                            op: 0,
                            t: "INIT_STATE",
                            d: Object.fromEntries(data)
                        })
                    )
                case 4:
                    const unsubscribeUUIDS = result.d.unsubscribe_to_uuids
                    if (!Array.isArray(unsubscribeUUIDS) || unsubscribeUUIDS.length === 0) {
                        return connection.socket.close(4006, 'invalid_payload')
                    }

                    for (const uuid of unsubscribeUUIDS) {
                        if (subscriptions[uuid].includes(connection.socket.id)) {
                            subscriptions[uuid].splice(subscriptions[uuid].indexOf(connection.socket.id), 1)
                            if (subscriptions[uuid].length === 0) delete subscriptions[uuid]
                        }
                    }
                    let count = 0;
                    Object.entries(subscriptions).forEach((x) => {
                        if (x.includes(connection.socket.id)) count++
                    })
                    if (count <= 0) return connection.socket.close(1000)
                case 3:
                    console.log('Recieved ping.')
                    return connection.socket.pingthing.pinged = true
                default:
                    connection.socket.close(4004, 'unknown_opcode')
            }

        })
        connection.socket.on('close', () => {
            if (Object.keys(subscriptions).length) {
                for (const uuid in subscriptions) {
                    if (subscriptions[uuid].includes(connection.socket.id)) {
                        subscriptions[uuid].splice(subscriptions[uuid].indexOf(connection.socket.id), 1)
                        if (subscriptions[uuid].length === 0) delete subscriptions[uuid]
                    }
                }
            }
            clearInterval(connection.socket.pingthing.timer)
        })
    })
})

setInterval(() => {
    if (!Object.keys(subscriptions).length) return
    console.log(`Subscriptions: ${JSON.stringify(subscriptions)}`)
}, 10000)


fastify.decorate('eternalAuthenticate', async (request, reply) => {
    try {
        const users = await fastify.mongo.db.collection('users')
        const jwtData = await request.jwtVerify()
        const user = await users.findOne({ _id: jwtData.sub })
        if (!user || user.apiKey.jti !== jwtData.jti) {
            reply.code(401)
            return {
                statusCode: 401,
                code: "FST_JWT_NO_AUTHORIZATION_IN_HEADER",
                error: "Unauthorized",
                message: "No Authorization was found in request.headers"
            }
        }
        console.log(user, user.apiKey.jti)

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
    const { uuid } = request.body

    const existingUser = await users.findOne({ _id: uuid })
    if (existingUser) throw new Error('User already exists.')

    const code = crypto.randomBytes(6).toString('hex')
    const jti = uuidv4()
    const token = await fastify.jwt.sign({ sub: uuid, jti });

    const user = { _id: uuid, created: new Date(), verified: null, verifyCode: code, apiKey: { token, jti }, meta: { verified: false, public: false, hidden: false, admin: false } }
    const newUser = await users.insertOne(user)
    if (!newUser.acknowledged) {
        console.error(newUser)
        throw new Error('Failed to acknowledge new user.')
    }
    return { uuid, code }
})

fastify.post('/eternal/regenerate-key', { ...requireAuth }, async (request, reply) => {
    const users = fastify.mongo.db.collection('users')
    const { uuid } = request.body;

    if (request.user.sub !== uuid) throw new Error('USER_TOKEN_MISMATCH')
    const query = { _id: uuid }
    const existingUser = await users.findOne(query)
    if (!existingUser) throw new Error('USER_ERROR_NOT_FOUND')

    const jti = uuidv4()
    const token = await fastify.jwt.sign({ sub: uuid, jti });
    const update = {
        $set: {
            apiKey: {
                token,
                jti
            }
        }
    }

    const updatedUser = await users.findOneAndUpdate(query, update)
    if (!updatedUser.ok) {
        console.log(updatedUser)
        throw new Error('SERVER_FAILED_UPDATE')
    }

    return { uuid, token }
})

fastify.post('/eternal/balance', { ...requireAuth, schema }, async (request, reply) => {
    const balances = fastify.mongo.db.collection('balances')
    let { balance, date, address, reason, uuid } = request.body

    if (request.user.sub !== uuid) throw new Error('You don\'t have permission to publish balance information for this user.')
    if (!date) date = new Date()

    const result = await balances.insertOne({ balance, date, address, reason, uuid })
    if (uuid in subscriptions) {
        subscriptions[uuid].forEach((socketId) => {
            const [socket] = Array.from(fastify.websocketServer.clients).filter((client) => client.id === socketId)
            if (!socket) return;
            
            const data = new Map()
            data.set(uuid, { balance, date, address, reason })

            socket.send(JSON.stringify({
                op: 0,
                t: "BALANCE_UPDATE",
                d: Object.fromEntries(data)
            }))
        })
    }
    return { acknowledged: result.acknowledged }
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

function safeJsonParse(str) {
    try {
        return [null, JSON.parse(str)];
    } catch (err) {
        return [err];
    }
}