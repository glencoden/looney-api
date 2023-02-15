const dgram = require('dgram')
const server = dgram.createSocket('udp4')

const UDP_BUFFER: { [key: string]: Uint8Array } = {
    DOWN: Buffer.from('int\x00,i\x00\x00\x00\x00\x00d'),
    UP: Buffer.from('int\x00,i\x00\x00\x00\x00\x00@'),
}

export function bindAutoToolServer(port: number, io) {
    server.on('error', (err: any) => {
        console.log(`server error:\n${err.stack}`)
        server.close()
    })
    let isKeyDown = false
    server.on('message', (msg: Uint8Array, _rinfo: any) => {
        if (Buffer.compare(msg, UDP_BUFFER.DOWN) === 0) {
            if (isKeyDown) {
                return
            }
            isKeyDown = true
            io.emit('next')
        } else if (Buffer.compare(msg, UDP_BUFFER.UP) === 0) {
            isKeyDown = false
        }
    })

    server.bind(port, () => console.log(`Datagram socket listening on port ${port}.`))
}