import fastifyPlugin from 'fastify-plugin'
import FastifyWS from '@fastify/websocket'

import { v4 as uuidv4 } from 'uuid'

function plugin(fastify, options, next) {

    fastify.decorate('subscriptions', {})

    fastify.register(FastifyWS, {
        options: {
            clientTracking: true
        }
    })

    fastify.register(async function (app) {
        const balances = await app.mongo.db.collection('balances')
        app.get('/socket', { websocket: true }, (connection, request) => {

            connection.socket.id = uuidv4();
            connection.socket.pingthing = {
                timer: setInterval(() => {
                    if (!connection.socket.pingthing.pinged) connection.socket.close(4000, 'HEARTBEAT_MISSED')
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
                if (result.op !== 3 && result.d == null || typeof result.d !== 'object' || Object.keys(result.d).length === 0) {
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
                            if (!fastify.subscriptions[uuid]) {
                                fastify.subscriptions[uuid] = []
                            }
                            fastify.subscriptions[uuid].push(connection.socket.id)
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
                            if (fastify.subscriptions[uuid].includes(connection.socket.id)) {
                                fastify.subscriptions[uuid].splice(fastify.subscriptions[uuid].indexOf(connection.socket.id), 1)
                                if (subscriptions[uuid].length === 0) delete fastify.subscriptions[uuid]
                            }
                        }
                        let count = 0;
                        Object.entries(fastify.subscriptions).forEach((x) => {
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
                if (Object.keys(fastify.subscriptions).length) {
                    for (const uuid in fastify.subscriptions) {
                        if (fastify.subscriptions[uuid].includes(connection.socket.id)) {
                            fastify.subscriptions[uuid].splice(fastify.subscriptions[uuid].indexOf(connection.socket.id), 1)
                            if (fastify.subscriptions[uuid].length === 0) delete fastify.subscriptions[uuid]
                        }
                    }
                }
                clearInterval(connection.socket.pingthing.timer)
            })
        })
    })

    next()
}

const options = {
    name: 'websocket',
    dependencies: ['mongodb']
}

export default fastifyPlugin(plugin, options)

function safeJsonParse(str) {
    try {
        return [null, JSON.parse(str)];
    } catch (err) {
        return [err];
    }
}