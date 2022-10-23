# api.kashall.dev

This api currently powers a personal project of mine called `Eternal Balance`. It makes it super easy to track spending of your currency on [Eternal Realms](https://eternalrealms.net). It allows you to expose your balance to an API endpoint (`api.kashall.dev/balance/:uuid`) and to a WebSocket (see blow) for you to use whenever you want - for instance, I use this to keep track of my balance combined by all of my accounts.

You can use this API without deploying anything yourself - but if you want to self host it, you have the option to, though it'll take a some configuration.

## Start tracking your balance in < 5 minutes

1. (optional) Download the Fabric Mod from [comming soon](http://justwaitpatientlyplease)
2. Create a quick account on [bal.kashall.dev](https://bal.kashall.dev).
3. Login to [Eternal Realms](https://eternalrealms.net) and message the player it gave you on sign-up. (`/msg <player> verify <code>`)
4. Configure and fetch your API Key from the panel.
5. (optional) Configure the mod with your api key.

## Table of Contents

- [API Docs](#api-docs)
  - [Getting a user's balance](#getting-a-users-balance)
  - [Posting a user's balance](#posting-a-users-balance-authenticated)
- [Socket Docs](#socket-docs)
  - [Subscribing to user balances](#subscribing-to-user-balances)
  - [Unsubcribing to user balances](#unsubcribing-to-user-balances)
  - [List of Opcodes](#list-of-opcodes)
  - [Events](#events)
  - [Error Codes](#error-codes)

## API Docs

#### Getting a user's balance

`GET https://api.kashall.dev/eternal/balance/:uuid`

Example response:

```json


```

#### Posting a user's balance (Authenticated)

`POST https://api.kashall.dev/eternal/balance`

Example data:

```js
{
    "balance": "Integer",
    "date": "ISO Date String",
    "address": "server host:port",
    "reason": "QUERY|GENERIC|BUY|SELL",
    "uuid": "Mojang Player UUID v4"
}
```

Example response:

```js
{
    "acknowledged": true
}
```

## Socket Docs

The websocket is available at `wss://api.kashall.dev/socket`.

Once connected, you will recieve `Opcode 1: Hello`, which will contain a heartbeat_interval in the data field. You will need to set up a repeating interval for the time specified which would send `Opcode 3: Heartbeat` on the interval.

You should send `Opcode 2: Initialize` immediately after recieving `Opcode 1: Hello`.

Example of `Opcode 2: Initialize`:

```json
{
    "op": 2,
    "d": {
        "subscribe_to_uuids": ["3491fc09-13ba-4624-b3cc-da8e87f0230f"]
    }
}
```

#### Subscribing to user balances

To subscribe to specific user balances, send `subscribe_to_uuids` in the data object with a `string[]` list of player uuids. Then, the socket will respond with a `INIT_STATE`'s data object that contains a uuid=>balance map.

#### Unsubcribing to user balances

To unsubscribe to specific user balances, send `unsubscribe_to_uuids` in the data object with a `string[]` list of player uuids. The socket will stop sending you updates related to these players.

Once `Opcode 2: Initialize` is sent, you should immediately recieve an `INIT_STATE` event payload if connected successfully. If not, you will be disconnected with an error (see below).

### List of Opcodes

| Opcode | Name       | Description                                                                                                                 | Client Send/Recv |
| ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 0      | Event      | This is the default opcode when receiving core events, like `INIT_STATE`                                                    | Receive          |
| 1      | Hello      | Sent when clients initially connect, and it includes the heartbeat interval                                                 | Receive Only     |
| 2      | Initialize | This is what the client sends when receiving Opcode 1 - it should contain an array of uuids to subscribe to                 | Send only        |
| 3      | Heartbeat  | Clients should send Opcode 3 every 30 seconds (or whatever the Hello Opcode says to heartbeat at)                           | Send only        |

### Events

Events are received on `Opcode 0: Event` - the event type will be part of the root message object under the `t` key.

#### Example Event Message Objects

#### `INIT_STATE`

```js
{
  op: 0,
  t: "INIT_STATE",
  d: {
    "3491fc09-13ba-4624-b3cc-da8e87f0230f": {
      // Full latest balance (see above for example)
    }
  }
}
```

#### `BALANCE_UPDATE`

```js
{
  op: 0,
  t: "BALANCE_UPDATE",
  d: {
    "3491fc09-13ba-4624-b3cc-da8e87f0230f": {
        "date": "",
        "address": "play.eternal.gs",
        "balance": 0,
        "reason": "QUERY",
    }
  }
}
```

### Error Codes

Clients can disconnect for multiple reasons, usually to do with messages being badly formatted. Please refer to your WebSocket client to see how you should handle errors - they do not get received as regular messages.

#### Types of Errors

| Name                   | Code | Data                   |
| ---------------------- | ---- | ---------------------- |
| Invalid/Unknown Opcode | 4004 | `unknown_opcode`       |
| Opcode Requires Data   | 4005 | `requires_data_object` |
| Invalid Payload        | 4006 | `invalid_payload`      |
