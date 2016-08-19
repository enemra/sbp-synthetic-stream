# sbp-synthetic-stream

Construct synthetic SBP position solution streams. Plays the stream(s) over a readable stream or HTTP.

You may specify points to interpolate between, to simulate a path. The paths will be randomly jittered and playback at the rate
that you specify.

## Install
Install as a dependency to a project:

```shell
npm install --save sbp-synthetic-stream
```

Install CLI tool globally:

```shell
npm install --global sbp-synthetic-stream
```

## Using the command-line tool
```shell
sbp-synthetic-stream --path "37.7755898502N,-122.511541278E,60;37.886690N,-121.155E,61" --streams 3 --ports 8080,8081,8082 --time 10m
```

Test with curl:

```shell
curl -vN http://localhost:8080 | sbp2json
curl -vN http://localhost:8081 | sbp2json
curl -vN http://localhost:8082 | sbp2json
```

You can install [`sbp2json` here](https://github.com/swift-nav/libsbp) via the Haskell project.

## Programmatic Use

TBD

## License
MIT license. See `LICENSE` file.
