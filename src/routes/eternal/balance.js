export default async function (fastify) {

    const onRequest = [fastify.eternalAuthenticate]

    fastify.post('/balance', { onRequest }, async (request, reply) => {
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
}