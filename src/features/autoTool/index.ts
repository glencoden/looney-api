const dgram = require('dgram')
const server = dgram.createSocket('udp4')

const PORT = 5555

const UDP_BUFFER: { [key: string]: Uint8Array } = {
    NOTE_START: Buffer.from('int\x00,i\x00\x00\x00\x00\x00d'),
    NOTE_END: Buffer.from('int\x00,i\x00\x00\x00\x00\x00@'),
}

export function bindAutoToolServer(io: any) {
    server.on('error', (err: any) => {
        console.log(`server error:\n${err.stack}`)
        server.close()
    })

    let isKeyDown = false

    let debugResult: string[][] | null = null

    server.on('message', (msg: Uint8Array, _rinfo: any) => {
        if (debugResult === null) {
            debugResult = []
            setTimeout(() => {
                console.log('UDP: ', debugResult)
                debugResult = null
            }, 2000)
        }
        const currentResult = []
        const currentMessage = msg.toString()
        for (let i = 0; i < currentMessage.length; i++) {
            currentResult.push(currentMessage[i])
        }
        debugResult.push(currentResult)

        if (Buffer.compare(msg, UDP_BUFFER.NOTE_START) === 0) {
            if (isKeyDown) {
                return
            }
            isKeyDown = true
            io.emit('next')
        } else if (Buffer.compare(msg, UDP_BUFFER.NOTE_END) === 0) {
            isKeyDown = false
        }
    })

    server.bind(PORT, () => console.log(`Datagram socket listening on port ${PORT}.`))
}