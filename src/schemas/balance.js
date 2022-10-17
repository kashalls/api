export default {
    body: {
        type: 'object',
        properties: {
            balance: { type: 'number', minimum: 0 },
            uuid: { type: 'string', format: 'uuid' },
            address: { type: 'string' },
            reason: { type: 'string', enum: ['QUERY', 'GENERIC', 'BUY', 'SELL'] },
            date: { type: 'string', format: 'date-time' }
        },
        required: ['balance', 'uuid', 'address', 'reason']
    },
    headers: {
        type: 'object',
        properties: {
            'Authorization': { type: 'string' }
        },
        required: ['Authorization']
    }
}