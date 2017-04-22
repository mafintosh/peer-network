# peer-network

Create servers/clients that listen on names instead of ports and hostnames and are accessible over the internet.
Uses [hyperdht](https://github.com/mafintosh/hyperdht) to discover peers and holepunch connections to them.

Per default it uses `bootstrap1.hyperdht.org` to bootstrap the DHT but you can configure your own.

```
npm install peer-network
```

[![build status](http://img.shields.io/travis/mafintosh/peer-network.svg?style=flat)](http://travis-ci.org/mafintosh/peer-network)

## Usage

First create a server

``` js
var peernet = require('peer-network')
var network = peernet()

var server = network.createServer()

server.on('connection', function (stream) {
  console.log('new connection')
  stream.pipe(stream) // echo
})

server.listen('echo-server') // listen on a name
```

In another process (on any machine)

``` js
// will connect to a server annoucing itself as echo-server
var stream = network.connect('echo-server')

stream.write('hello world')
stream.on('data', function (data) {
  console.log('data:', data.toString())
})
```

## API

#### `var network = peernet(opts)`

Create a new network instance. Options are forwarded to the [hyperdht](https://github.com/mafintosh/hyperdht) constructor.
If you do not provide a bootstrap list, `bootstrap1.hyperdht.org` is used.

#### `var server = network.createServer([onconnection])`

Create a new server.

#### `server.listen(name, [onlistening])`

Listen on a name. Can be any buffer/string. Optionally you can specify a port to bound to as well. If not specified a random open port will be used.
The server will use discovery-channel to announce itself to other peers using multicast-dns, the bittorrent dht and potentially a series of dns servers.

#### `server.close([onclose])`

Close the server and stop announcing its pressence

#### `server.on('connection', stream)`

Emitted when a client connects

#### `server.on('listening')`

Emitted when the server is listening.

#### `server.on('error', err)`

Emitted if the server has a critical error.

#### `server.on('close')`

Emitted when the server is fully close

#### `var stream = network.connect(name)`

Connect to a server listening on a name. If multiple servers are listening it will connect to the first one to which an connection can be established.

#### `stream.on('connect')`

Emitted when the stream is fully connected to another peer. You do not need to wait for this event before writing data to the socket.

## License

MIT
