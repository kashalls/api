import crypto from 'crypto'

export default async function (fastify) {

    // Get Users
    fastify.get('/', async (request, reply) => {
        const { uuid, username } = request.query;
        if (uuid && username) {
            reply.code(400)
            throw new Error('You cannot specify both a uuid and username to query.')
        }
        if (!uuid && !username) {
            reply.code(400)
            throw new Error('You must specify a uuid or a username to query.')
        }

        if (!uuid) {
            reply.code(400)
            throw new Error('Please specify a uuid to lookup.')
        }
    
        const users = fastify.mongo.db.collection('users')
        const userExists = await users.findOne({ _id: uuid })
        if (!userExists) {
            reply.code(404)
            throw new Error('User does not exist.');
        }
        if (!userExists.meta.public) {
            if (!request.headers.authorization || request.headers.authorization.length === 0) {
                reply.code(401)
                return {
                    message: 'User is private.'
                }
            }
            const isAuth = await fastify.eternalAuthenticate(request, reply)
            if (!isAuth) return;
            if (request.user.sub !== userExists._id) {
                reply.code(403)
                throw new Error('User does not have access to this resource.')
            }
        }
    
        const balances = fastify.mongo.db.collection('balances')
        const bal = await balances.findOne({ uuid }, { sort: { date: -1 }, limit: 1 })
        delete bal._id
    
        return bal;
    })

    fastify.post('/', async (request, reply) => {
        const users = fastify.mongo.db.collection('users')
        const { uuid } = request.body
    
        const existingUser = await users.findOne({ _id: uuid })
        if (existingUser) throw new Error('User already exists.')
    
        const code = crypto.randomBytes(6).toString('hex')
        const jti = uuidv4()
        const token = await fastify.jwt.sign({ sub: uuid, jti });
    
        const user = { _id: uuid, created: new Date(), code, api: { token, jti }, meta: { verified: false, public: false, hidden: false, admin: false } }
        const newUser = await users.insertOne(user)
        if (!newUser.acknowledged) {
            console.error(newUser)
            throw new Error('Failed to acknowledge new user.')
        }
        return { uuid, code }
    })

}