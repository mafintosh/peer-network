# discovery-network

Create servers/clients that listen on names instead of ports and hostnames and are accessible over the internet.
Uses [discovery-channel](https://github.com/maxogden/discovery-channel) to discover peers.

```
npm install discovery-network
```

## Usage

First create a server

``` js
var discovery = require('discovery-network')
var network = discovery()

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

#### `var network = discovery(opts)`

Create a new network instance. Options are forwarded to [discovery-channel](https://github.com/maxogden/discovery-channel).

#### `var server = network.createServer([onconnection])`

Create a new server.

#### `server.listen(name, [port], [onlistening])`

Listen on a name. Can be any buffer/string. Optionally you can specify a port to bound to as well. If not specified a random open port will be used.
The server will use discovery-channel to announce itself to other peers using multicast-dns, the bittorrent dht and potentially a series of dns servers.

#### `server.on('connection', stream)`

Emitted when a client connects

#### `server.address()`

Similar to https://nodejs.org/api/net.html#net_server_address.

#### `server.on('listening')`

Emitted when the server is listening.

#### `server.on('error', err)`

Emitted if the server has a critical error.

#### `var stream = network.connect(name)`

Connect to a server listening on a name. If multiple servers are listening it will connect to the first one to which an connection can be established.

## License

MIT
