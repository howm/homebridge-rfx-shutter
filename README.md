# homebridge-rfx-shutter

[![GitHub package.json version](https://img.shields.io/github/package-json/v/homebridge-rfx-shutter)](https://www.npmjs.com/package/@homebridge-rfx-shutter)

> Homebridge plugin for shutters controlled by RFXtrx433(E) transceivers.

### Install

```bash
npm i -g homebridge-rfx-shutter
```

### Usage

In your `~/.homebridge/config.json` on the accessories part add your shutter using the following example:

```json
    {
      "accessory": "HomebridgeRfxShutter",
      "tty": "/dev/ttyUSB0",
      "name": "Shutter 1",
      "deviceId": "0x0FFFFF/1",
      "openSeconds": 20,
      "closeSeconds": 20
    }
```

Where `tty` is the device "teletype" that can be found using the following command on linux systems:

```bash
system_profiler SPUSBDataType
```

Shutters device ids are logged at the plugin startup, eg:

```text
[2019-8-19 22:41:19] [Shutter 1] Found device 0x0FFFFA/1
[2019-8-19 22:41:19] [Shutter 1] Found device 0x0FFFFB/1
[2019-8-19 22:41:19] [Shutter 1] Found device 0x0FFFFC/1
[2019-8-19 22:41:19] [Shutter 1] Found device 0x0FFFFD/1
```

Some shutters close slower or quicker than their opening, we can then define an optional custom `closeSeconds` for them. This value is default to `openSeconds`.

### Release

```bash
yarn version
yarn build
yarn publish dist --access public
```
