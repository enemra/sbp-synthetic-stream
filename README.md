# http-playback

Playback a file's contents over HTTP, at a configurable speed. Useful for simulating live data streams with canned inputs.

## Install
Install as a dependency to a project:

```shell
npm install --save http-playback
```

Install CLI tool globally:

```shell
npm install --global http-playback
```

## Using the command-line tool
```shell
http-playback --port 8080 --chunk-size 32 --delay 500 --filename sample.file
```

Test with curl:

```shell
curl -vN http://localhost:8080
```

## Programmatic Use

You can also use `http-playback` in your own code:

```javascript
var httpPlayback = require('http-playback');

var buffer = ...;

var options = {
  port: 8080,
  buffer: buffer, // you can provide your own buffer, or...
  filename: '/path/to/file',
  chunkSize: 32, // size, in bytes, of chunks
  delay: 500 // delay, in milliseconds, between sending chunks
};

httpPlayback(options, function (err, server) {
  // kill server after a delay
  setTimeout(function () {
    server.close();
  }, 5000);
});
```

## License
MIT license. See `LICENSE` file.
